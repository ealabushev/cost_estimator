/**
 * Client-Side OpenTelemetry & OpenInference Trace Parser & Derivation Engine
 * Enables instantaneous local preview, parameter derivation, and visual inspection.
 */

export function unwrapOtelValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object') {
    if ('stringValue' in val) return val.stringValue;
    if ('intValue' in val) return Number(val.intValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('boolValue' in val) return Boolean(val.boolValue);
    if ('arrayValue' in val && Array.isArray(val.arrayValue.values)) {
      return val.arrayValue.values.map(unwrapOtelValue);
    }
  }
  return val;
}

export function normalizeAttributes(attrs) {
  if (!attrs) return {};
  if (Array.isArray(attrs)) {
    const map = {};
    for (const item of attrs) {
      if (item && item.key) {
        map[item.key] = unwrapOtelValue(item.value);
      }
    }
    return map;
  }
  if (typeof attrs === 'object') {
    const map = {};
    for (const [k, v] of Object.entries(attrs)) {
      map[k] = unwrapOtelValue(v);
    }
    return map;
  }
  return {};
}

export function estimateTokensFromText(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.max(1, Math.ceil(str.length / 3.8));
}

export function calculatePercentiles(numbers) {
  if (!numbers || numbers.length === 0) return { p50: 0, p90: 0, mean: 0, min: 0, max: 0 };
  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  const getP = (p) => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    if (upper === lower) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    p50: Math.round(getP(0.50) * 10) / 10,
    p90: Math.round(getP(0.90) * 10) / 10,
    mean: Math.round(mean * 10) / 10,
    min,
    max
  };
}

export function standardizeSpan(raw, parentResourceAttrs = {}) {
  const attrs = {
    ...parentResourceAttrs,
    ...normalizeAttributes(raw.attributes || raw.tags)
  };

  const spanId = raw.spanId || raw.id || raw.span_id || String(Math.random()).slice(2, 10);
  const traceId = raw.traceId || raw.trace_id || raw.trace || 'default_trace';
  const parentSpanId = raw.parentSpanId || raw.parentId || raw.parent_span_id || null;
  const name = raw.name || raw.operation_name || 'unnamed_span';

  let startTimeMs = 0;
  let endTimeMs = 0;

  if (raw.startTimeUnixNano) startTimeMs = Number(BigInt(raw.startTimeUnixNano) / 1000000n);
  else if (raw.start_time) startTimeMs = new Date(raw.start_time).getTime();
  else if (raw.timestamp) startTimeMs = new Date(raw.timestamp).getTime();

  if (raw.endTimeUnixNano) endTimeMs = Number(BigInt(raw.endTimeUnixNano) / 1000000n);
  else if (raw.end_time) endTimeMs = new Date(raw.end_time).getTime();
  else endTimeMs = startTimeMs + 100;

  const isError = raw.status?.code === 2 || 
                  raw.status?.code === 'ERROR' || 
                  raw.status === 'ERROR' || 
                  raw.error === true || 
                  Boolean(attrs['error']) || 
                  Boolean(attrs['exception.type']);

  const modelName = attrs['gen_ai.request.model'] || 
                    attrs['gen_ai.response.model'] || 
                    attrs['llm.model_name'] || 
                    attrs['model'] || 
                    attrs['request.model'] || null;

  const inputTokens = Number(attrs['gen_ai.usage.input_tokens'] || attrs['llm.token_count.prompt'] || attrs['prompt_tokens'] || 0);
  const outputTokens = Number(attrs['gen_ai.usage.output_tokens'] || attrs['llm.token_count.completion'] || attrs['completion_tokens'] || 0);
  const cacheReadTokens = Number(attrs['gen_ai.usage.cache_read_input_tokens'] || attrs['cache_read_input_tokens'] || 0);

  const toolName = attrs['tool.name'] || attrs['gen_ai.tool.name'] || attrs['tool'] || null;
  const toolInput = attrs['tool.input'] || attrs['tool_input'] || null;
  const toolOutput = attrs['tool.output'] || attrs['tool_output'] || null;

  const spanKind = attrs['openinference.span.kind'] || 
                   attrs['traceloop.span.kind'] || 
                   attrs['span.kind'] || 
                   raw.kind || 
                   (toolName ? 'TOOL' : (modelName ? 'LLM' : 'INTERNAL'));

  return {
    spanId,
    traceId,
    parentSpanId,
    name,
    startTimeMs,
    endTimeMs,
    durationMs: Math.max(0, endTimeMs - startTimeMs),
    isError,
    attrs,
    modelName,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    toolName,
    toolInput,
    toolOutput,
    spanKind: String(spanKind).toUpperCase()
  };
}

