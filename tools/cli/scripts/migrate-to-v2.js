#!/usr/bin/env node
/**
 * BMAD Schema v2 Migration Script
 *
 * Migrates agent and workflow files from v1 format to v2 frontmatter format.
 *
 * Usage:
 *   node migrate-to-v2.js --all              # Migrate all files
 *   node migrate-to-v2.js --agent <path>     # Migrate single agent
 *   node migrate-to-v2.js --workflow <path>  # Migrate single workflow
 *   node migrate-to-v2.js --dry-run          # Show what would be changed
 *   node migrate-to-v2.js --backup           # Create .v1.bak backups
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const BMAD_ROOT = path.resolve(__dirname, '../../../');

/**
 * v2 Schema structure
 */
const V2_SCHEMA = {
  version: '2.0',
  allowedTools: [
    'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
    'Task', 'WebFetch', 'WebSearch', 'NotebookEdit'
  ]
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    all: false,
    agent: null,
    workflow: null,
    dryRun: false,
    backup: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--all':
        options.all = true;
        break;
      case '--agent':
        options.agent = args[++i];
        break;
      case '--workflow':
        options.workflow = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--backup':
        options.backup = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
BMAD Schema v2 Migration Tool

Usage:
  node migrate-to-v2.js [options]

Options:
  --all             Migrate all agent and workflow files
  --agent <path>    Migrate a single agent file
  --workflow <path> Migrate a single workflow file
  --dry-run         Show changes without writing files
  --backup          Create .v1.bak backups before migrating
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  node migrate-to-v2.js --all --dry-run
  node migrate-to-v2.js --agent src/modules/bmm/agents/dev.agent.yaml --backup
  node migrate-to-v2.js --all --backup
`);
}

/**
 * Find all agent files
 */
function findAgentFiles(rootPath) {
  const results = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    // Skip test fixtures and samples
    if (dir.includes('test/fixtures') || dir.includes('samples/')) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.agent.yaml')) {
        results.push(fullPath);
      }
    }
  }

  walk(path.join(rootPath, 'src'));
  return results;
}

/**
 * Find all workflow files
 */
function findWorkflowFiles(rootPath) {
  const results = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    // Skip test fixtures and samples
    if (dir.includes('test/fixtures') || dir.includes('samples/')) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file === 'workflow.yaml') {
        results.push(fullPath);
      }
    }
  }

  walk(path.join(rootPath, 'src'));
  return results;
}

/**
 * Check if file is already v2 format
 */
function isV2Format(content) {
  return content.trim().startsWith('---') &&
         content.includes('bmad:') &&
         content.includes('version:');
}

/**
 * Extract module name from path
 */
function extractModule(filePath) {
  const match = filePath.match(/src\/modules\/([^/]+)/);
  return match ? match[1] : 'core';
}

/**
 * Extract id from path
 */
function extractId(filePath, type) {
  const relativePath = filePath.replace(BMAD_ROOT, '').replace(/^\//, '');
  const parts = relativePath.split('/');

  // Format: module/type/name
  const moduleIdx = parts.indexOf('modules');
  if (moduleIdx !== -1 && parts.length > moduleIdx + 2) {
    const module = parts[moduleIdx + 1];
    const name = path.basename(filePath, '.agent.yaml').replace('.yaml', '');
    return `${module}/${type}s/${name}`;
  }

  return relativePath;
}

/**
 * Migrate agent file to v2 format
 */
function migrateAgent(filePath, options) {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (isV2Format(content)) {
    if (options.verbose) {
      console.log(`  SKIP (already v2): ${filePath}`);
    }
    return { skipped: true };
  }

  // Parse existing YAML
  let parsed;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    console.error(`  ERROR parsing ${filePath}: ${err.message}`);
    return { error: err.message };
  }

  if (!parsed || !parsed.agent) {
    console.error(`  ERROR: No 'agent' key in ${filePath}`);
    return { error: 'No agent key' };
  }

  const agent = parsed.agent;
  const metadata = agent.metadata || {};

  // Build v2 frontmatter
  const bmadFrontmatter = {
    bmad: {
      version: '2.0',
      type: 'agent',
      id: extractId(filePath, 'agent'),
      name: metadata.name || path.basename(filePath, '.agent.yaml'),
      description: metadata.title || agent.persona?.role || '',
      module: extractModule(filePath),
      model: null,  // Optional override
      'allowed-tools': V2_SCHEMA.allowedTools,
      hooks: []
    }
  };

  // Preserve existing agent structure
  const agentContent = { agent };

  // Build new content with frontmatter
  const frontmatterYaml = yaml.dump(bmadFrontmatter, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  const agentYaml = yaml.dump(agentContent, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  const newContent = `---\n${frontmatterYaml}---\n\n${agentYaml}`;

  if (options.dryRun) {
    console.log(`\n--- Would migrate: ${filePath} ---`);
    if (options.verbose) {
      console.log(newContent.substring(0, 500) + '...\n');
    }
    return { dryRun: true };
  }

  // Backup if requested
  if (options.backup) {
    fs.writeFileSync(`${filePath}.v1.bak`, content);
  }

  // Write new content
  fs.writeFileSync(filePath, newContent);
  console.log(`  MIGRATED: ${filePath}`);

  return { migrated: true };
}

/**
 * Migrate workflow file to v2 format
 */
function migrateWorkflow(filePath, options) {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (isV2Format(content)) {
    if (options.verbose) {
      console.log(`  SKIP (already v2): ${filePath}`);
    }
    return { skipped: true };
  }

  // Parse existing YAML
  let parsed;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    console.error(`  ERROR parsing ${filePath}: ${err.message}`);
    return { error: err.message };
  }

  if (!parsed) {
    console.error(`  ERROR: Empty file ${filePath}`);
    return { error: 'Empty file' };
  }

  // Build v2 frontmatter
  const bmadFrontmatter = {
    bmad: {
      version: '2.0',
      type: 'workflow',
      id: extractId(filePath, 'workflow'),
      name: parsed.name || path.basename(path.dirname(filePath)),
      description: parsed.description || '',
      module: extractModule(filePath),
      aliases: parsed.aliases || [],
      'entry-point': parsed.entry_point || false,
      agent: parsed.agent || null,
      hooks: []
    }
  };

  // Keep workflow content without duplicated fields
  const workflowContent = { ...parsed };
  delete workflowContent.name;
  delete workflowContent.description;
  delete workflowContent.aliases;
  delete workflowContent.entry_point;
  delete workflowContent.agent;

  // Build new content with frontmatter
  const frontmatterYaml = yaml.dump(bmadFrontmatter, {
    indent: 2,
    lineWidth: 120,
    noRefs: true
  });

  let bodyContent = '';
  if (Object.keys(workflowContent).length > 0) {
    bodyContent = yaml.dump(workflowContent, {
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
  }

  const newContent = `---\n${frontmatterYaml}---\n\n${bodyContent}`;

  if (options.dryRun) {
    console.log(`\n--- Would migrate: ${filePath} ---`);
    if (options.verbose) {
      console.log(newContent.substring(0, 500) + '...\n');
    }
    return { dryRun: true };
  }

  // Backup if requested
  if (options.backup) {
    fs.writeFileSync(`${filePath}.v1.bak`, content);
  }

  // Write new content
  fs.writeFileSync(filePath, newContent);
  console.log(`  MIGRATED: ${filePath}`);

  return { migrated: true };
}

/**
 * Main migration function
 */
function main() {
  const options = parseArgs();

  if (!options.all && !options.agent && !options.workflow) {
    console.log('No migration target specified. Use --all, --agent, or --workflow');
    console.log('Use --help for more information');
    process.exit(1);
  }

  console.log('BMAD Schema v2 Migration');
  console.log('========================\n');

  if (options.dryRun) {
    console.log('DRY RUN MODE - No files will be modified\n');
  }

  const stats = {
    agents: { migrated: 0, skipped: 0, errors: 0 },
    workflows: { migrated: 0, skipped: 0, errors: 0 }
  };

  // Migrate specific agent
  if (options.agent) {
    console.log('Migrating agent:', options.agent);
    const result = migrateAgent(options.agent, options);
    if (result.migrated) stats.agents.migrated++;
    else if (result.skipped) stats.agents.skipped++;
    else if (result.error) stats.agents.errors++;
  }

  // Migrate specific workflow
  if (options.workflow) {
    console.log('Migrating workflow:', options.workflow);
    const result = migrateWorkflow(options.workflow, options);
    if (result.migrated) stats.workflows.migrated++;
    else if (result.skipped) stats.workflows.skipped++;
    else if (result.error) stats.workflows.errors++;
  }

  // Migrate all
  if (options.all) {
    // Agents
    console.log('Finding agent files...');
    const agentFiles = findAgentFiles(BMAD_ROOT);
    console.log(`Found ${agentFiles.length} agent files\n`);

    console.log('Migrating agents:');
    for (const file of agentFiles) {
      const result = migrateAgent(file, options);
      if (result.migrated || result.dryRun) stats.agents.migrated++;
      else if (result.skipped) stats.agents.skipped++;
      else if (result.error) stats.agents.errors++;
    }

    // Workflows
    console.log('\nFinding workflow files...');
    const workflowFiles = findWorkflowFiles(BMAD_ROOT);
    console.log(`Found ${workflowFiles.length} workflow files\n`);

    console.log('Migrating workflows:');
    for (const file of workflowFiles) {
      const result = migrateWorkflow(file, options);
      if (result.migrated || result.dryRun) stats.workflows.migrated++;
      else if (result.skipped) stats.workflows.skipped++;
      else if (result.error) stats.workflows.errors++;
    }
  }

  // Print summary
  console.log('\n========================');
  console.log('Migration Summary');
  console.log('========================');
  console.log(`Agents:    ${stats.agents.migrated} migrated, ${stats.agents.skipped} skipped, ${stats.agents.errors} errors`);
  console.log(`Workflows: ${stats.workflows.migrated} migrated, ${stats.workflows.skipped} skipped, ${stats.workflows.errors} errors`);

  if (options.dryRun) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  migrateAgent,
  migrateWorkflow,
  findAgentFiles,
  findWorkflowFiles,
  isV2Format
};
