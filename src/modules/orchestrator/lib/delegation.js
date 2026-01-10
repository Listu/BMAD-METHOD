/**
 * BMAD Orchestrator - Background Delegation
 *
 * Manages background Claude Code sessions for parallel task execution.
 * Allows the orchestrator to delegate tasks without blocking.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Delegation status values
const DELEGATION_STATUS = {
  PENDING: 'pending',
  SPAWNING: 'spawning',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  KILLED: 'killed',
  TIMEOUT: 'timeout'
};

// Default configuration
const DEFAULT_CONFIG = {
  maxConcurrentSessions: 3,
  sessionTimeoutMs: 600000,      // 10 minutes
  cleanupAfterMs: 86400000,      // 24 hours
  pollIntervalMs: 5000           // 5 seconds
};

/**
 * Session Manager
 * Handles spawning, monitoring, and result collection for background sessions
 */
class SessionManager {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.sessionsDir = path.join(os.homedir(), '.bmad', 'sessions');
    this.sessions = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the session manager
   */
  async init() {
    if (this.initialized) return;

    // Create sessions directory
    await fs.mkdir(this.sessionsDir, { recursive: true });

    // Load any existing sessions
    await this.loadExistingSessions();

    this.initialized = true;
  }

  /**
   * Load sessions from disk (for recovery after restart)
   */
  async loadExistingSessions() {
    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const sessionDir = path.join(this.sessionsDir, entry.name);
        const statusPath = path.join(sessionDir, 'status.json');

        try {
          const statusContent = await fs.readFile(statusPath, 'utf8');
          const status = JSON.parse(statusContent);

          // Only load non-completed sessions (completed ones can be queried but don't need tracking)
          if (status.status !== DELEGATION_STATUS.COMPLETED &&
              status.status !== DELEGATION_STATUS.FAILED) {
            this.sessions.set(entry.name, {
              id: entry.name,
              ...status,
              child: null // Process reference lost after restart
            });
          }
        } catch {
          // Session doesn't have valid status file
        }
      }
    } catch {
      // Sessions directory might not exist yet
    }
  }

  /**
   * Spawn a new background session
   */
  async spawnSession(task) {
    await this.init();

    // Check concurrent session limit
    const runningCount = Array.from(this.sessions.values())
      .filter(s => s.status === DELEGATION_STATUS.RUNNING).length;

    if (runningCount >= this.config.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions (${this.config.maxConcurrentSessions}) reached`);
    }

    const sessionId = crypto.randomBytes(8).toString('hex');
    const sessionDir = path.join(this.sessionsDir, sessionId);

    // Create session directory
    await fs.mkdir(sessionDir, { recursive: true });

    // Write task file
    const taskData = {
      id: sessionId,
      ...task,
      createdAt: new Date().toISOString()
    };
    await fs.writeFile(
      path.join(sessionDir, 'task.json'),
      JSON.stringify(taskData, null, 2)
    );

    // Initialize status
    const status = {
      id: sessionId,
      status: DELEGATION_STATUS.SPAWNING,
      task: task.prompt,
      projectId: task.projectId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      pid: null
    };
    await this.writeStatus(sessionId, status);

    // Build the delegation prompt
    const prompt = this.buildDelegationPrompt(task);

    // Spawn Claude Code process
    const child = spawn('claude', [
      '--cwd', task.workingDirectory || process.cwd(),
      '--print',
      prompt
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BMAD_DELEGATED_SESSION: sessionId }
    });

    // Store session reference
    const session = {
      id: sessionId,
      ...status,
      status: DELEGATION_STATUS.RUNNING,
      child,
      pid: child.pid,
      output: ''
    };
    this.sessions.set(sessionId, session);

    // Update status with PID
    await this.writeStatus(sessionId, { ...status, status: DELEGATION_STATUS.RUNNING, pid: child.pid });

    // Handle output
    child.stdout.on('data', (data) => {
      session.output += data.toString();
      this.appendOutput(sessionId, data.toString());
    });

    child.stderr.on('data', (data) => {
      session.output += `[stderr] ${data.toString()}`;
      this.appendOutput(sessionId, `[stderr] ${data.toString()}`);
    });

    // Handle completion
    child.on('exit', async (code) => {
      await this.handleExit(sessionId, code);
    });

    // Set timeout
    setTimeout(async () => {
      const currentSession = this.sessions.get(sessionId);
      if (currentSession && currentSession.status === DELEGATION_STATUS.RUNNING) {
        await this.killSession(sessionId, 'timeout');
      }
    }, this.config.sessionTimeoutMs);

    return sessionId;
  }

  /**
   * Build the prompt for the delegated session
   */
  buildDelegationPrompt(task) {
    let prompt = `You are a delegated BMAD session executing a background task.

## Task
${task.prompt}

## Instructions
1. Execute the task completely
2. Report any errors encountered
3. List all files created or modified
4. Provide a summary of what was accomplished

## Context
- Project: ${task.projectId || 'Unknown'}
- Type: ${task.type || 'general'}
${task.workflowPath ? `- Workflow: ${task.workflowPath}` : ''}

Begin execution now.`;

    return prompt;
  }

  /**
   * Write status to disk
   */
  async writeStatus(sessionId, status) {
    const statusPath = path.join(this.sessionsDir, sessionId, 'status.json');
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
  }

  /**
   * Append output to output file
   */
  async appendOutput(sessionId, data) {
    const outputPath = path.join(this.sessionsDir, sessionId, 'output.txt');
    await fs.appendFile(outputPath, data);
  }

  /**
   * Handle session exit
   */
  async handleExit(sessionId, exitCode) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const success = exitCode === 0;
    const finalStatus = success ? DELEGATION_STATUS.COMPLETED : DELEGATION_STATUS.FAILED;

    session.status = finalStatus;
    session.completedAt = new Date().toISOString();
    session.exitCode = exitCode;

    // Write final status
    await this.writeStatus(sessionId, {
      id: sessionId,
      status: finalStatus,
      task: session.task,
      projectId: session.projectId,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      exitCode,
      pid: session.pid
    });

    // Write result
    const result = {
      success,
      exitCode,
      output: session.output,
      completedAt: session.completedAt
    };
    await fs.writeFile(
      path.join(this.sessionsDir, sessionId, 'result.json'),
      JSON.stringify(result, null, 2)
    );
  }

  /**
   * Check status of a session
   */
  async checkStatus(sessionId) {
    // Check in-memory first
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        id: sessionId,
        status: session.status,
        task: session.task,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        pid: session.pid
      };
    }

    // Check on disk
    const statusPath = path.join(this.sessionsDir, sessionId, 'status.json');
    try {
      const content = await fs.readFile(statusPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get result of a completed session
   */
  async getResult(sessionId) {
    const resultPath = path.join(this.sessionsDir, sessionId, 'result.json');
    try {
      const content = await fs.readFile(resultPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Get output of a session (even if still running)
   */
  async getOutput(sessionId) {
    const outputPath = path.join(this.sessionsDir, sessionId, 'output.txt');
    try {
      return await fs.readFile(outputPath, 'utf8');
    } catch {
      return '';
    }
  }

  /**
   * Kill a running session
   */
  async killSession(sessionId, reason = 'user_request') {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.child && session.status === DELEGATION_STATUS.RUNNING) {
      try {
        // Kill the process group
        process.kill(-session.child.pid, 'SIGTERM');
      } catch {
        // Process might already be dead
      }

      session.status = reason === 'timeout' ? DELEGATION_STATUS.TIMEOUT : DELEGATION_STATUS.KILLED;
      session.completedAt = new Date().toISOString();

      await this.writeStatus(sessionId, {
        id: sessionId,
        status: session.status,
        task: session.task,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        killReason: reason
      });

      return true;
    }

    return false;
  }

  /**
   * List all sessions
   */
  async listSessions(filter = {}) {
    await this.init();

    const sessions = [];

    // Get from memory
    for (const [id, session] of this.sessions) {
      if (filter.status && session.status !== filter.status) continue;
      if (filter.projectId && session.projectId !== filter.projectId) continue;

      sessions.push({
        id,
        status: session.status,
        task: session.task,
        startedAt: session.startedAt,
        completedAt: session.completedAt
      });
    }

    // Also check disk for completed sessions not in memory
    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (this.sessions.has(entry.name)) continue;

        const status = await this.checkStatus(entry.name);
        if (!status) continue;

        if (filter.status && status.status !== filter.status) continue;
        if (filter.projectId && status.projectId !== filter.projectId) continue;

        sessions.push(status);
      }
    } catch {
      // Directory might not exist
    }

    // Sort by startedAt descending
    sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    return sessions;
  }

  /**
   * Clean up old completed sessions
   */
  async cleanup() {
    const cutoff = Date.now() - this.config.cleanupAfterMs;

    try {
      const entries = await fs.readdir(this.sessionsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const status = await this.checkStatus(entry.name);
        if (!status) continue;

        // Only clean up completed/failed sessions
        if (status.status !== DELEGATION_STATUS.COMPLETED &&
            status.status !== DELEGATION_STATUS.FAILED) continue;

        // Check age
        const completedAt = new Date(status.completedAt).getTime();
        if (completedAt < cutoff) {
          await fs.rm(path.join(this.sessionsDir, entry.name), { recursive: true });
          this.sessions.delete(entry.name);
        }
      }
    } catch {
      // Cleanup failures are non-critical
    }
  }
}

/**
 * Delegation Queue
 * Manages queued tasks when max concurrent sessions is reached
 */
class DelegationQueue {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add a task to the queue
   */
  async enqueue(task) {
    // Try to spawn immediately
    try {
      const sessionId = await this.sessionManager.spawnSession(task);
      return { queued: false, sessionId };
    } catch (error) {
      if (error.message.includes('Maximum concurrent sessions')) {
        // Add to queue
        const queueId = crypto.randomBytes(4).toString('hex');
        this.queue.push({ id: queueId, task, addedAt: new Date() });
        this.processQueue();
        return { queued: true, queueId, position: this.queue.length };
      }
      throw error;
    }
  }

  /**
   * Process the queue when slots become available
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      try {
        const item = this.queue[0];
        await this.sessionManager.spawnSession(item.task);
        this.queue.shift();
      } catch (error) {
        if (error.message.includes('Maximum concurrent sessions')) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          // Remove failed item from queue
          this.queue.shift();
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      length: this.queue.length,
      items: this.queue.map((item, i) => ({
        position: i + 1,
        queueId: item.id,
        task: item.task.prompt?.slice(0, 100),
        addedAt: item.addedAt
      }))
    };
  }
}

module.exports = {
  SessionManager,
  DelegationQueue,
  DELEGATION_STATUS
};