export function normalizeTracePayload(payload) {
  let rawData = payload;
  if (typeof rawData === 'string') {
    const trimmed = rawData.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        rawData = JSON.parse(trimmed);
      } catch (err) {
        const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
        const parsedLines = [];
        for (const line of lines) {
          try {
            parsedLines.push(JSON.parse(line.trim()));
          } catch {
            // ignore malformed line
          }
        }
        if (parsedLines.length > 0) {
          rawData = parsedLines;
        } else {
          throw new Error('Invalid JSON or JSONL telemetry payload: ' + err.message);
        }
      }
    } else {
      throw new Error('Unsupported telemetry format: expected JSON or JSONL');
    }
  }

  const normalizedSpans = [];

  if (rawData && rawData.resourceSpans && Array.isArray(rawData.resourceSpans)) {
    for (const resSpan of rawData.resourceSpans) {
      const resAttrs = normalizeAttributes(resSpan.resource?.attributes);
      const scopeSpans = resSpan.scopeSpans || [];
      for (const scopeSpan of scopeSpans) {
        const spans = scopeSpan.spans || [];
        for (const s of spans) {
          normalizedSpans.push(standardizeSpan(s, resAttrs));
        }
      }
    }
    return normalizedSpans;
  }

  if (Array.isArray(rawData)) {
    for (const item of rawData) {
      if (item.spans && Array.isArray(item.spans)) {
        for (const s of item.spans) normalizedSpans.push(standardizeSpan(s));
      } else if (item.spanId || item.id || item.name) {
        normalizedSpans.push(standardizeSpan(item));
      }
    }
    return normalizedSpans;
  }

  if (rawData.spanId || rawData.id || rawData.name) {
    normalizedSpans.push(standardizeSpan(rawData));
    return normalizedSpans;
  }

  throw new Error('No valid spans found in telemetry payload');
}

function getDescendantSpans(parentSpanId, childrenMap) {
  const descendants = [];
  const queue = [...(childrenMap.get(parentSpanId) || [])];
  while (queue.length > 0) {
    const child = queue.shift();
    descendants.push(child);
    const grandChildren = childrenMap.get(child.spanId);
    if (grandChildren && grandChildren.length > 0) {
      queue.push(...grandChildren);
    }
  }
  return descendants;
}

function formatAgentName(raw) {
  if (!raw) return 'Agent Worker';
  const clean = String(raw).replace(/[_-]+/g, ' ').trim();
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getDominantItem(arr) {
  if (!arr || arr.length === 0) return null;
  const counts = {};
  let maxCount = 0;
  let dominant = arr[0];
  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      dominant = item;
    }
  }
  return dominant;
}

export function classifyWorkerTaskType(workerName, tools, avgHops, avgObsTokens) {
  const lowerName = workerName.toLowerCase();
  const toolNames = tools.map(t => t.toLowerCase()).join(' ');

  if (toolNames.includes('bapi') || toolNames.includes('odata') || toolNames.includes('batch') || lowerName.includes('poster') || lowerName.includes('pipeline')) {
    return avgObsTokens > 3000 ? 'erp_data_pipeline' : 'transformation';
  }
  if (toolNames.includes('vector') || toolNames.includes('search') || toolNames.includes('retriev') || toolNames.includes('kb') || lowerName.includes('extract') || lowerName.includes('reader')) {
    return 'retrieval_response';
  }
  if (avgHops >= 4 || lowerName.includes('reason') || lowerName.includes('reconciliation') || lowerName.includes('matching')) {
    return 'multi_step_reasoning';
  }
  if (avgHops <= 1 && tools.length <= 1) {
    return 'simple_lookup';
  }
  return 'analysis';
}

