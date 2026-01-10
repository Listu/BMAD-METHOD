/**
 * BMAD Orchestrator - Project Templates
 *
 * Provides pre-configured project templates for quick setup.
 * Includes built-in templates and support for custom templates.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Template categories
const TEMPLATE_CATEGORIES = {
  WEB: 'web',
  API: 'api',
  CLI: 'cli',
  LIBRARY: 'library',
  GAME: 'game',
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
  CUSTOM: 'custom'
};

// Built-in templates
const BUILTIN_TEMPLATES = {
  'web-react': {
    id: 'web-react',
    name: 'React Web Application',
    description: 'Modern React app with TypeScript, Vite, and testing setup',
    category: TEMPLATE_CATEGORIES.WEB,
    stack: ['react', 'typescript', 'vite', 'vitest'],
    structure: {
      directories: [
        'src/components',
        'src/hooks',
        'src/pages',
        'src/services',
        'src/utils',
        'src/types',
        'tests',
        'public'
      ],
      files: {
        'package.json': 'templates/web-react/package.json',
        'tsconfig.json': 'templates/web-react/tsconfig.json',
        'vite.config.ts': 'templates/web-react/vite.config.ts',
        'src/main.tsx': 'templates/web-react/main.tsx',
        'src/App.tsx': 'templates/web-react/App.tsx'
      }
    },
    workflows: ['create-prd', 'create-architecture', 'create-epics-and-stories'],
    bmadConfig: {
      level: 'standard',
      track: 'web'
    }
  },

  'api-node': {
    id: 'api-node',
    name: 'Node.js REST API',
    description: 'Express-based REST API with TypeScript and testing',
    category: TEMPLATE_CATEGORIES.API,
    stack: ['nodejs', 'express', 'typescript', 'jest'],
    structure: {
      directories: [
        'src/routes',
        'src/controllers',
        'src/services',
        'src/middleware',
        'src/models',
        'src/utils',
        'tests'
      ],
      files: {
        'package.json': 'templates/api-node/package.json',
        'tsconfig.json': 'templates/api-node/tsconfig.json',
        'src/index.ts': 'templates/api-node/index.ts',
        'src/app.ts': 'templates/api-node/app.ts'
      }
    },
    workflows: ['create-prd', 'create-architecture', 'create-epics-and-stories'],
    bmadConfig: {
      level: 'standard',
      track: 'api'
    }
  },

  'cli-node': {
    id: 'cli-node',
    name: 'Node.js CLI Tool',
    description: 'Command-line tool with Commander.js and interactive prompts',
    category: TEMPLATE_CATEGORIES.CLI,
    stack: ['nodejs', 'commander', 'typescript'],
    structure: {
      directories: [
        'src/commands',
        'src/utils',
        'tests'
      ],
      files: {
        'package.json': 'templates/cli-node/package.json',
        'tsconfig.json': 'templates/cli-node/tsconfig.json',
        'src/index.ts': 'templates/cli-node/index.ts',
        'src/cli.ts': 'templates/cli-node/cli.ts'
      }
    },
    workflows: ['create-prd', 'create-architecture', 'create-epics-and-stories'],
    bmadConfig: {
      level: 'standard',
      track: 'cli'
    }
  },

  'game-godot': {
    id: 'game-godot',
    name: 'Godot Game Project',
    description: 'Godot 4.x game project with organized scene structure',
    category: TEMPLATE_CATEGORIES.GAME,
    stack: ['godot', 'gdscript'],
    structure: {
      directories: [
        'scenes/levels',
        'scenes/ui',
        'scenes/entities',
        'scripts/autoloads',
        'scripts/entities',
        'scripts/systems',
        'resources/sprites',
        'resources/audio',
        'resources/fonts'
      ],
      files: {
        'project.godot': 'templates/game-godot/project.godot',
        'scripts/autoloads/game_manager.gd': 'templates/game-godot/game_manager.gd'
      }
    },
    workflows: ['game-brief', 'gdd', 'game-architecture'],
    bmadConfig: {
      level: 'standard',
      track: 'game',
      module: 'bmgd'
    }
  },

  'library-npm': {
    id: 'library-npm',
    name: 'NPM Package Library',
    description: 'Publishable NPM package with TypeScript and documentation',
    category: TEMPLATE_CATEGORIES.LIBRARY,
    stack: ['nodejs', 'typescript', 'rollup'],
    structure: {
      directories: [
        'src',
        'tests',
        'docs'
      ],
      files: {
        'package.json': 'templates/library-npm/package.json',
        'tsconfig.json': 'templates/library-npm/tsconfig.json',
        'rollup.config.js': 'templates/library-npm/rollup.config.js',
        'src/index.ts': 'templates/library-npm/index.ts'
      }
    },
    workflows: ['create-prd', 'create-architecture', 'create-epics-and-stories'],
    bmadConfig: {
      level: 'standard',
      track: 'library'
    }
  },

  'quick-prototype': {
    id: 'quick-prototype',
    name: 'Quick Prototype',
    description: 'Minimal setup for rapid prototyping - skip planning, just build',
    category: TEMPLATE_CATEGORIES.CUSTOM,
    stack: ['any'],
    structure: {
      directories: [
        'src',
        'tests'
      ],
      files: {}
    },
    workflows: ['quick-dev'],
    bmadConfig: {
      level: 'quick',
      track: 'prototype'
    }
  }
};

/**
 * Template Manager
 * Handles template discovery, selection, and instantiation
 */
