/**
 * BMAD Orchestrator - Export/Import
 *
 * Provides project export and import functionality.
 * Enables sharing project configurations, memories, and state.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Export formats
const EXPORT_FORMATS = {
  FULL: 'full',           // Everything including memories
  CONFIG: 'config',       // Project config and workflow status only
  MEMORY: 'memory',       // Memories only
  ARTIFACTS: 'artifacts'  // Planning/implementation artifacts
};

// Export file extension
const EXPORT_EXTENSION = '.bmad-export.json';

// Default configuration
const DEFAULT_CONFIG = {
  includeMemories: true,
  includeArtifacts: true,
  includeWorkflowStatus: true,
  compressOutput: false,
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '*.log'
  ]
};

/**
 * Project Exporter
 * Handles exporting project data to shareable format
 */
class ProjectExporter {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.bmadDir = path.join(projectPath, '_bmad');
  }

  /**
   * Export project data
   */
  async export(format = EXPORT_FORMATS.FULL, outputPath = null) {
    const exportData = {
      version: '1.0.0',
      format,
      exportedAt: new Date().toISOString(),
      projectPath: this.projectPath,
      projectName: path.basename(this.projectPath),
      checksum: null,
      data: {}
    };

    // Export based on format
    switch (format) {
      case EXPORT_FORMATS.FULL:
        await this.exportConfig(exportData);
        await this.exportWorkflowStatus(exportData);
        await this.exportArtifacts(exportData);
        await this.exportMemories(exportData);
        break;

      case EXPORT_FORMATS.CONFIG:
        await this.exportConfig(exportData);
        await this.exportWorkflowStatus(exportData);
        break;

      case EXPORT_FORMATS.MEMORY:
        await this.exportMemories(exportData);
        break;

      case EXPORT_FORMATS.ARTIFACTS:
        await this.exportArtifacts(exportData);
        break;
    }

    // Calculate checksum
    exportData.checksum = this.calculateChecksum(exportData.data);

    // Write to file or return
    if (outputPath) {
      const finalPath = outputPath.endsWith(EXPORT_EXTENSION)
        ? outputPath
        : `${outputPath}${EXPORT_EXTENSION}`;

      await fs.writeFile(finalPath, JSON.stringify(exportData, null, 2));

      return {
        success: true,
        path: finalPath,
        format,
        size: JSON.stringify(exportData).length,
        checksum: exportData.checksum
      };
    }

    return exportData;
  }

  /**
   * Export project configuration
   */
  async exportConfig(exportData) {
    try {
      const configPath = path.join(this.bmadDir, 'project.yaml');
      const content = await fs.readFile(configPath, 'utf8');
      exportData.data.config = {
        raw: content,
        parsed: this.parseYaml(content)
      };
    } catch {
      exportData.data.config = null;
    }
  }

  /**
   * Export workflow status
   */
  async exportWorkflowStatus(exportData) {
    try {
      const statusPath = path.join(this.bmadDir, 'workflow-status.yaml');
      const content = await fs.readFile(statusPath, 'utf8');
      exportData.data.workflowStatus = {
        raw: content,
        parsed: this.parseYaml(content)
      };
    } catch {
      exportData.data.workflowStatus = null;
    }
  }

  /**
   * Export artifacts (planning and implementation)
   */
  async exportArtifacts(exportData) {
    if (!this.config.includeArtifacts) {
      exportData.data.artifacts = null;
      return;
    }

    exportData.data.artifacts = {
      planning: await this.exportDirectory(path.join(this.bmadDir, 'planning-artifacts')),
      implementation: await this.exportDirectory(path.join(this.bmadDir, 'implementation-artifacts')),
      docs: await this.exportDirectory(path.join(this.bmadDir, 'docs'))
    };
  }

  /**
   * Export memories (if available)
   */
  async exportMemories(exportData) {
    if (!this.config.includeMemories) {
      exportData.data.memories = null;
      return;
    }

    // Try to export from local memory files
    const memoriesDir = path.join(this.bmadDir, 'memories');

    try {
      exportData.data.memories = await this.exportDirectory(memoriesDir);
    } catch {
      // Memories might be in ChromaDB instead of files
      exportData.data.memories = {
        note: 'Memories stored in ChromaDB - export via memory manager',
        files: {}
      };
    }
  }

  /**
   * Export a directory recursively
   */
  async exportDirectory(dirPath) {
    const result = { files: {} };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relativePath = entry.name;

        // Skip excluded patterns
        if (this.shouldExclude(entry.name)) continue;

        if (entry.isDirectory()) {
          const subDir = await this.exportDirectory(entryPath);
          for (const [subPath, content] of Object.entries(subDir.files)) {
            result.files[`${relativePath}/${subPath}`] = content;
          }
        } else {
          try {
            const content = await fs.readFile(entryPath, 'utf8');
            result.files[relativePath] = {
              content,
              size: content.length,
              modified: (await fs.stat(entryPath)).mtime.toISOString()
            };
          } catch {
            // Skip binary files
          }
        }
      }
    } catch {
      // Directory might not exist
    }

    return result;
  }

  /**
   * Check if file should be excluded
   */
  shouldExclude(filename) {
    for (const pattern of this.config.excludePatterns) {
      if (pattern.startsWith('*')) {
        if (filename.endsWith(pattern.slice(1))) return true;
      } else {
        if (filename === pattern) return true;
      }
    }
    return false;
  }

  /**
   * Calculate checksum for data integrity
   */
  calculateChecksum(data) {
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Simple YAML parser (basic key: value)
   */
  parseYaml(content) {
    const result = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        result[key] = value;
      }
    }

    return result;
  }
}

