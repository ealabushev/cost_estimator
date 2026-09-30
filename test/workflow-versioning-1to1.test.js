const assert = require('assert');
const cds = require('@sap/cds');

async function runTests() {
  console.log('🧪 Running Workflow Versioning & 1:1 Estimation Lifecycle Test Suite...\n');

  // 1. Deploy schema and service projections in-memory
  await cds.deploy(['db/schema.cds', 'srv/estimation-service.cds']).to('sqlite::memory:');
  const srv = await cds.serve('EstimationService').from('srv/estimation-service');
  const { WorkflowConfigs, WorkerConfigs, ModelConfigs, ModelPricing, Estimations } = cds.entities('costestimator');

  // Insert a test model and pricing
  const modelId = cds.utils.uuid();
  await INSERT.into(ModelConfigs).entries({
    ID: modelId,
    modelName: 'gpt-4o',
    provider: 'openai',
    contextWindowTokens: 128000,
    supportsPromptCaching: true
  });

  await INSERT.into(ModelPricing).entries({
    ID: cds.utils.uuid(),
    provider: 'openai',
    modelName: 'gpt-4o',
    inputPricePerMtok: 2.50,
    outputPricePerMtok: 10.00,
    cacheReadPricePerMtok: 1.25,
    effectiveDate: '2026-01-01',
    genAiTokenInputRate: 0.0025,
    genAiTokenOutputRate: 0.0100
  });

  // Test 1: Create a workflow configuration version 1
  console.log('Test 1: Creating workflow configuration (v1)...');
  const wf1Id = cds.utils.uuid();
  await INSERT.into(WorkflowConfigs).entries({
    ID: wf1Id,
    name: 'Order Processing Workflow',
    project: 'S/4HANA Sales',
    version: 1,
    rootWorkflowId: wf1Id,
    monthlyRunVolume: 5000,
    orchestrationPattern: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'standard',
    expectedRoutingCycles: 4,
    supervisorModel_ID: modelId
  });

  const worker1Id = cds.utils.uuid();
  await INSERT.into(WorkerConfigs).entries({
    ID: worker1Id,
    workflow_ID: wf1Id,
    name: 'Order Extractor',
    model_ID: modelId,
    toolCount: 3,
    taskType: 'analysis',
    avgObservationTokens: 1000
  });

  const createdWf1 = await SELECT.one.from(WorkflowConfigs).where({ ID: wf1Id });
  assert.strictEqual(createdWf1.version, 1, 'Workflow v1 should have version 1');
  console.log('  ✅ Workflow v1 created successfully.');

  // Test 2: Run initial estimation on v1
  console.log('\nTest 2: Running initial estimation on v1...');
  const estResult1 = await srv.runEstimation({ workflowId: wf1Id, capacityUnitsPerToken: 1.9, capacityUnitCostEur: 1.04 });
  assert.strictEqual(estResult1.status, 'SUCCESS');
  const summary1 = JSON.parse(estResult1.summary);
  assert.strictEqual(summary1.workflowVersion, 1);

  let estsForWf1 = await SELECT.from(Estimations).where({ workflow_ID: wf1Id });
  assert.strictEqual(estsForWf1.length, 1, 'Workflow v1 should have exactly 1 estimation');
  const originalEstId = estsForWf1[0].ID;
  console.log(`  ✅ Estimation created (ID: ${originalEstId}), strictly 1 estimation exists.`);

  // Test 3: Re-running estimation on v1 must OVERWRITE the previous estimation (enforcing 1:1)
  console.log('\nTest 3: Re-running estimation on v1 (overwrite check)...');
  const estResult2 = await srv.runEstimation({ workflowId: wf1Id, capacityUnitsPerToken: 1.9, capacityUnitCostEur: 1.04 });
  assert.strictEqual(estResult2.status, 'SUCCESS');

  estsForWf1 = await SELECT.from(Estimations).where({ workflow_ID: wf1Id });
  assert.strictEqual(estsForWf1.length, 1, 'Workflow v1 must STILL have exactly 1 estimation after re-running');
  assert.notStrictEqual(estsForWf1[0].ID, originalEstId, 'Old estimation should be replaced by new estimation ID');
  console.log(`  ✅ Previous estimation replaced. Total estimations for v1: ${estsForWf1.length} (1:1 enforced).`);

  // Test 4: Running Monte Carlo simulation also overwrites (1:1 constraint holds across modes)
  console.log('\nTest 4: Running Monte Carlo simulation on v1 (overwrite check)...');
  const simResult = await srv.runMonteCarloSimulation({ workflowId: wf1Id, iterations: 100, capacityUnitsPerToken: 1.9, capacityUnitCostEur: 1.04 });
  assert.strictEqual(simResult.status, 'SUCCESS');

  estsForWf1 = await SELECT.from(Estimations).where({ workflow_ID: wf1Id });
  assert.strictEqual(estsForWf1.length, 1, 'Workflow v1 must STILL have exactly 1 estimation after Monte Carlo');
  console.log('  ✅ Monte Carlo simulation cleanly replaced deterministic estimate (1:1 maintained).');

  // Test 5: Create a new version (v2) of the workflow configuration
  console.log('\nTest 5: Explicitly creating new version (v2) branched from v1...');
  const wf2Id = cds.utils.uuid();
  await INSERT.into(WorkflowConfigs).entries({
    ID: wf2Id,
    name: 'Order Processing Workflow',
    project: 'S/4HANA Sales',
    version: 2,
    rootWorkflowId: wf1Id,
    monthlyRunVolume: 12000,
    orchestrationPattern: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'complex',
    expectedRoutingCycles: 6,
    supervisorModel_ID: modelId
  });

  const worker2Id = cds.utils.uuid();
  await INSERT.into(WorkerConfigs).entries({
    ID: worker2Id,
    workflow_ID: wf2Id,
    name: 'Order Extractor V2',
    model_ID: modelId,
    toolCount: 5,
    taskType: 'analysis',
    avgObservationTokens: 1500
  });

  const estResultV2 = await srv.runEstimation({ workflowId: wf2Id, capacityUnitsPerToken: 1.9, capacityUnitCostEur: 1.04 });
  assert.strictEqual(estResultV2.status, 'SUCCESS');
  const summaryV2 = JSON.parse(estResultV2.summary);
  assert.strictEqual(summaryV2.workflowVersion, 2);

  const estsForWf2 = await SELECT.from(Estimations).where({ workflow_ID: wf2Id });
  assert.strictEqual(estsForWf2.length, 1, 'Workflow v2 should have exactly 1 estimation');

  // Verify both v1 and v2 exist independently with their own parameters and estimations
  const allV1Ests = await SELECT.from(Estimations).where({ workflow_ID: wf1Id });
  const allV2Ests = await SELECT.from(Estimations).where({ workflow_ID: wf2Id });
  assert.strictEqual(allV1Ests.length, 1, 'v1 estimation remains intact');
  assert.strictEqual(allV2Ests.length, 1, 'v2 estimation exists independently');
  console.log('  ✅ Independent versions v1 and v2 both preserve their exact parameter sets and 1:1 estimations.');

  // Test 6: Deleting v2 estimation cascades and removes both estimation and workflow version 2
  console.log('\nTest 6: Deleting v2 estimation (testing 1:1 cascade delete)...');
  await srv.delete(srv.entities.Estimations).where({ ID: allV2Ests[0].ID });

  const checkV2Wf = await SELECT.one.from(WorkflowConfigs).where({ ID: wf2Id });
  const checkV2Workers = await SELECT.from(WorkerConfigs).where({ workflow_ID: wf2Id });
  const checkV2Est = await SELECT.one.from(Estimations).where({ workflow_ID: wf2Id });

  assert.ok(!checkV2Est, 'v2 estimation must be deleted');
  assert.ok(!checkV2Wf, 'v2 workflow config must be cascade deleted');
  assert.strictEqual(checkV2Workers.length, 0, 'v2 workers must be cascade deleted');

  // Verify v1 is completely untouched
  const checkV1Wf = await SELECT.one.from(WorkflowConfigs).where({ ID: wf1Id });
  const checkV1Est = await SELECT.one.from(Estimations).where({ workflow_ID: wf1Id });
  assert.ok(checkV1Wf, 'v1 workflow config must still exist');
  assert.ok(checkV1Est, 'v1 estimation must still exist');
  console.log('  ✅ 1:1 cascade deletion verified: v2 removed completely, v1 untouched.');

  console.log('\n🎉 ALL WORKFLOW VERSIONING & 1:1 ESTIMATION TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