class TemplateManager {
  constructor(options = {}) {
    this.options = options;
    this.customTemplatesDir = options.customTemplatesDir || null;
    this.templates = new Map();
    this.initialized = false;
  }

  /**
   * Initialize template manager
   */
  async init() {
    if (this.initialized) return;

    // Load built-in templates
    for (const [id, template] of Object.entries(BUILTIN_TEMPLATES)) {
      this.templates.set(id, { ...template, builtin: true });
    }

    // Load custom templates if directory provided
    if (this.customTemplatesDir) {
      await this.loadCustomTemplates();
    }

    this.initialized = true;
  }

  /**
   * Load custom templates from directory
   */
  async loadCustomTemplates() {
    try {
      const entries = await fs.readdir(this.customTemplatesDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const templatePath = path.join(this.customTemplatesDir, entry.name);
        const configPath = path.join(templatePath, 'template.json');

        try {
          const configContent = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(configContent);

          const template = {
            id: config.id || entry.name,
            name: config.name || entry.name,
            description: config.description || '',
            category: config.category || TEMPLATE_CATEGORIES.CUSTOM,
            stack: config.stack || [],
            structure: config.structure || { directories: [], files: {} },
            workflows: config.workflows || [],
            bmadConfig: config.bmadConfig || { level: 'standard' },
            builtin: false,
            customPath: templatePath
          };

          this.templates.set(template.id, template);
        } catch {
          // Skip invalid templates
        }
      }
    } catch {
      // Custom templates directory might not exist
    }
  }

  /**
   * List all available templates
   */
  async listTemplates(filter = {}) {
    await this.init();

    let templates = Array.from(this.templates.values());

    if (filter.category) {
      templates = templates.filter(t => t.category === filter.category);
    }

    if (filter.stack) {
      templates = templates.filter(t =>
        t.stack.some(s => s.toLowerCase().includes(filter.stack.toLowerCase()))
      );
    }

    if (filter.builtin !== undefined) {
      templates = templates.filter(t => t.builtin === filter.builtin);
    }

    return templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      stack: t.stack,
      builtin: t.builtin
    }));
  }

  /**
   * Get a specific template
   */
  async getTemplate(templateId) {
    await this.init();
    return this.templates.get(templateId) || null;
  }

  /**
   * Instantiate a template into a project directory
   */
  async instantiate(templateId, targetPath, options = {}) {
    await this.init();

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const projectName = options.name || path.basename(targetPath);

    // Create target directory
    await fs.mkdir(targetPath, { recursive: true });

    // Create directory structure
    for (const dir of template.structure.directories) {
      await fs.mkdir(path.join(targetPath, dir), { recursive: true });
    }

    // Create BMAD directory structure
    await this.createBmadStructure(targetPath, template, projectName, options);

    // Copy/generate template files
    await this.createTemplateFiles(targetPath, template, projectName, options);

    // Generate workflow status
    await this.createWorkflowStatus(targetPath, template, projectName);

    return {
      success: true,
      path: targetPath,
      template: templateId,
      projectName,
      nextSteps: this.getNextSteps(template)
    };
  }

  /**
   * Create BMAD directory structure
   */
  async createBmadStructure(targetPath, template, projectName, options) {
    const bmadDir = path.join(targetPath, '_bmad');
    await fs.mkdir(bmadDir, { recursive: true });

    // Create subdirectories
    const bmadSubdirs = [
      'docs',
      'planning-artifacts',
      'implementation-artifacts'
    ];

    for (const subdir of bmadSubdirs) {
      await fs.mkdir(path.join(bmadDir, subdir), { recursive: true });
    }

    // Create project config
    const projectConfig = {
      name: projectName,
      created: new Date().toISOString(),
      template: template.id,
      level: template.bmadConfig.level,
      track: template.bmadConfig.track,
      module: template.bmadConfig.module || 'bmm',
      description: options.description || template.description
    };

    await fs.writeFile(
      path.join(bmadDir, 'project.yaml'),
      this.toYaml(projectConfig)
    );
  }

  /**
   * Create template files with variable substitution
   */
  async createTemplateFiles(targetPath, template, projectName, options) {
    const variables = {
      PROJECT_NAME: projectName,
      PROJECT_DESCRIPTION: options.description || template.description,
      CREATED_DATE: new Date().toISOString().split('T')[0],
      TEMPLATE_ID: template.id,
      ...options.variables
    };

    // For built-in templates, generate basic files
    if (template.builtin) {
      await this.generateBuiltinFiles(targetPath, template, variables);
    } else if (template.customPath) {
      // For custom templates, copy from template directory
      await this.copyCustomFiles(targetPath, template, variables);
    }
  }

  /**
   * Generate files for built-in templates
   */
  async generateBuiltinFiles(targetPath, template, variables) {
    // Generate package.json for Node.js projects
    if (template.stack.includes('nodejs') || template.stack.includes('typescript')) {
      const packageJson = {
        name: variables.PROJECT_NAME.toLowerCase().replace(/\s+/g, '-'),
        version: '0.1.0',
        description: variables.PROJECT_DESCRIPTION,
        main: 'dist/index.js',
        scripts: {
          build: 'tsc',
          test: 'jest',
          dev: 'ts-node src/index.ts'
        },
        keywords: [],
        author: '',
        license: 'MIT',
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0'
        }
      };

      // Add framework-specific dependencies
      if (template.stack.includes('express')) {
        packageJson.dependencies = { express: '^4.18.0' };
        packageJson.devDependencies['@types/express'] = '^4.17.0';
      }

      if (template.stack.includes('react')) {
        packageJson.dependencies = {
          react: '^18.0.0',
          'react-dom': '^18.0.0'
        };
        packageJson.devDependencies['@types/react'] = '^18.0.0';
        packageJson.devDependencies['@types/react-dom'] = '^18.0.0';
      }

      await fs.writeFile(
        path.join(targetPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
    }

    // Generate tsconfig.json for TypeScript projects
    if (template.stack.includes('typescript')) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          lib: ['ES2020'],
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          declaration: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist', 'tests']
      };

      await fs.writeFile(
        path.join(targetPath, 'tsconfig.json'),
        JSON.stringify(tsconfig, null, 2)
      );
    }

    // Generate README.md
    const readme = `# ${variables.PROJECT_NAME}

${variables.PROJECT_DESCRIPTION}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Project Structure

This project was generated from the \`${template.id}\` BMAD template.

## Development

- \`npm run build\` - Build the project
- \`npm test\` - Run tests
- \`npm run dev\` - Start development server

---

Generated with BMAD Orchestrator
`;

    await fs.writeFile(path.join(targetPath, 'README.md'), readme);

    // Generate .gitignore
    const gitignore = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
