/**
 * BMAD Orchestrator - Integration Tests
 *
 * Basic tests to verify the orchestrator modules work correctly.
 * Run with: node orchestrator.test.js
 */

const path = require('path');
const { ProjectRegistry } = require('../registry');
const { IntentDetector } = require('../intent');
const { Router } = require('../router');
const { createOrchestrator } = require('../index');

// Test project path (current BMAD-METHOD directory)
const TEST_PROJECT_PATH = path.resolve(__dirname, '../../../../..');

// Test utilities
let testCount = 0;
let passCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
  }
}

function assertTruthy(value, message = '') {
  if (!value) {
    throw new Error(`Expected truthy value, got ${value}. ${message}`);
  }
}

// ============================================================================
// Intent Detector Tests
// ============================================================================
async function testIntentDetector() {
  console.log('\n📋 Intent Detector Tests');

  const detector = new IntentDetector(path.join(TEST_PROJECT_PATH, 'src/modules/orchestrator/data'));
  await detector.init();

  await asyncTest('detects "continue" intent', async () => {
    const result = await detector.detectIntent('continue');
    assertEqual(result.category, 'continue', 'Should detect continue intent');
    assertTruthy(result.confidence >= 0.7, 'Should have high confidence');
  });

  await asyncTest('detects "status" intent', async () => {
    const result = await detector.detectIntent('where are we?');
    assertEqual(result.category, 'status', 'Should detect status intent');
  });

  await asyncTest('detects "help" intent', async () => {
    const result = await detector.detectIntent('help');
    assertEqual(result.category, 'help', 'Should detect help intent');
  });

  await asyncTest('detects workflow keyword "prd"', async () => {
    const result = await detector.detectIntent('create a prd');
    assertEqual(result.category, 'specific_workflow', 'Should detect specific workflow');
  });

  await asyncTest('handles unknown input', async () => {
    const result = await detector.detectIntent('xyzzy random gibberish');
    assertTruthy(result.confidence < 0.5, 'Should have low confidence for unknown');
  });
}

// ============================================================================
// Registry Tests
// ============================================================================
async function testRegistry() {
  console.log('\n📁 Registry Tests');

  // Use a temporary registry path for testing
  const os = require('os');
  const testRegistryPath = path.join(os.tmpdir(), '.bmad-test-' + Date.now());

  const registry = new ProjectRegistry(testRegistryPath);

  await asyncTest('initializes registry', async () => {
    await registry.init();
    const fs = require('fs').promises;
    const exists = await fs.access(path.join(testRegistryPath, 'registry.yaml'))
      .then(() => true)
      .catch(() => false);
    assertTruthy(exists, 'Registry file should exist');
  });

  await asyncTest('lists empty projects', async () => {
    const projects = await registry.listProjects();
    assertEqual(projects.builtIn.length + projects.custom.length, 0, 'Should have no projects initially');
  });

  await asyncTest('validates BMAD project', async () => {
    const validation = await registry.validateBmadProject(TEST_PROJECT_PATH);
    assertTruthy(validation.valid, 'Should validate BMAD project');
  });

  // Cleanup
  const fs = require('fs').promises;
  await fs.rm(testRegistryPath, { recursive: true, force: true });
}

// ============================================================================
// Router Tests
// ============================================================================
async function testRouter() {
  console.log('\n🔀 Router Tests');

  const router = new Router(TEST_PROJECT_PATH);
  await router.init();

  await asyncTest('routes "continue" to next workflow', async () => {
    const decision = await router.route('continue');
    assertTruthy(decision.action, 'Should have an action');
    assertTruthy(['invoke', 'clarify'].includes(decision.action), 'Should route to invoke or clarify');
  });

  await asyncTest('routes "status" to workflow-status', async () => {
    const decision = await router.route('status');
    assertTruthy(decision.action, 'Should have an action');
  });

  await asyncTest('routes "help" to help action', async () => {
    const decision = await router.route('help');
    assertEqual(decision.action, 'help', 'Should route to help');
  });

  await asyncTest('includes confidence in decisions', async () => {
    const decision = await router.route('create a prd');
    assertTruthy(typeof decision.confidence === 'number', 'Should include confidence');
  });
}

// ============================================================================
// Full Orchestrator Tests
// ============================================================================
async function testOrchestrator() {
  console.log('\n🎯 Full Orchestrator Tests');

  const os = require('os');
  const testRegistryPath = path.join(os.tmpdir(), '.bmad-orch-test-' + Date.now());

  await asyncTest('creates orchestrator instance', async () => {
    const orchestrator = await createOrchestrator(TEST_PROJECT_PATH, {
      registryPath: testRegistryPath
    });
    assertTruthy(orchestrator, 'Should create orchestrator');
    assertTruthy(orchestrator.registry, 'Should have registry');
    assertTruthy(orchestrator.router, 'Should have router');
    assertTruthy(orchestrator.executor, 'Should have executor');
  });

  await asyncTest('processes natural language input', async () => {
    const orchestrator = await createOrchestrator(TEST_PROJECT_PATH, {
      registryPath: testRegistryPath
    });
    const result = await orchestrator.process('show status');
    assertTruthy(result.decision, 'Should have decision');
    assertTruthy(result.result, 'Should have result');
  });

  await asyncTest('gets project status', async () => {
    const orchestrator = await createOrchestrator(TEST_PROJECT_PATH, {
      registryPath: testRegistryPath
    });
    const status = await orchestrator.getStatus();
    assertTruthy(typeof status === 'object', 'Should return status object');
  });

  // Cleanup
  const fs = require('fs').promises;
  await fs.rm(testRegistryPath, { recursive: true, force: true });
}

// ============================================================================
// Run All Tests
// ============================================================================
async function runTests() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  BMAD Orchestrator - Integration Tests');
  console.log('═══════════════════════════════════════════════════');

  try {
    await testIntentDetector();
    await testRegistry();
    await testRouter();
    await testOrchestrator();

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  Results: ${passCount}/${testCount} tests passed`);
    console.log('═══════════════════════════════════════════════════');

    if (passCount < testCount) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
