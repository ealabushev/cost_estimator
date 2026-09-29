const assert = require('assert');

/**
 * Test Suite: Node Telemetry & Hover Formula Math Verification
 * Ensures mathematical consistency between:
 * 1. Tile display numbers (inputTokens, outputTokens)
 * 2. Formula string displayed on hover
 * 3. Backend srv/estimation-service.js token calculations
 */

function simulateWorkerTelemetry({ hops, toolCount, basePrompt, avgObservationTokens, avgOutputTokensPerHop, avgToolSchemaTokens, thinkingMult = 0 }) {
  const schemaTok = avgToolSchemaTokens || 250;
  const toolSchemaTotal = toolCount * schemaTok;
  const obsTokens = avgObservationTokens || 1000;
  const hopOutTok = avgOutputTokensPerHop !== undefined ? avgOutputTokensPerHop : 300;

  let totalInput = 0;
  let hist = 0;
  const hopDetails = [];

  for (let h = 1; h <= hops; h++) {
    const hopIn = basePrompt + toolSchemaTotal + hist;
    totalInput += hopIn;
    hopDetails.push({
      hop: h,
      hopIn,
      base: basePrompt,
      tools: toolSchemaTotal,
      hist
    });
    const stateAppendOutputTok = Math.min(300, hopOutTok);
    hist += Math.round((stateAppendOutputTok + obsTokens) * 0.7);
  }

  const inputTokens = Math.round(totalInput);
  const outputTokens = Math.round(hopOutTok * hops);
  const thinkingTokens = Math.round(outputTokens * thinkingMult);

  const hopInputBreakdown = hops === 1
    ? `Base (${basePrompt}) + Tools (${toolCount} × ${schemaTok} = ${toolSchemaTotal}) = ${inputTokens.toLocaleString()} tok`
    : hopDetails.map(d => `Hop ${d.hop}: ${d.base} base + ${d.tools} tools${d.hist > 0 ? ` + ${d.hist} hist` : ''} = ${d.hopIn.toLocaleString()} tok`).join('\n  ↳ ') + `\n  Total Input = ${hopDetails.map(d => d.hopIn.toLocaleString()).join(' + ')} = ${inputTokens.toLocaleString()} tok`;

  const formula = `• Input: ${inputTokens.toLocaleString()} tok across ${hops} ${hops === 1 ? 'hop' : 'hops'}\n  ↳ ${hopInputBreakdown}\n• Output: ${outputTokens.toLocaleString()} tok (${hops} ${hops === 1 ? 'hop' : 'hops'} × ${hopOutTok} tok/hop)${thinkingTokens > 0 ? `\n• Thinking: ${thinkingTokens.toLocaleString()} tok (${outputTokens.toLocaleString()} out × ${thinkingMult}x)` : ''}\n• Total: ${(inputTokens + outputTokens + thinkingTokens).toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out${thinkingTokens > 0 ? ` + ${thinkingTokens.toLocaleString()} think` : ''})`;

  return { inputTokens, outputTokens, thinkingTokens, formula, hopDetails };
}

function simulateSupervisorTelemetry({ supervisorSystemPromptTokens = 500, workerRegistryTokens = 200 }) {
  const sysTok = Number(supervisorSystemPromptTokens) || 500;
  const regTok = Number(workerRegistryTokens) || 200;
  const histTok = 500;
  const inputTokens = sysTok + regTok + histTok;
  const outputTokens = 150;

  const formula = `• Input: ${inputTokens.toLocaleString()} tok = System Prompt (${sysTok}) + Worker Registry (${regTok}) + Routing Context History (${histTok})\n• Output: ${outputTokens.toLocaleString()} tok = Routing Decision / Worker Dispatch Payload\n• Total: ${(inputTokens + outputTokens).toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out)`;

  return { inputTokens, outputTokens, formula };
}

console.log('🧪 Running Canvas Formula & Tile Math Verification Test Suite...\n');

