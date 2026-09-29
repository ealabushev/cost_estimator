const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('🧪 Running Template Deletion HTTP Test Suite against http://localhost:4004...\n');

  const baseUrl = 'http://localhost:4004/api/v1/estimation';
  const sampleTracePath = path.join(__dirname, 'http', 'trace_sample.json');
  const rawTrace = fs.readFileSync(sampleTracePath, 'utf8');

  // Test 1: Create template from telemetry
  console.log('Test 1: Create template from telemetry trace...');
  const createRes = await fetch(`${baseUrl}/createTemplateFromTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration Test Template',
      project: 'Testing Project',
      description: 'Template created for deletion verification',
      telemetryData: rawTrace,
      baselineType: 'median_p50'
    })
  });

  assert.strictEqual(createRes.status, 200, 'createTemplateFromTelemetry should return HTTP 200');
  const createData = await createRes.json();
  assert.ok(createData.templateId, 'Should return templateId');
  const templateId = createData.templateId;
  console.log(`  ✅ Template created successfully: ${templateId}`);

  // Test 2: Verify template appears in WorkflowConfigs?$filter=isTemplate eq true
  console.log('\nTest 2: Verify template in WorkflowConfigs query...');
  const listRes = await fetch(`${baseUrl}/WorkflowConfigs?$filter=isTemplate eq true&$expand=workers`);
  assert.strictEqual(listRes.status, 200);
  const listData = await listRes.json();
  const found = (listData.value || []).find(t => t.ID === templateId);
  assert.ok(found, 'Created template must appear in isTemplate eq true query');
  assert.strictEqual(found.name, 'Integration Test Template');
  assert.ok(found.workers?.length > 0, 'Template must have expanded workers');
  console.log(`  ✅ Template confirmed in database with ${found.workers.length} worker(s).`);

  // Test 3: Delete template using action deleteTemplate
  console.log('\nTest 3: Delete template using action deleteTemplate...');
  const deleteRes = await fetch(`${baseUrl}/deleteTemplate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId })
  });

  assert.strictEqual(deleteRes.status, 200, 'deleteTemplate action should return HTTP 200');
  const deleteData = await deleteRes.json();
  assert.strictEqual(deleteData.status, 'SUCCESS');
  console.log(`  ✅ Action response: ${deleteData.message}`);

  // Test 4: Verify template no longer exists
  console.log('\nTest 4: Verify template and workers are removed from database...');
  const checkTplRes = await fetch(`${baseUrl}/WorkflowConfigs(${templateId})`);
  assert.strictEqual(checkTplRes.status, 404, 'Deleted template must return 404');

  const checkWorkersRes = await fetch(`${baseUrl}/WorkerConfigs?$filter=workflow_ID eq ${templateId}`);
  assert.strictEqual(checkWorkersRes.status, 200);
  const workersData = await checkWorkersRes.json();
  assert.strictEqual(workersData.value.length, 0, 'Associated workers must be completely deleted');
  console.log('  ✅ Verified template and workers are completely removed.');

  // Test 5: Delete non-existent template
  console.log('\nTest 5: Verify delete non-existent template error handling...');
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const badDeleteRes = await fetch(`${baseUrl}/deleteTemplate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: fakeId })
  });
  assert.strictEqual(badDeleteRes.status, 404, 'Deleting non-existent template should return 404');
  console.log('  ✅ Correctly returned 404 for non-existent template.');

  // Test 6: Standard OData DELETE /WorkflowConfigs(id)
  console.log('\nTest 6: Test standard OData DELETE /WorkflowConfigs(id)...');
  const createSecondRes = await fetch(`${baseUrl}/createTemplateFromTelemetry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Second Template for OData DELETE',
      project: 'Testing Project',
      description: 'Second template',
      telemetryData: rawTrace,
      baselineType: 'median_p50'
    })
  });
  const secondData = await createSecondRes.json();
  const secondId = secondData.templateId;

  const odataDeleteRes = await fetch(`${baseUrl}/WorkflowConfigs(${secondId})`, {
    method: 'DELETE'
  });
  assert.ok(odataDeleteRes.status === 204 || odataDeleteRes.status === 200, 'OData DELETE should succeed (204 or 200)');

  const checkSecondTplRes = await fetch(`${baseUrl}/WorkflowConfigs(${secondId})`);
  assert.strictEqual(checkSecondTplRes.status, 404, 'OData deleted template must return 404');

  const checkSecondWorkersRes = await fetch(`${baseUrl}/WorkerConfigs?$filter=workflow_ID eq ${secondId}`);
  const secondWorkersData = await checkSecondWorkersRes.json();
  assert.strictEqual(secondWorkersData.value.length, 0, 'Workers must be removed via before DELETE hook');
  console.log('  ✅ Standard OData DELETE /WorkflowConfigs(id) succeeded with worker cleanup.');

  console.log('\n🎉 ALL TEMPLATE DELETION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
