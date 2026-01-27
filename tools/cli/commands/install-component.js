#!/usr/bin/env node
/**
 * BMAD Component Installer
 *
 * Granular installation of individual BMAD components.
 * Supports: agents, workflows, skills, hooks
 *
 * Usage:
 *   npx bmad-install --agent dev           # Install dev agent
 *   npx bmad-install --workflow dev-story  # Install dev-story workflow
 *   npx bmad-install --skill planning      # Install planning skill
 *   npx bmad-install --hook pre-commit     # Install pre-commit hook
 *   npx bmad-install --list agents         # List available agents
 */

const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { getProjectRoot, getSourcePath } = require('../lib/project-root');

/**
 * Component types
 */
const ComponentType = {
  AGENT: 'agent',
  WORKFLOW: 'workflow',
  SKILL: 'skill',
  HOOK: 'hook'
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    component: null,
    type: null,
    list: null,
    projectDir: process.cwd(),
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--agent':
        options.type = ComponentType.AGENT;
        options.component = args[++i];
        break;
      case '--workflow':
        options.type = ComponentType.WORKFLOW;
        options.component = args[++i];
        break;
      case '--skill':
        options.type = ComponentType.SKILL;
        options.component = args[++i];
        break;
      case '--hook':
        options.type = ComponentType.HOOK;
        options.component = args[++i];
        break;
      case '--list':
        options.list = args[++i];
        break;
      case '--project':
      case '-p':
        options.projectDir = args[++i];
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${chalk.bold('BMAD Component Installer')}

Install individual BMAD components into your project.

${chalk.bold('Usage:')}
  npx bmad-install [options]

${chalk.bold('Options:')}
  --agent <name>      Install a specific agent
  --workflow <name>   Install a specific workflow
  --skill <name>      Install a specific skill
  --hook <name>       Install a specific hook
  --list <type>       List available components (agents, workflows, skills, hooks)
  --project, -p       Target project directory (default: current directory)
  --verbose, -v       Show detailed output
  --help, -h          Show this help message

${chalk.bold('Examples:')}
  npx bmad-install --list agents
  npx bmad-install --agent dev
  npx bmad-install --workflow dev-story
  npx bmad-install --skill planning-with-files
  npx bmad-install --hook validate-file-path

${chalk.bold('Available Components:')}
  Use --list <type> to see available components for each type.
`);
}

/**
 * Find all available agents
 */
async function findAgents(sourcePath) {
  const agents = [];
  const modulesDir = path.join(sourcePath, 'src', 'modules');

  if (!fs.existsSync(modulesDir)) return agents;

  const modules = fs.readdirSync(modulesDir);
  for (const mod of modules) {
    const agentsDir = path.join(modulesDir, mod, 'agents');
    if (!fs.existsSync(agentsDir)) continue;

    const files = fs.readdirSync(agentsDir);
    for (const file of files) {
      if (file.endsWith('.agent.yaml')) {
        agents.push({
          name: file.replace('.agent.yaml', ''),
          module: mod,
          path: path.join(agentsDir, file)
        });
      }
    }
  }

  return agents;
}

/**
 * Find all available workflows
 */
async function findWorkflows(sourcePath) {
  const workflows = [];
  const modulesDir = path.join(sourcePath, 'src', 'modules');

  if (!fs.existsSync(modulesDir)) return workflows;

  const modules = fs.readdirSync(modulesDir);
  for (const mod of modules) {
    const workflowsDir = path.join(modulesDir, mod, 'workflows');
    if (!fs.existsSync(workflowsDir)) continue;

    const walkDir = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
        } else if (entry.name === 'workflow.yaml') {
          workflows.push({
            name: prefix || path.basename(dir),
            module: mod,
            path: dir
          });
        }
      }
    };

    walkDir(workflowsDir);
  }

  return workflows;
}

/**
 * Find all available skills
 */
async function findSkills(sourcePath) {
  const skills = [];
  const skillsDir = path.join(sourcePath, 'src', 'skills');

  if (!fs.existsSync(skillsDir)) return skills;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillYaml = path.join(skillsDir, entry.name, 'skill.yaml');
    if (fs.existsSync(skillYaml)) {
      skills.push({
        name: entry.name,
        path: path.join(skillsDir, entry.name)
      });
    }
  }

  return skills;
}

/**
 * Find all available hooks
 */
async function findHooks(sourcePath) {
  const hooks = [];
  const hooksDir = path.join(sourcePath, 'src', 'core', 'hooks', 'builtin');

  if (!fs.existsSync(hooksDir)) return hooks;

  const files = fs.readdirSync(hooksDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      hooks.push({
        name: file.replace('.js', ''),
        path: path.join(hooksDir, file)
      });
    }
  }

  return hooks;
}

/**
 * List available components
 */
async function listComponents(type, sourcePath) {
  let components;
  let typeName;

  switch (type) {
    case 'agents':
      components = await findAgents(sourcePath);
      typeName = 'Agents';
      break;
    case 'workflows':
      components = await findWorkflows(sourcePath);
      typeName = 'Workflows';
      break;
    case 'skills':
      components = await findSkills(sourcePath);
      typeName = 'Skills';
      break;
    case 'hooks':
      components = await findHooks(sourcePath);
      typeName = 'Hooks';
      break;
    default:
      console.error(chalk.red(`Unknown component type: ${type}`));
      console.log('Valid types: agents, workflows, skills, hooks');
      return;
  }

  console.log(`\n${chalk.bold(`Available ${typeName}:`)}\n`);

  if (components.length === 0) {
    console.log(chalk.gray('  No components found'));
    return;
  }

  for (const comp of components) {
    const module = comp.module ? chalk.gray(` (${comp.module})`) : '';
    console.log(`  ${chalk.cyan(comp.name)}${module}`);
  }

  console.log('');
}

/**
 * Install an agent
 */
async function installAgent(name, sourcePath, targetDir, verbose) {
  const agents = await findAgents(sourcePath);
  const agent = agents.find(a => a.name === name || a.name.includes(name));

  if (!agent) {
    console.error(chalk.red(`Agent not found: ${name}`));
    console.log('Use --list agents to see available agents');
    return false;
  }

  const targetPath = path.join(targetDir, '_bmad', agent.module, 'agents', `${agent.name}.agent.yaml`);

  await fs.ensureDir(path.dirname(targetPath));
  await fs.copy(agent.path, targetPath);

  console.log(chalk.green(`Installed agent: ${agent.name}`));
  if (verbose) {
    console.log(chalk.gray(`  From: ${agent.path}`));
    console.log(chalk.gray(`  To: ${targetPath}`));
  }

  return true;
}

/**
 * Install a workflow
 */
async function installWorkflow(name, sourcePath, targetDir, verbose) {
  const workflows = await findWorkflows(sourcePath);
  const workflow = workflows.find(w => w.name === name || w.name.includes(name));

  if (!workflow) {
    console.error(chalk.red(`Workflow not found: ${name}`));
    console.log('Use --list workflows to see available workflows');
    return false;
  }

  const targetPath = path.join(targetDir, '_bmad', workflow.module, 'workflows', workflow.name);

  await fs.ensureDir(targetPath);
  await fs.copy(workflow.path, targetPath);

  console.log(chalk.green(`Installed workflow: ${workflow.name}`));
  if (verbose) {
    console.log(chalk.gray(`  From: ${workflow.path}`));
    console.log(chalk.gray(`  To: ${targetPath}`));
  }

  return true;
}

/**
 * Install a skill
 */
async function installSkill(name, sourcePath, targetDir, verbose) {
  const skills = await findSkills(sourcePath);
  const skill = skills.find(s => s.name === name || s.name.includes(name));

  if (!skill) {
    console.error(chalk.red(`Skill not found: ${name}`));
    console.log('Use --list skills to see available skills');
    return false;
  }

  const targetPath = path.join(targetDir, '_bmad', 'skills', skill.name);

  await fs.ensureDir(targetPath);
  await fs.copy(skill.path, targetPath);

  console.log(chalk.green(`Installed skill: ${skill.name}`));
  if (verbose) {
    console.log(chalk.gray(`  From: ${skill.path}`));
    console.log(chalk.gray(`  To: ${targetPath}`));
  }

  return true;
}

/**
 * Install a hook
 */
async function installHook(name, sourcePath, targetDir, verbose) {
  const hooks = await findHooks(sourcePath);
  const hook = hooks.find(h => h.name === name || h.name.includes(name));

  if (!hook) {
    console.error(chalk.red(`Hook not found: ${name}`));
    console.log('Use --list hooks to see available hooks');
    return false;
  }

  const targetPath = path.join(targetDir, '_bmad', 'hooks', 'builtin', `${hook.name}.js`);

  await fs.ensureDir(path.dirname(targetPath));
  await fs.copy(hook.path, targetPath);

  console.log(chalk.green(`Installed hook: ${hook.name}`));
  if (verbose) {
    console.log(chalk.gray(`  From: ${hook.path}`));
    console.log(chalk.gray(`  To: ${targetPath}`));
  }

  return true;
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Get BMAD source path
  let sourcePath;
  try {
    sourcePath = getSourcePath();
  } catch (err) {
    // Fallback to relative path from this file
    sourcePath = path.resolve(__dirname, '../../../');
  }

  // Handle list command
  if (options.list) {
    await listComponents(options.list, sourcePath);
    return;
  }

  // Validate component selection
  if (!options.type || !options.component) {
    console.error(chalk.red('No component specified'));
    console.log('Use --help for usage information');
    process.exit(1);
  }

  console.log(chalk.bold('\nBMAD Component Installer\n'));

  // Install the component
  let success = false;
  switch (options.type) {
    case ComponentType.AGENT:
      success = await installAgent(options.component, sourcePath, options.projectDir, options.verbose);
      break;
    case ComponentType.WORKFLOW:
      success = await installWorkflow(options.component, sourcePath, options.projectDir, options.verbose);
      break;
    case ComponentType.SKILL:
      success = await installSkill(options.component, sourcePath, options.projectDir, options.verbose);
      break;
    case ComponentType.HOOK:
      success = await installHook(options.component, sourcePath, options.projectDir, options.verbose);
      break;
  }

  if (success) {
    console.log(chalk.green('\nInstallation complete!'));
  } else {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  findAgents,
  findWorkflows,
  findSkills,
  findHooks,
  installAgent,
  installWorkflow,
  installSkill,
  installHook,
  listComponents
};
