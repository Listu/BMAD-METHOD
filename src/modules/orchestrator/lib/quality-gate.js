/**
 * BMAD Orchestrator - Quality Gate
 *
 * Automatically validates tasks before marking them complete.
 * Runs build, tests, and optional server checks.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Project type detection markers
const PROJECT_MARKERS = {
  nodejs: ['package.json'],
  python: ['requirements.txt', 'setup.py', 'pyproject.toml'],
  go: ['go.mod'],
  rust: ['Cargo.toml'],
  godot: ['project.godot'],
  unity: ['Assets/Scenes']
};

// Build commands by project type
const BUILD_COMMANDS = {
  nodejs: 'npm run build',
  python: 'python setup.py build',
  go: 'go build ./...',
  rust: 'cargo build',
  godot: 'godot --headless --export-release',
  unity: null // Unity builds require more complex setup
};

// Test commands by project type
const TEST_COMMANDS = {
  nodejs: 'npm test',
  python: 'pytest',
  go: 'go test ./...',
  rust: 'cargo test',
  godot: 'godot --headless --script res://test_runner.gd',
  unity: null
};

// Default configuration
const DEFAULT_CONFIG = {
  buildEnabled: true,
  testEnabled: true,
  serverCheckEnabled: false,
  timeouts: {
    build: 300000,    // 5 minutes
    test: 600000,     // 10 minutes
    server: 30000     // 30 seconds
  },
  skipPatterns: [
    /^docs?\//,
    /^\.github\//,
    /README/i,
    /CHANGELOG/i,
    /LICENSE/i
  ]
};

/**
 * Quality Gate
 * Validates code changes before marking tasks complete
 */
class QualityGate {
  constructor(projectPath, config = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run the full quality gate check
   */
  async run(options = {}) {
    const results = {
      passed: true,
      projectType: null,
      steps: [],
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    // Check if we should skip based on changed files
    if (options.changedFiles && this.shouldSkip(options.changedFiles)) {
      results.skipped = true;
      results.skipReason = 'Only documentation or config changes detected';
      results.completedAt = new Date().toISOString();
      return results;
    }

    // 1. Detect project type
    const projectType = await this.detectProjectType();
    results.projectType = projectType;

    if (projectType === 'unknown') {
      results.steps.push({
        step: 'detect',
        success: true,
        skipped: true,
        message: 'Unknown project type, skipping automated checks'
      });
      results.completedAt = new Date().toISOString();
      return results;
    }

    // 2. Run build
    if (this.config.buildEnabled) {
      const buildResult = await this.runBuild(projectType);
      results.steps.push({ step: 'build', ...buildResult });

      if (!buildResult.success && !buildResult.skipped) {
        results.passed = false;
        results.completedAt = new Date().toISOString();
        return results;
      }
    }

    // 3. Run tests
    if (this.config.testEnabled) {
      const testResult = await this.runTests(projectType);
      results.steps.push({ step: 'test', ...testResult });

      if (!testResult.success && !testResult.skipped) {
        results.passed = false;
        results.completedAt = new Date().toISOString();
        return results;
      }
    }

    // 4. Server check (optional)
    if (this.config.serverCheckEnabled) {
      const serverResult = await this.checkServer();
      results.steps.push({ step: 'server', ...serverResult });

      if (!serverResult.success && !serverResult.skipped) {
        results.passed = false;
      }
    }

    results.completedAt = new Date().toISOString();
    return results;
  }

  /**
   * Detect the project type from filesystem markers
   */
  async detectProjectType() {
    for (const [type, markers] of Object.entries(PROJECT_MARKERS)) {
      for (const marker of markers) {
        const markerPath = path.join(this.projectPath, marker);
        try {
          await fs.access(markerPath);
          return type;
        } catch {
          // Marker not found
        }
      }
    }
    return 'unknown';
  }

  /**
   * Run the build command
   */
  async runBuild(projectType) {
    const command = this.config.buildCommand || BUILD_COMMANDS[projectType];

    if (!command) {
      return { success: true, skipped: true, message: 'No build command for this project type' };
    }

    // Check if build script exists for Node.js projects
    if (projectType === 'nodejs') {
      try {
        const pkgPath = path.join(this.projectPath, 'package.json');
        const pkgContent = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);

        if (!pkg.scripts?.build) {
          return { success: true, skipped: true, message: 'No build script in package.json' };
        }
      } catch {
        return { success: false, error: 'Could not read package.json' };
      }
    }

    return this.executeCommand(command, this.config.timeouts.build);
  }

  /**
   * Run the test command
   */
  async runTests(projectType) {
    const command = this.config.testCommand || TEST_COMMANDS[projectType];

    if (!command) {
      return { success: true, skipped: true, message: 'No test command for this project type' };
    }

    // Check if test script exists for Node.js projects
    if (projectType === 'nodejs') {
      try {
        const pkgPath = path.join(this.projectPath, 'package.json');
        const pkgContent = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent);

        if (!pkg.scripts?.test || pkg.scripts.test.includes('no test specified')) {
          return { success: true, skipped: true, message: 'No test script in package.json' };
        }
      } catch {
        return { success: false, error: 'Could not read package.json' };
      }
    }

    return this.executeCommand(command, this.config.timeouts.test);
  }