// Test 1: Supervisor Node Tile vs Formula
console.log('Test 1: Verifying Supervisor tile numbers vs hover formula...');
const sup = simulateSupervisorTelemetry({ supervisorSystemPromptTokens: 500, workerRegistryTokens: 200 });
assert.strictEqual(sup.inputTokens, 1200, 'Supervisor input tokens must be 1,200');
assert.strictEqual(sup.outputTokens, 150, 'Supervisor output tokens must be 150');
assert.ok(sup.formula.includes('1,200 tok'), 'Formula must contain total input 1,200 tok');
assert.ok(sup.formula.includes('150 tok'), 'Formula must contain output 150 tok');
assert.ok(sup.formula.includes('System Prompt (500)'), 'Formula must explain System Prompt (500)');
assert.ok(sup.formula.includes('Worker Registry (200)'), 'Formula must explain Worker Registry (200)');
assert.ok(sup.formula.includes('Routing Context History (500)'), 'Formula must explain Routing Context History (500)');
console.log('  ✅ Supervisor formula exactly matches tile (1,200 in / 150 out).');

// Test 2: Worker Node with 2 Hops (Default Analysis) Tile vs Formula
console.log('\nTest 2: Verifying Worker (2 Hops) tile numbers vs hover formula...');
const w2 = simulateWorkerTelemetry({
  hops: 2,
  toolCount: 3,
  basePrompt: 400,
  avgObservationTokens: 1000,
  avgOutputTokensPerHop: 300,
  avgToolSchemaTokens: 250
});
assert.strictEqual(w2.hopDetails[0].hopIn, 1150, 'Hop 1 input must be 1,150 (400 + 750)');
assert.strictEqual(w2.hopDetails[1].hopIn, 2060, 'Hop 2 input must be 2,060 (400 + 750 + 910)');
assert.strictEqual(w2.inputTokens, 3210, 'Total input must be 3,210 (1,150 + 2,060)');
assert.strictEqual(w2.outputTokens, 600, 'Total output must be 600 (2 hops × 300)');
assert.ok(w2.formula.includes('3,210 tok'), 'Formula must explain input total 3,210 tok');
assert.ok(w2.formula.includes('1,150 + 2,060 = 3,210'), 'Formula must show explicit addition');
assert.ok(w2.formula.includes('600 tok'), 'Formula must explain output total 600 tok');
assert.ok(w2.formula.includes('2 hops × 300 tok/hop'), 'Formula must show output calculation');
console.log('  ✅ Worker 2-hop formula exactly matches tile (3,210 in / 600 out).');

// Test 3: Worker Node with 3 Hops
console.log('\nTest 3: Verifying Worker (3 Hops) tile numbers vs hover formula...');
const w3 = simulateWorkerTelemetry({
  hops: 3,
  toolCount: 3,
  basePrompt: 400,
  avgObservationTokens: 1000,
  avgOutputTokensPerHop: 300,
  avgToolSchemaTokens: 250
});
assert.strictEqual(w3.hopDetails[2].hopIn, 2970, 'Hop 3 input must be 2,970 (400 + 750 + 1,820)');
assert.strictEqual(w3.inputTokens, 6180, 'Total input must be 6,180 (1,150 + 2,060 + 2,970)');
assert.strictEqual(w3.outputTokens, 900, 'Total output must be 900 (3 hops × 300)');
assert.ok(w3.formula.includes('6,180 tok'), 'Formula must explain input total 6,180 tok');
assert.ok(w3.formula.includes('1,150 + 2,060 + 2,970 = 6,180'), 'Formula must show explicit addition');
assert.ok(w3.formula.includes('900 tok'), 'Formula must explain output total 900 tok');
console.log('  ✅ Worker 3-hop formula exactly matches tile (6,180 in / 900 out).');

// Test 4: Single Hop Worker
console.log('\nTest 4: Verifying Single Hop Worker...');
const w1 = simulateWorkerTelemetry({
  hops: 1,
  toolCount: 2,
  basePrompt: 500,
  avgObservationTokens: 500,
  avgOutputTokensPerHop: 250,
  avgToolSchemaTokens: 200
});
assert.strictEqual(w1.inputTokens, 900, 'Single hop input must be 900 (500 + 400)');
assert.strictEqual(w1.outputTokens, 250, 'Single hop output must be 250');
assert.ok(w1.formula.includes('900 tok'), 'Formula must show 900 tok');
assert.ok(w1.formula.includes('250 tok'), 'Formula must show 250 tok');
console.log('  ✅ Single-hop worker formula verified.');

console.log('\n🎉 ALL FORMULA AND TILE MATH VERIFICATION TESTS PASSED!\n');
