const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { normalizeTracePayload, parseSpansToWorkflow } = require('../srv/telemetry-parser');

console.log('🧪 Running Telemetry Parser Test Suite...\n');

// 1. Test trace_sample.json
const samplePath = path.join(__dirname, 'http', 'trace_sample.json');
if (fs.existsSync(samplePath)) {
  console.log('Test 1: Parsing real-world Elasticsearch APM trace (trace_sample.json)...');
  const rawData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  const spans = normalizeTracePayload(rawData);
  assert.strictEqual(spans.length, 88, 'Should extract exactly 88 normalized spans');

  const { workflowConfigDraft, summary } = parseSpansToWorkflow(spans, {
    name: 'Procurement Assistant Baseline',
    baselineType: 'median_p50'
  });

  assert.strictEqual(summary.runsAnalyzed, 1, 'Should identify 1 trace run');
  assert.strictEqual(summary.workerCount, 1, 'Should extract 1 worker agent');
  assert.strictEqual(workflowConfigDraft.supervisorModelName, 'anthropic.claude-sonnet-4-5-20250929-v1:0', 'Should detect Claude 4.5 router model');

  const worker = workflowConfigDraft.workers[0];
  assert.strictEqual(worker.name, 'Procurement Insights Agent');
  assert.strictEqual(worker.toolCount, 3, 'Should detect 3 tools');
  assert.deepStrictEqual(worker.toolsDiscovered, ['generate_csv', 'generate_chart', 'get_data']);
  assert.strictEqual(worker.avgToolHops, 9, 'Should detect 9 tool hops');
  assert.strictEqual(worker.retryProbability, 0.78, 'Should detect 78% retry rate from error spans');
  assert(worker.basePromptTokens > 6000, 'Should detect empirical input token count');

  console.log('  ✅ trace_sample.json parsed and validated successfully.');
  console.log(`     Supervisor: ${workflowConfigDraft.supervisorModelName}`);
  console.log(`     Worker: ${worker.name} (${worker.toolsDiscovered.join(', ')})`);
  console.log(`     Avg Tool Hops: ${worker.avgToolHops}, Retry Rate: ${(worker.retryProbability * 100).toFixed(0)}%`);
}

// 2. Test standard OTLP format
console.log('\nTest 2: Parsing synthetic standard OTLP trace payload...');
const otlpPayload = {
  resourceSpans: [
    {
      scopeSpans: [
        {
          spans: [
            {
              traceId: 'tr-001',
              spanId: 'sp-sup',
              name: 'orchestrator_router',
              attributes: [
                { key: 'openinference.span.kind', value: { stringValue: 'CHAIN' } },
                { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } }
              ]
            },
            {
              traceId: 'tr-001',
              spanId: 'sp-w1',
              parentSpanId: 'sp-sup',
              name: 'execute_task SqlAnalyst',
              attributes: [
                { key: 'openinference.span.kind', value: { stringValue: 'CHAIN' } },
                { key: 'agent.name', value: { stringValue: 'SqlAnalyst' } },
                { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o-mini' } },
                { key: 'gen_ai.usage.input_tokens', value: { intValue: 1200 } },
                { key: 'gen_ai.usage.output_tokens', value: { intValue: 250 } }
              ]
            },
            {
              traceId: 'tr-001',
              spanId: 'sp-t1',
              parentSpanId: 'sp-w1',
              name: 'execute_tool execute_query',
              attributes: [
                { key: 'openinference.span.kind', value: { stringValue: 'TOOL' } },
                { key: 'tool.name', value: { stringValue: 'execute_query' } },
                { key: 'gen_ai.usage.output_tokens', value: { intValue: 400 } }
              ]
            }
          ]
        }
      ]
    }
  ]
};

const otlpSpans = normalizeTracePayload(otlpPayload);
assert.strictEqual(otlpSpans.length, 3, 'Should normalize 3 OTLP spans');
const otlpResult = parseSpansToWorkflow(otlpSpans, { name: 'OTLP Test Workflow' });
assert.strictEqual(otlpResult.summary.workerCount, 1);
assert.strictEqual(otlpResult.workflowConfigDraft.supervisorModelName, 'gpt-4o');
assert.strictEqual(otlpResult.workflowConfigDraft.workers[0].name, 'Sql Analyst');
assert.strictEqual(otlpResult.workflowConfigDraft.workers[0].toolCount, 1);
console.log('  ✅ OTLP trace parsing passed successfully.');

console.log('\n🎉 All Telemetry Parser tests passed!');