/**
 * Project Importer
 * Handles importing project data from export files
 */
class ProjectImporter {
  constructor(targetPath, options = {}) {
    this.targetPath = targetPath;
    this.options = options;
    this.bmadDir = path.join(targetPath, '_bmad');
  }

  /**
   * Import project data from export file
   */
  async import(exportPath, options = {}) {
    const mergeStrategy = options.mergeStrategy || 'skip'; // skip, overwrite, merge

    // Read export file
    let exportData;
    try {
      const content = await fs.readFile(exportPath, 'utf8');
      exportData = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read export file: ${error.message}`);
    }

    // Validate export
    const validation = this.validateExport(exportData);
    if (!validation.valid) {
      throw new Error(`Invalid export file: ${validation.reason}`);
    }

    // Create target directory structure
    await fs.mkdir(this.bmadDir, { recursive: true });

    const results = {
      success: true,
      imported: [],
      skipped: [],
      conflicts: [],
      warnings: []
    };

    // Import based on format
    if (exportData.data.config) {
      await this.importConfig(exportData.data.config, mergeStrategy, results);
    }

    if (exportData.data.workflowStatus) {
      await this.importWorkflowStatus(exportData.data.workflowStatus, mergeStrategy, results);
    }

    if (exportData.data.artifacts) {
      await this.importArtifacts(exportData.data.artifacts, mergeStrategy, results);
    }

    if (exportData.data.memories) {
      await this.importMemories(exportData.data.memories, mergeStrategy, results);
    }

    return results;
  }

  /**
   * Validate export data structure
   */
  validateExport(exportData) {
    if (!exportData.version) {
      return { valid: false, reason: 'Missing version' };
    }

    if (!exportData.format) {
      return { valid: false, reason: 'Missing format' };
    }

    if (!exportData.data) {
      return { valid: false, reason: 'Missing data' };
    }

    // Verify checksum
    if (exportData.checksum) {
      const exporter = new ProjectExporter('');
      const calculated = exporter.calculateChecksum(exportData.data);
      if (calculated !== exportData.checksum) {
        return { valid: false, reason: 'Checksum mismatch - data may be corrupted' };
      }
    }

    return { valid: true };
  }

  /**
   * Import project configuration
   */
  async importConfig(configData, mergeStrategy, results) {
    const configPath = path.join(this.bmadDir, 'project.yaml');

    const action = await this.handleConflict(configPath, mergeStrategy, results);
    if (action === 'skip') {
      results.skipped.push('project.yaml');
      return;
    }

    await fs.writeFile(configPath, configData.raw);
    results.imported.push('project.yaml');
  }

  /**
   * Import workflow status
   */
  async importWorkflowStatus(statusData, mergeStrategy, results) {
    const statusPath = path.join(this.bmadDir, 'workflow-status.yaml');

    const action = await this.handleConflict(statusPath, mergeStrategy, results);
    if (action === 'skip') {
      results.skipped.push('workflow-status.yaml');
      return;
    }

    if (action === 'merge' && statusData.parsed) {
      // Merge workflow status
      try {
        const existingContent = await fs.readFile(statusPath, 'utf8');
        const existing = new ProjectExporter('').parseYaml(existingContent);

        // Merge completed workflows
        const merged = { ...existing };
        if (statusData.parsed.completed) {
          const existingCompleted = existing.completed ? existing.completed.split(',') : [];
          const importedCompleted = statusData.parsed.completed.split(',');
          merged.completed = [...new Set([...existingCompleted, ...importedCompleted])].join(',');
        }

        await fs.writeFile(statusPath, this.toYaml(merged));
        results.imported.push('workflow-status.yaml (merged)');
        return;
      } catch {
        // Fall through to overwrite
      }
    }

    await fs.writeFile(statusPath, statusData.raw);
    results.imported.push('workflow-status.yaml');
  }

  /**
   * Import artifacts
   */
  async importArtifacts(artifactsData, mergeStrategy, results) {
    const dirs = ['planning', 'implementation', 'docs'];

    for (const dir of dirs) {
      if (!artifactsData[dir] || !artifactsData[dir].files) continue;

      const targetDir = path.join(this.bmadDir, `${dir}-artifacts`);
      if (dir === 'docs') {
        await fs.mkdir(path.join(this.bmadDir, 'docs'), { recursive: true });
      } else {
        await fs.mkdir(targetDir, { recursive: true });
      }

      for (const [filePath, fileData] of Object.entries(artifactsData[dir].files)) {
        const fullPath = dir === 'docs'
          ? path.join(this.bmadDir, 'docs', filePath)
          : path.join(targetDir, filePath);

        // Create parent directories
        await fs.mkdir(path.dirname(fullPath), { recursive: true });

        const action = await this.handleConflict(fullPath, mergeStrategy, results);
        if (action === 'skip') {
          results.skipped.push(filePath);
          continue;
        }

        await fs.writeFile(fullPath, fileData.content);
        results.imported.push(filePath);
      }
    }
  }

  /**
   * Import memories
   */
  async importMemories(memoriesData, mergeStrategy, results) {
    if (memoriesData.note) {
      results.warnings.push(memoriesData.note);
      return;
    }

    if (!memoriesData.files) return;

    const memoriesDir = path.join(this.bmadDir, 'memories');
    await fs.mkdir(memoriesDir, { recursive: true });

    for (const [filePath, fileData] of Object.entries(memoriesData.files)) {
      const fullPath = path.join(memoriesDir, filePath);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      const action = await this.handleConflict(fullPath, mergeStrategy, results);
      if (action === 'skip') {
        results.skipped.push(`memories/${filePath}`);
        continue;
      }

      await fs.writeFile(fullPath, fileData.content);
      results.imported.push(`memories/${filePath}`);
    }
  }

  /**
   * Handle file conflict based on merge strategy
   */
  async handleConflict(filePath, mergeStrategy, results) {
    try {
      await fs.access(filePath);
      // File exists

      switch (mergeStrategy) {
        case 'skip':
          return 'skip';

        case 'overwrite':
          return 'overwrite';

        case 'merge':
          return 'merge';

        default:
          results.conflicts.push(filePath);
          return 'skip';
      }
    } catch {
      // File doesn't exist
      return 'create';
    }
  }

  /**
   * Simple YAML serialization
   */
  toYaml(obj) {
    let result = '';
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        result += `${key}:\n`;
        for (const item of value) {
          result += `  - ${item}\n`;
        }
      } else {
        result += `${key}: ${value}\n`;
      }
    }
    return result;
  }
}

/**
 * Export/Import Manager
 * High-level API for export and import operations
 */
class ExportImportManager {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = options;
  }

  /**
   * Export project
   */
  async exportProject(format = EXPORT_FORMATS.FULL, outputPath = null) {
    const exporter = new ProjectExporter(this.projectPath, this.options);
    return exporter.export(format, outputPath);
  }

  /**
   * Import project
   */
  async importProject(exportPath, options = {}) {
    const importer = new ProjectImporter(this.projectPath, this.options);
    return importer.import(exportPath, options);
  }

  /**
   * Preview import (dry run)
   */
  async previewImport(exportPath) {
    let exportData;
    try {
      const content = await fs.readFile(exportPath, 'utf8');
      exportData = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read export file: ${error.message}`);
    }