export function classifyComplexityProfile(expectedRoutingCycles, workerCount) {
  if (expectedRoutingCycles <= 2 && workerCount <= 2) return 'simple';
  if (expectedRoutingCycles <= 5) return 'standard';
  if (expectedRoutingCycles <= 9) return 'complex';
  return 'research_heavy';
}

export function parseSpansToWorkflow(spans, options = {}) {
  const baselineType = options.baselineType || 'median_p50';

  if (!spans || spans.length === 0) {
    throw new Error('No spans available to parse');
  }

  const tracesMap = new Map();
  for (const span of spans) {
    if (!tracesMap.has(span.traceId)) {
      tracesMap.set(span.traceId, []);
    }
    tracesMap.get(span.traceId).push(span);
  }

  const runStats = [];
  const allSupervisorModels = [];
  const discoveredWorkersMap = new Map();
  let totalCacheReadTokens = 0;
  let totalInputTokensAcrossAll = 0;
  let hasParallelExecutions = false;

  for (const [traceId, traceSpans] of tracesMap.entries()) {
    const spanMap = new Map();
    const childrenMap = new Map();
    for (const s of traceSpans) {
      spanMap.set(s.spanId, s);
      if (!childrenMap.has(s.parentSpanId)) {
        childrenMap.set(s.parentSpanId, []);
      }
      childrenMap.get(s.parentSpanId).push(s);
    }

    let rootSpans = traceSpans.filter(s => !s.parentSpanId || !spanMap.has(s.parentSpanId));
    if (rootSpans.length === 0) rootSpans = [traceSpans[0]];

    let supervisorSpan = rootSpans.find(s => 
      s.spanKind === 'AGENT' || 
      /supervisor|router|orchestrator|coordinator|main/i.test(s.name)
    ) || rootSpans[0];

    let supModel = supervisorSpan.modelName;
    if (!supModel) {
      const children = childrenMap.get(supervisorSpan.spanId) || [];
      const llmChild = children.find(c => c.modelName);
      if (llmChild) supModel = llmChild.modelName;
    }
    if (supModel) allSupervisorModels.push(supModel);

    const workerSpansInRun = [];
    for (const s of traceSpans) {
      if (s.spanId === supervisorSpan.spanId) continue;

      const isAgent = s.spanKind === 'AGENT' || 
                      s.attrs['langgraph.node'] || 
                      s.attrs['traceloop.entity.name'] ||
                      /worker|agent|validator|extractor|poster|specialist|analyzer/i.test(s.name);

      const hasTools = (childrenMap.get(s.spanId) || []).some(c => c.toolName || c.spanKind === 'TOOL');

      if (isAgent || hasTools) {
        workerSpansInRun.push(s);
      }
    }

    if (workerSpansInRun.length === 0) {
      const llmSpans = traceSpans.filter(s => s.spanId !== supervisorSpan.spanId && s.modelName);
      for (const s of llmSpans) {
        workerSpansInRun.push(s);
      }
    }

    // Check concurrency
    for (let i = 0; i < workerSpansInRun.length; i++) {
      for (let j = i + 1; j < workerSpansInRun.length; j++) {
        const w1 = workerSpansInRun[i];
        const w2 = workerSpansInRun[j];
        if (w1.startTimeMs < w2.endTimeMs && w2.startTimeMs < w1.endTimeMs) {
          hasParallelExecutions = true;
        }
      }
    }

    const routingCyclesInRun = Math.max(1, workerSpansInRun.length);

    for (const wSpan of workerSpansInRun) {
      const rawName = wSpan.attrs['langgraph.node'] || 
                      wSpan.attrs['traceloop.entity.name'] || 
                      wSpan.attrs['agent.name'] || 
                      wSpan.name;

      const formattedName = formatAgentName(rawName);

      if (!discoveredWorkersMap.has(formattedName)) {
        discoveredWorkersMap.set(formattedName, {
          name: formattedName,
          models: [],
          toolsSet: new Set(),
          hopsList: [],
          observationTokensList: [],
          promptTokensList: [],
          outputTokensList: [],
          errorsCount: 0,
          totalInvocations: 0,
          refinementLoopsList: []
        });
      }

      const wEntry = discoveredWorkersMap.get(formattedName);
      wEntry.totalInvocations += 1;
      if (wSpan.isError) wEntry.errorsCount += 1;

      const descendants = getDescendantSpans(wSpan.spanId, childrenMap);
      const allSpansInWorker = [wSpan, ...descendants];

      let workerModel = wSpan.modelName;
      for (const d of descendants) {
        if (d.modelName) {
          workerModel = d.modelName;
          break;
        }
      }
      if (workerModel) wEntry.models.push(workerModel);

      const toolSpans = allSpansInWorker.filter(s => s.toolName || s.spanKind === 'TOOL');
      wEntry.hopsList.push(toolSpans.length);

      for (const ts of toolSpans) {
        const tName = ts.toolName || ts.name || 'tool';
        wEntry.toolsSet.add(tName);

        let obsTokens = ts.outputTokens;
        if (!obsTokens && ts.toolOutput) {
          obsTokens = estimateTokensFromText(ts.toolOutput);
        }
        if (!obsTokens && ts.attrs['tool.output']) {
          obsTokens = estimateTokensFromText(ts.attrs['tool.output']);
        }
        if (obsTokens > 0) {
          wEntry.observationTokensList.push(obsTokens);
        }
      }

      const promptToks = wSpan.inputTokens || (descendants[0]?.inputTokens || 0);
      if (promptToks > 0) wEntry.promptTokensList.push(promptToks);

      const llmSpans = allSpansInWorker.filter(s => s.outputTokens > 0);
      for (const ls of llmSpans) {
        wEntry.outputTokensList.push(ls.outputTokens);
      }

      if (llmSpans.length > 1 && toolSpans.length === 0) {
        wEntry.refinementLoopsList.push(llmSpans.length);
      }

      for (const s of allSpansInWorker) {
        totalCacheReadTokens += s.cacheReadTokens || 0;
        totalInputTokensAcrossAll += s.inputTokens || 0;
      }
    }

    runStats.push({
      traceId,
      routingCycles: routingCyclesInRun,
      workerCount: workerSpansInRun.length,
      spanCount: traceSpans.length
    });
  }

  const routingCyclesDist = calculatePercentiles(runStats.map(r => r.routingCycles));
  const chosenCycles = baselineType === 'conservative_p90' ? routingCyclesDist.p90 : routingCyclesDist.p50;

  const supervisorModelName = getDominantItem(allSupervisorModels) || 'gpt-4o';

  const derivedWorkers = [];
  for (const [wName, wData] of discoveredWorkersMap.entries()) {
    const hopsDist = calculatePercentiles(wData.hopsList);
    const obsDist = calculatePercentiles(wData.observationTokensList);
    const promptDist = calculatePercentiles(wData.promptTokensList);
    const outDist = calculatePercentiles(wData.outputTokensList);
    const refinementDist = calculatePercentiles(wData.refinementLoopsList);

    const chosenHops = baselineType === 'conservative_p90' ? hopsDist.p90 : hopsDist.p50;
    const chosenObs = baselineType === 'conservative_p90' ? obsDist.p90 : obsDist.p50;
    const chosenPrompt = baselineType === 'conservative_p90' ? promptDist.p90 : promptDist.p50;
    const chosenOut = baselineType === 'conservative_p90' ? outDist.p90 : outDist.p50;

    const retryProb = wData.totalInvocations > 0 
      ? Math.min(1.0, Math.round((wData.errorsCount / wData.totalInvocations) * 100) / 100)
      : 0.10;

    const isReflector = refinementDist.mean >= 2;
    const refinementIterations = isReflector ? Math.round(refinementDist.mean) : 1;

    const toolArray = Array.from(wData.toolsSet);
    const toolCount = Math.max(toolArray.length, chosenHops > 0 ? 1 : 0);
    const dominantWorkerModel = getDominantItem(wData.models) || 'gpt-4o-mini';

    const taskType = classifyWorkerTaskType(wName, toolArray, chosenHops, chosenObs || 1000);

    derivedWorkers.push({
      ID: `w-${derivedWorkers.length + 1}`,
      name: wName,
      modelName: dominantWorkerModel,
      taskType,
      toolCount,
      toolsDiscovered: toolArray,
      avgToolHops: chosenHops || 1.0,
      useCustomToolHops: true,
      avgObservationTokens: chosenObs || 1000,
      basePromptTokens: chosenPrompt || 400,
      avgOutputTokensPerHop: chosenOut || 300,
      retryProbability: retryProb || 0.05,
      executionMode: hasParallelExecutions ? 'parallel_map_reduce' : 'sequential',
      parallelInstances: hasParallelExecutions ? 2 : 1,
      isReflectorNode: isReflector,
      refinementIterations
    });
  }

  if (derivedWorkers.length === 0) {
    derivedWorkers.push({
      ID: 'w-1',
      name: 'Worker Agent 1',
      modelName: 'gpt-4o-mini',
      taskType: 'analysis',
      toolCount: 2,
      toolsDiscovered: ['query_database'],
      avgToolHops: 2.0,
      useCustomToolHops: true,
      avgObservationTokens: 1200,
      basePromptTokens: 400,
      avgOutputTokensPerHop: 300,
      retryProbability: 0.10,
      executionMode: 'sequential',
      parallelInstances: 1,
      isReflectorNode: false,
      refinementIterations: 1
    });
  }

  const cacheHitRate = totalInputTokensAcrossAll > 0
    ? Math.min(1.0, Math.round((totalCacheReadTokens / totalInputTokensAcrossAll) * 100) / 100)
    : 0.0;

  const complexityProfile = classifyComplexityProfile(chosenCycles, derivedWorkers.length);
  const executionMode = hasParallelExecutions ? 'parallel_map_reduce' : 'sequential';

  const workflowConfigDraft = {
    name: options.name || `Calibrated Workflow (${derivedWorkers.length} Agents)`,
    project: options.project || 'Telemetry Ingested',
    orchestrationPattern: 'subagents_router',
    executionMode,
    stateMode: 'scoped_subgraph',
    complexityProfile,
    expectedRoutingCycles: chosenCycles || 3.0,
    useCustomRoutingCycles: true,
    supervisorModelName,
    synthesizerModelName: executionMode === 'parallel_map_reduce' ? 'gpt-4o-mini' : null,
    promptCachingEnabled: cacheHitRate > 0.05,
    estimatedCacheHitRate: cacheHitRate,
    monthlyRunVolume: options.monthlyRunVolume || 10000,
    tags: `otel-imported ${executionMode} ${complexityProfile}`,
    workers: derivedWorkers,
    telemetryMetadata: {
      source: 'OpenTelemetry Trace Logs',
      runsAnalyzed: tracesMap.size,
      totalSpansProcessed: spans.length,
      baselineType,
      routingCyclesStats: routingCyclesDist,
      detectedConcurrency: hasParallelExecutions,
      overallCacheHitRate: cacheHitRate,
      ingestedAt: new Date().toISOString()
    }
  };

  return {
    workflowConfigDraft,
    summary: {
      runsAnalyzed: tracesMap.size,
      totalSpans: spans.length,
      supervisorModel: supervisorModelName,
      workerCount: derivedWorkers.length,
      executionMode,
      complexityProfile,
      routingCycles: chosenCycles,
      cacheHitRate
    }
  };
}

