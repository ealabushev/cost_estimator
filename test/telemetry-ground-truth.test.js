const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('🧪 Running Telemetry Ground Truth Verification Test Suite...\n');

  const baseUrl = 'http://localhost:4004/api/v1/estimation';
  const sampleTracePath = path.join(__dirname, 'http', 'trace_sample.json');
  const rawTrace = fs.readFileSync(sampleTracePath, 'utf8');

  // Test 1: Create template with raw telemetry data
  console.log('Test 1: Create template from telemetry data and verify ground truth in DB...');
  const createRes = await fetch(`${baseUrl}/createTemplateFromTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ground Truth Test Template',
      project: 'Ground Truth Verification',
      description: 'Testing that ground truth tokens are not 0',
      telemetryData: rawTrace,
      baselineType: 'median_p50',
      retryCalibrationMode: 'baked_in'
    })
  });

  assert.strictEqual(createRes.status, 200, 'createTemplateFromTelemetry should return HTTP 200');
  const createData = await createRes.json();
  const templateId = createData.templateId;
  assert.ok(templateId, 'Template ID must be generated');

  // Test 2: Fetch template from WorkflowConfigs and verify telemetryMetadata
  console.log('\nTest 2: Query WorkflowConfigs and verify telemetryMetadata fields...');
  const getRes = await fetch(`${baseUrl}/WorkflowConfigs(${templateId})`);
  assert.strictEqual(getRes.status, 200);
  const tpl = await getRes.json();

  assert.ok(tpl.telemetryMetadata, 'telemetryMetadata must not be null/empty');
  const parsedMeta = typeof tpl.telemetryMetadata === 'string' ? JSON.parse(tpl.telemetryMetadata) : tpl.telemetryMetadata;

  console.log('  Parsed telemetryMetadata:', {
    runsAnalyzed: parsedMeta.runsAnalyzed,
    totalSpansProcessed: parsedMeta.totalSpansProcessed,
    totalInputTokens: parsedMeta.totalInputTokens,
    totalOutputTokens: parsedMeta.totalOutputTokens,
    avgInputTokensPerRun: parsedMeta.avgInputTokensPerRun,
    avgOutputTokensPerRun: parsedMeta.avgOutputTokensPerRun
  });

  assert.strictEqual(parsedMeta.runsAnalyzed, 1, 'runsAnalyzed should be 1');
  assert.strictEqual(parsedMeta.totalSpansProcessed, 88, 'totalSpansProcessed should be 88');
  assert.strictEqual(parsedMeta.totalInputTokens, 69511, 'totalInputTokens must match trace ground truth (69511)');
  assert.strictEqual(parsedMeta.totalOutputTokens, 9171, 'totalOutputTokens must match trace ground truth (9171)');
  assert.strictEqual(parsedMeta.avgInputTokensPerRun, 69511, 'avgInputTokensPerRun must be 69511');
  assert.strictEqual(parsedMeta.avgOutputTokensPerRun, 9171, 'avgOutputTokensPerRun must be 9171');

  const totalGroundTruthTokens = (parsedMeta.avgInputTokensPerRun || parsedMeta.totalInputTokens) +
                                 (parsedMeta.avgOutputTokensPerRun || parsedMeta.totalOutputTokens);
  assert.strictEqual(totalGroundTruthTokens, 78682, 'Total ground truth tokens must be exactly 78,682 (NOT 0!)');
  console.log(`  ✅ Ground truth tokens verified: ${totalGroundTruthTokens.toLocaleString()} tokens (${parsedMeta.avgInputTokensPerRun.toLocaleString()} in · ${parsedMeta.avgOutputTokensPerRun.toLocaleString()} out)`);

  // Test 3: Test saving with client-calibrated workflowDraft
  console.log('\nTest 3: Create template using workflowDraft payload...');
  const mockDraft = {
    name: 'Client Calibrated Template',
    project: 'Client Project',
    executionMode: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'standard',
    expectedRoutingCycles: 4,
    supervisorModelName: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    supervisorSystemPromptTokens: 500,
    telemetryMetadata: {
      source: 'OpenTelemetry Trace Logs',
      runsAnalyzed: 3,
      totalSpansProcessed: 250,
      totalInputTokens: 150000,
      totalOutputTokens: 30000,
      avgInputTokensPerRun: 50000,
      avgOutputTokensPerRun: 10000,
      baselineType: 'median_p50',
      retryCalibrationMode: 'baked_in'
    },
    workers: [
      {
        name: 'Procurement Specialist',
        toolCount: 3,
        taskType: 'analysis',
        avgToolHops: 5,
        avgObservationTokens: 1500,
        basePromptTokens: 800,
        avgOutputTokensPerHop: 400,
        retryProbability: 0.1
      }
    ]
  };

  const createDraftRes = await fetch(`${baseUrl}/createTemplateFromTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: mockDraft.name,
      project: mockDraft.project,
      description: 'Template created with client workflowDraft',
      workflowDraft: JSON.stringify(mockDraft),
      baselineType: 'median_p50'
    })
  });

  assert.strictEqual(createDraftRes.status, 200);
  const draftCreateData = await createDraftRes.json();
  const draftTplId = draftCreateData.templateId;

  const getDraftTplRes = await fetch(`${baseUrl}/WorkflowConfigs(${draftTplId})?$expand=workers`);
  const draftTpl = await getDraftTplRes.json();
  const draftMeta = typeof draftTpl.telemetryMetadata === 'string' ? JSON.parse(draftTpl.telemetryMetadata) : draftTpl.telemetryMetadata;

  assert.strictEqual(draftMeta.runsAnalyzed, 3);
  assert.strictEqual(draftMeta.avgInputTokensPerRun, 50000);
  assert.strictEqual(draftMeta.avgOutputTokensPerRun, 10000);
  const draftTotalTokens = draftMeta.avgInputTokensPerRun + draftMeta.avgOutputTokensPerRun;
  assert.strictEqual(draftTotalTokens, 60000);
  console.log(`  ✅ Client workflowDraft ground truth verified: ${draftTotalTokens.toLocaleString()} tokens/run across ${draftMeta.runsAnalyzed} runs.`);

  // Cleanup
  await fetch(`${baseUrl}/deleteTemplate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ templateId }) });
  await fetch(`${baseUrl}/deleteTemplate`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ templateId: draftTplId }) });
  console.log('  ✅ Cleaned up test templates.');

  console.log('\n🎉 ALL TELEMETRY GROUND TRUTH TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
