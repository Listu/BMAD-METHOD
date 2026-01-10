/**
 * BMAD Orchestrator - Multi-Project Registry
 *
 * Manages the registry of BMAD projects in ~/.bmad/registry.yaml
 * Provides CRUD operations, auto-discovery, and project switching.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const yaml = require('yaml');
const crypto = require('crypto');

class ProjectRegistry {
  constructor(registryPath = null) {
    this.registryDir = registryPath || path.join(os.homedir(), '.bmad');
    this.registryFile = path.join(this.registryDir, 'registry.yaml');
    this._cache = null;
  }

  /**
   * Initialize the registry directory and file if they don't exist
   */
  async init() {
    try {
      await fs.mkdir(this.registryDir, { recursive: true });

      const exists = await this.fileExists(this.registryFile);
      if (!exists) {
        const defaultRegistry = {
          version: '1.0',
          last_updated: new Date().toISOString(),
          active_project: null,
          projects: {}
        };
        await this.saveRegistry(defaultRegistry);
      }
    } catch (error) {
      throw new Error(`Failed to initialize registry: ${error.message}`);
    }
  }

  /**
   * Load the registry from disk
   */
  async loadRegistry() {
    if (this._cache) return this._cache;

    try {
      const content = await fs.readFile(this.registryFile, 'utf8');
      this._cache = yaml.parse(content);
      return this._cache;
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.init();
        return this.loadRegistry();
      }
      throw new Error(`Failed to load registry: ${error.message}`);
    }
  }

  /**
   * Save the registry to disk
   */
  async saveRegistry(registry) {
    registry.last_updated = new Date().toISOString();
    const content = yaml.stringify(registry);
    await fs.writeFile(this.registryFile, content, 'utf8');
    this._cache = registry;
  }

  /**
   * Add a new project to the registry
   * @param {string} projectPath - Absolute path to the project
   * @param {object} options - Optional metadata overrides
   */
  async addProject(projectPath, options = {}) {
    const absolutePath = path.resolve(projectPath);

    // Validate path exists and has BMAD markers
    const validation = await this.validateBmadProject(absolutePath);
    if (!validation.valid) {
      throw new Error(`Invalid BMAD project: ${validation.reason}`);
    }

    const registry = await this.loadRegistry();

    // Check if already registered
    const existing = Object.entries(registry.projects).find(
      ([, proj]) => proj.path === absolutePath
    );
    if (existing) {
      return { id: existing[0], project: existing[1], alreadyExists: true };
    }

    // Generate project entry
    const projectId = crypto.randomBytes(4).toString('hex');
    const projectInfo = await this.extractProjectInfo(absolutePath);

    const project = {
      name: options.name || projectInfo.name || path.basename(absolutePath),
      path: absolutePath,
      type: options.type || projectInfo.type || 'unknown',
      created: new Date().toISOString(),
      last_accessed: new Date().toISOString(),
      status_file: projectInfo.statusFile || null,
      current_phase: projectInfo.currentPhase || null,
      modules_installed: projectInfo.modules || [],
      tags: options.tags || []
    };

    registry.projects[projectId] = project;

    // Set as active if no active project
    if (!registry.active_project) {
      registry.active_project = projectId;
    }

    await this.saveRegistry(registry);
    return { id: projectId, project, alreadyExists: false };
  }

  /**
   * List all registered projects
   */
  async listProjects() {
    const registry = await this.loadRegistry();
    const projects = [];

    for (const [id, project] of Object.entries(registry.projects)) {
      const pathExists = await this.fileExists(project.path);
      projects.push({
        id,
        ...project,
        isActive: id === registry.active_project,
        pathExists
      });
    }

    // Sort by last_accessed (most recent first)
    projects.sort((a, b) =>
      new Date(b.last_accessed) - new Date(a.last_accessed)
    );

    return {
      builtIn: projects.filter(p => p.type === 'platform'),
      custom: projects.filter(p => p.type !== 'platform'),
      activeId: registry.active_project
    };
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId) {
    const registry = await this.loadRegistry();
    const project = registry.projects[projectId];
    if (!project) return null;

    return {
      id: projectId,
      ...project,
      isActive: projectId === registry.active_project
    };
  }

  /**
   * Switch the active project
   */
  async switchProject(projectId) {
    const registry = await this.loadRegistry();

    if (!registry.projects[projectId]) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const pathExists = await this.fileExists(registry.projects[projectId].path);
    if (!pathExists) {
      throw new Error(
        `Project path no longer exists: ${registry.projects[projectId].path}`
      );
    }

    registry.active_project = projectId;
    registry.projects[projectId].last_accessed = new Date().toISOString();

    await this.saveRegistry(registry);
    return registry.projects[projectId];
  }

  /**
   * Remove a project from the registry (does not delete files)
   */
  async removeProject(projectId) {
    const registry = await this.loadRegistry();

    if (!registry.projects[projectId]) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const removed = registry.projects[projectId];
    delete registry.projects[projectId];

    // Update active project if needed
    if (registry.active_project === projectId) {
      const remaining = Object.keys(registry.projects);
      registry.active_project = remaining.length > 0 ? remaining[0] : null;
    }

    await this.saveRegistry(registry);
    return removed;
  }

  /**
   * Update project metadata
   */
  async updateProject(projectId, updates) {
    const registry = await this.loadRegistry();

    if (!registry.projects[projectId]) {
      throw new Error(`Project not found: ${projectId}`);
    }

    registry.projects[projectId] = {
      ...registry.projects[projectId],
      ...updates,
      last_accessed: new Date().toISOString()
    };

    await this.saveRegistry(registry);
    return registry.projects[projectId];
  }

  /**
   * Auto-discover BMAD projects in common directories
   */
  async autoDiscover(searchPaths = null) {
    const defaultPaths = [
      os.homedir(),
      path.join(os.homedir(), 'Projects'),
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Code'),
      path.join(os.homedir(), 'dev'),
      path.join(os.homedir(), 'workspace')
    ];

    const paths = searchPaths || defaultPaths;
    const discovered = [];

    for (const searchPath of paths) {
      const exists = await this.fileExists(searchPath);
      if (!exists) continue;

      try {
        const found = await this.scanForBmadProjects(searchPath, 3);
        discovered.push(...found);
      } catch (error) {
        // Skip directories we can't access
        console.warn(`Could not scan ${searchPath}: ${error.message}`);
      }
    }

    // Filter out already registered projects
    const registry = await this.loadRegistry();
    const registeredPaths = new Set(
      Object.values(registry.projects).map(p => p.path)
    );

    return discovered.filter(p => !registeredPaths.has(p.path));
  }

  /**
   * Scan a directory recursively for BMAD projects
   */
  async scanForBmadProjects(dir, maxDepth, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];

    const found = [];
    const bmadPath = path.join(dir, '_bmad');
    const hasBmad = await this.fileExists(bmadPath);

    if (hasBmad) {
      const info = await this.extractProjectInfo(dir);
      found.push({
        path: dir,
        name: info.name || path.basename(dir),
        type: info.type,
        modules: info.modules
      });
      return found; // Don't recurse into BMAD projects
    }

    // Recurse into subdirectories
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;

        const subFound = await this.scanForBmadProjects(
          path.join(dir, entry.name),
          maxDepth,
          currentDepth + 1
        );
        found.push(...subFound);
      }
    } catch {
      // Skip inaccessible directories
    }

    return found;
  }

  /**
   * Validate that a path contains a valid BMAD project
   */
  async validateBmadProject(projectPath) {
    const bmadPath = path.join(projectPath, '_bmad');
    const hasBmad = await this.fileExists(bmadPath);

    if (!hasBmad) {
      return { valid: false, reason: 'No _bmad directory found' };
    }

    const configPath = path.join(bmadPath, 'core', 'config.yaml');
    const hasConfig = await this.fileExists(configPath);

    if (!hasConfig) {
      return { valid: false, reason: 'No core config.yaml found' };
    }

    return { valid: true };
  }

  /**
   * Extract project information from BMAD files
   */
  async extractProjectInfo(projectPath) {
    const info = {
      name: null,
      type: 'unknown',
      modules: [],
      statusFile: null,
      currentPhase: null
    };

    // Try to read BMM config for project name
    const bmmConfigPath = path.join(projectPath, '_bmad', 'bmm', 'config.yaml');
    try {
      const bmmContent = await fs.readFile(bmmConfigPath, 'utf8');
      const bmmConfig = yaml.parse(bmmContent);
      info.name = bmmConfig.project_name;
    } catch {
      // BMM not installed
    }

    // Detect installed modules
    const modulesPath = path.join(projectPath, '_bmad');
    try {
      const entries = await fs.readdir(modulesPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('_')) {
          info.modules.push(entry.name);
        }
      }
    } catch {
      // Can't read modules
    }

    // Check for workflow status
    const statusPath = path.join(
      projectPath,
      '_bmad-output',
      'planning-artifacts',
      'bmm-workflow-status.yaml'
    );
    const hasStatus = await this.fileExists(statusPath);
    if (hasStatus) {
      info.statusFile = '_bmad-output/planning-artifacts/bmm-workflow-status.yaml';
      try {
        const statusContent = await fs.readFile(statusPath, 'utf8');
        const status = yaml.parse(statusContent);
        info.currentPhase = status.current_phase;
      } catch {
        // Can't parse status
      }
    }

    // Detect project type from modules
    if (info.modules.includes('bmgd')) {
      info.type = 'game';
    } else if (info.modules.includes('bmm')) {
      info.type = 'product';
    } else if (info.modules.includes('bmb')) {
      info.type = 'builder';
    }

    return info;
  }

  /**
   * Helper to check if a file/directory exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear the cache (useful for testing)
   */
  clearCache() {
    this._cache = null;
  }
}

module.exports = { ProjectRegistry };