    const importer = new ProjectImporter(this.projectPath);
    const validation = importer.validateExport(exportData);

    if (!validation.valid) {
      return {
        valid: false,
        reason: validation.reason
      };
    }

    // Count what would be imported
    const preview = {
      valid: true,
      format: exportData.format,
      exportedAt: exportData.exportedAt,
      sourceProject: exportData.projectName,
      contents: {}
    };

    if (exportData.data.config) {
      preview.contents.config = true;
    }

    if (exportData.data.workflowStatus) {
      preview.contents.workflowStatus = true;
    }

    if (exportData.data.artifacts) {
      preview.contents.artifacts = {
        planning: Object.keys(exportData.data.artifacts.planning?.files || {}).length,
        implementation: Object.keys(exportData.data.artifacts.implementation?.files || {}).length,
        docs: Object.keys(exportData.data.artifacts.docs?.files || {}).length
      };
    }

    if (exportData.data.memories) {
      preview.contents.memories = Object.keys(exportData.data.memories.files || {}).length;
    }

    return preview;
  }

  /**
   * List available export files in directory
   */
  async listExports(directory = '.') {
    const exports = [];

    try {
      const entries = await fs.readdir(directory);

      for (const entry of entries) {
        if (entry.endsWith(EXPORT_EXTENSION)) {
          const filePath = path.join(directory, entry);
          const stat = await fs.stat(filePath);

          exports.push({
            name: entry,
            path: filePath,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        }
      }
    } catch {
      // Directory might not exist
    }

    return exports;
  }

  /**
   * Format results for display
   */
  formatResults(results, operation) {
    const lines = [];

    lines.push(`## ${operation === 'export' ? 'Export' : 'Import'} Results\n`);

    if (operation === 'export') {
      lines.push(`**Path:** ${results.path}`);
      lines.push(`**Format:** ${results.format}`);
      lines.push(`**Size:** ${Math.round(results.size / 1024)} KB`);
      lines.push(`**Checksum:** ${results.checksum}`);
    } else {
      lines.push(`**Imported:** ${results.imported.length} files`);

      if (results.imported.length > 0) {
        lines.push('\n### Imported Files');
        for (const file of results.imported.slice(0, 10)) {
          lines.push(`- ${file}`);
        }
        if (results.imported.length > 10) {
          lines.push(`... and ${results.imported.length - 10} more`);
        }
      }

      if (results.skipped.length > 0) {
        lines.push(`\n**Skipped:** ${results.skipped.length} files (already exist)`);
      }

      if (results.conflicts.length > 0) {
        lines.push(`\n**Conflicts:** ${results.conflicts.length} files`);
      }

      if (results.warnings.length > 0) {
        lines.push('\n### Warnings');
        for (const warning of results.warnings) {
          lines.push(`- ${warning}`);
        }
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create export/import manager
 */
function createExportImportManager(projectPath, options = {}) {
  return new ExportImportManager(projectPath, options);
}

module.exports = {
  ProjectExporter,
  ProjectImporter,
  ExportImportManager,
  createExportImportManager,
  EXPORT_FORMATS,
  EXPORT_EXTENSION
};