/**
 * Built-in Sample OTel traces for instant 1-click evaluation without external files
 */
export const SAMPLE_ERP_OTEL_TRACE = {
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "s4hana-po-orchestrator" } },
          { key: "telemetry.sdk.language", value: { stringValue: "python" } }
        ]
      },
      scopeSpans: [
        {
          scope: { name: "langgraph.pregel", version: "0.2.14" },
          spans: [
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000001",
              name: "supervisor_router",
              startTimeUnixNano: "1727539200000000000",
              endTimeUnixNano: "1727539204500000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "AGENT" } },
                { key: "gen_ai.system", value: { stringValue: "openai" } },
                { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
                { key: "gen_ai.usage.input_tokens", value: { intValue: 720 } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 160 } },
                { key: "gen_ai.usage.cache_read_input_tokens", value: { intValue: 320 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000002",
              parentSpanId: "00000001",
              name: "po_data_extractor",
              startTimeUnixNano: "1727539200800000000",
              endTimeUnixNano: "1727539202100000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "AGENT" } },
                { key: "langgraph.node", value: { stringValue: "po_data_extractor" } },
                { key: "gen_ai.request.model", value: { stringValue: "gpt-4o-mini" } },
                { key: "gen_ai.usage.input_tokens", value: { intValue: 1240 } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 280 } },
                { key: "gen_ai.usage.cache_read_input_tokens", value: { intValue: 600 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000003",
              parentSpanId: "00000002",
              name: "s4_odata_get_po",
              startTimeUnixNano: "1727539201100000000",
              endTimeUnixNano: "1727539201800000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "TOOL" } },
                { key: "tool.name", value: { stringValue: "odata_get_purchase_order" } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 1350 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000004",
              parentSpanId: "00000001",
              name: "rules_validator",
              startTimeUnixNano: "1727539202300000000",
              endTimeUnixNano: "1727539203600000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "AGENT" } },
                { key: "langgraph.node", value: { stringValue: "rules_validator" } },
                { key: "gen_ai.request.model", value: { stringValue: "claude-3-5-sonnet" } },
                { key: "gen_ai.usage.input_tokens", value: { intValue: 2100 } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 450 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000005",
              parentSpanId: "00000004",
              name: "check_procurement_policy",
              startTimeUnixNano: "1727539202600000000",
              endTimeUnixNano: "1727539203100000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "TOOL" } },
                { key: "tool.name", value: { stringValue: "check_procurement_policy" } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 820 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000006",
              parentSpanId: "00000004",
              name: "check_vendor_sanctions",
              startTimeUnixNano: "1727539203150000000",
              endTimeUnixNano: "1727539203400000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "TOOL" } },
                { key: "tool.name", value: { stringValue: "check_vendor_sanctions" } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 640 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000007",
              parentSpanId: "00000001",
              name: "goods_receipt_poster",
              startTimeUnixNano: "1727539203700000000",
              endTimeUnixNano: "1727539204400000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "AGENT" } },
                { key: "langgraph.node", value: { stringValue: "goods_receipt_poster" } },
                { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
                { key: "gen_ai.usage.input_tokens", value: { intValue: 1450 } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 320 } }
              ]
            },
            {
              traceId: "4bfb1da9a2b75621d76b367d8a6b2220",
              spanId: "00000008",
              parentSpanId: "00000007",
              name: "bapi_po_post_gr",
              startTimeUnixNano: "1727539203900000000",
              endTimeUnixNano: "1727539204300000000",
              attributes: [
                { key: "openinference.span.kind", value: { stringValue: "TOOL" } },
                { key: "tool.name", value: { stringValue: "bapi_po_post_gr" } },
                { key: "gen_ai.usage.output_tokens", value: { intValue: 1800 } }
              ]
            }
          ]
        }
      ]
    }
  ]
};