  /**
   * Check if a server starts and responds
   */
  async checkServer() {
    if (!this.config.serverConfig) {
      return { success: true, skipped: true, message: 'No server config provided' };
    }

    const {
      startCommand,
      healthUrl = 'http://localhost:3000/health',
      waitMs = 10000
    } = this.config.serverConfig;

    // Start the server
    const serverProcess = spawn('sh', ['-c', startCommand], {
      cwd: this.projectPath,
      detached: true,
      stdio: 'ignore'
    });

    try {
      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, waitMs));

      // Check health endpoint
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(this.config.timeouts.server)
      });

      return {
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Server health check passed' : `Server returned ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    } finally {
      // Kill the server
      try {
        process.kill(-serverProcess.pid, 'SIGTERM');
      } catch {
        // Server might already be dead
      }
    }
  }

  /**
   * Execute a command and capture output
   */
  executeCommand(command, timeout) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        cwd: this.projectPath,
        timeout,
        env: { ...process.env, CI: 'true' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      child.on('close', (code) => {
        // Truncate output to last 5000 chars
        const truncatedStdout = stdout.slice(-5000);
        const truncatedStderr = stderr.slice(-5000);

        resolve({
          success: code === 0,
          exitCode: code,
          stdout: truncatedStdout,
          stderr: truncatedStderr,
          message: code === 0 ? 'Command succeeded' : `Command failed with exit code ${code}`
        });
      });
    });
  }

  /**
   * Check if quality gate should be skipped based on changed files
   */
  shouldSkip(changedFiles) {
    if (!changedFiles || changedFiles.length === 0) {
      return false;
    }

    return changedFiles.every(file =>
      this.config.skipPatterns.some(pattern => pattern.test(file))
    );
  }

  /**
   * Format results for display
   */
  formatResults(results) {
    const lines = [];

    lines.push(`## Quality Gate ${results.passed ? '✅ PASSED' : '❌ FAILED'}`);
    lines.push('');

    if (results.skipped) {
      lines.push(`⏭️ Skipped: ${results.skipReason}`);
      return lines.join('\n');
    }

    lines.push(`Project Type: ${results.projectType}`);
    lines.push('');

    for (const step of results.steps) {
      const icon = step.skipped ? '⏭️' : (step.success ? '✅' : '❌');
      lines.push(`${icon} **${step.step.toUpperCase()}**: ${step.message || (step.success ? 'Passed' : 'Failed')}`);

      if (!step.success && !step.skipped && step.stderr) {
        lines.push('```');
        lines.push(step.stderr.slice(-1000));
        lines.push('```');
      }
    }

    return lines.join('\n');
  }
}

/**
 * Quick validation function
 */
async function validateTask(projectPath, options = {}) {
  const gate = new QualityGate(projectPath, options.config);
  const results = await gate.run(options);
  return results;
}

module.exports = {
  QualityGate,
  validateTask,
  PROJECT_MARKERS,
  BUILD_COMMANDS,
  TEST_COMMANDS
};