`;

    await fs.writeFile(path.join(targetPath, '.gitignore'), gitignore);
  }

  /**
   * Copy files from custom template directory
   */
  async copyCustomFiles(targetPath, template, variables) {
    const templateFilesDir = path.join(template.customPath, 'files');

    try {
      await this.copyDirectoryRecursive(templateFilesDir, targetPath, variables);
    } catch {
      // Template might not have a files directory
    }
  }

  /**
   * Recursively copy directory with variable substitution
   */
  async copyDirectoryRecursive(src, dest, variables) {
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(destPath, { recursive: true });
        await this.copyDirectoryRecursive(srcPath, destPath, variables);
      } else {
        let content = await fs.readFile(srcPath, 'utf8');

        // Substitute variables
        for (const [key, value] of Object.entries(variables)) {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        await fs.writeFile(destPath, content);
      }
    }
  }

  /**
   * Create initial workflow status file
   */
  async createWorkflowStatus(targetPath, template, projectName) {
    const status = {
      project: projectName,
      template: template.id,
      level: template.bmadConfig.level,
      track: template.bmadConfig.track,
      current_phase: 'initialization',
      next_workflow: template.workflows[0] || 'create-product-brief',
      completed: [],
      pending: template.workflows,
      created: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(targetPath, '_bmad', 'workflow-status.yaml'),
      this.toYaml(status)
    );
  }

  /**
   * Get next steps after template instantiation
   */
  getNextSteps(template) {
    const steps = [
      `cd into the project directory`,
      `Run \`npm install\` (if applicable)`,
      `Start the first workflow: \`${template.workflows[0] || 'create-product-brief'}\``
    ];

    if (template.category === TEMPLATE_CATEGORIES.GAME) {
      steps.push('Open project in Godot/Unity');
    }

    return steps;
  }

  /**
   * Simple YAML serialization
   */
  toYaml(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    let result = '';

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        result += `${spaces}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            result += `${spaces}  -\n${this.toYaml(item, indent + 2)}`;
          } else {
            result += `${spaces}  - ${item}\n`;
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        result += `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
      } else {
        result += `${spaces}${key}: ${value}\n`;
      }
    }

    return result;
  }

  /**
   * Format templates for display
   */
  formatTemplateList(templates) {
    const lines = ['## Available Templates\n'];

    const byCategory = {};
    for (const template of templates) {
      const cat = template.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(template);
    }

    for (const [category, categoryTemplates] of Object.entries(byCategory)) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`);

      for (const t of categoryTemplates) {
        const badge = t.builtin ? '' : ' [custom]';
        lines.push(`- **${t.id}**${badge}: ${t.name}`);
        lines.push(`  ${t.description}`);
        lines.push(`  Stack: ${t.stack.join(', ')}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create template manager with default configuration
 */
function createTemplateManager(options = {}) {
  return new TemplateManager(options);
}

module.exports = {
  TemplateManager,
  createTemplateManager,
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES
};
