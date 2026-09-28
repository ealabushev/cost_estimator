/**
 * Client-Side OpenTelemetry & OpenInference Trace Parser & Derivation Engine
 * Enables instantaneous local preview, parameter derivation, and visual inspection.
 * Supports:
 * - OTLP ExportTraceServiceRequest JSON (resourceSpans -> scopeSpans -> spans)
 * - Elasticsearch / OpenSearch APM span index exports (_source wrappers, hits.hits)
 * - OpenInference / Traceloop / LangGraph semantic conventions
 * - Flat span arrays and JSON Lines (JSONL / NDJSON)
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

  // Handle Elasticsearch hits.hits
  if (rawData && rawData.hits && Array.isArray(rawData.hits.hits)) {
    rawData = rawData.hits.hits;
  }

  const normalizedSpans = [];

  // 1. OTLP standard: resourceSpans -> scopeSpans -> spans
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

  // 2. Direct array of spans or Elasticsearch / OpenSearch APM docs
  if (Array.isArray(rawData)) {
    for (const item of rawData) {
      const s = item._source || item;
      if (s.spans && Array.isArray(s.spans)) {
        for (const sub of s.spans) normalizedSpans.push(standardizeSpan(sub));
      } else if (s.spanId || s.id || s.span_id || s.name || s.traceId) {
        normalizedSpans.push(standardizeSpan(s));
      }
    }
    return normalizedSpans;
  }

  // 3. Single span object
  if (rawData.spanId || rawData.id || rawData.name) {
    normalizedSpans.push(standardizeSpan(rawData));
    return normalizedSpans;
  }

  throw new Error('No valid spans found in telemetry payload');
}

export function standardizeSpan(raw, parentResourceAttrs = {}) {
  const src = raw._source || raw;

  const attrs = {
    ...parentResourceAttrs,
    ...normalizeAttributes(src.attributes || src.tags)
  };

  for (const [key, val] of Object.entries(src)) {
    if (key.startsWith('span.attributes.') || key.startsWith('resource.attributes.') || key.startsWith('attributes.')) {
      const cleanKey = key.replace(/^(span\.attributes\.|resource\.attributes\.|attributes\.)/, '').replace(/@/g, '.');
      attrs[cleanKey] = unwrapOtelValue(val);
    }
  }

  const spanId = src.spanId || src.id || src.span_id || String(Math.random()).slice(2, 10);
  const traceId = src.traceId || src.trace_id || src.trace || 'default_trace';
  const parentSpanId = src.parentSpanId || src.parentId || src.parent_span_id || null;
  const name = src.name || src.operation_name || 'unnamed_span';

  let startTimeMs = 0;
  let endTimeMs = 0;

  if (src.startTimeUnixNano) startTimeMs = Number(BigInt(src.startTimeUnixNano) / 1000000n);
  else if (src.startTime) startTimeMs = new Date(src.startTime).getTime();
  else if (src.start_time) startTimeMs = new Date(src.start_time).getTime();
  else if (src.timestamp) startTimeMs = new Date(src.timestamp).getTime();

  if (src.endTimeUnixNano) endTimeMs = Number(BigInt(src.endTimeUnixNano) / 1000000n);
  else if (src.endTime) endTimeMs = new Date(src.endTime).getTime();
  else if (src.end_time) endTimeMs = new Date(src.end_time).getTime();
  else endTimeMs = startTimeMs + 100;

  const isError = src['status.code'] === 2 || 
                  src.status?.code === 2 || 
                  src['status.code'] === 'ERROR' || 
                  src.status === 'ERROR' || 
                  src.error === true || 
                  Boolean(attrs['error']) || 
                  Boolean(attrs['error.type']) || 
                  Boolean(attrs['exception.type']);

  const modelName = attrs['gen_ai.request.model'] || 
                    attrs['gen_ai.response.model'] || 
                    attrs['traceloop.association.properties.ls_model_name'] || 
                    attrs['llm.model_name'] || 
                    attrs['model'] || 
                    attrs['request.model'] || null;

  const inputTokens = Number(
    attrs['gen_ai.usage.input_tokens'] || 
    attrs['gen_ai.usage.prompt_tokens'] || 
    attrs['llm.token_count.prompt'] || 
    attrs['prompt_tokens'] || 0
  );
  const outputTokens = Number(
    attrs['gen_ai.usage.output_tokens'] || 
    attrs['gen_ai.usage.completion_tokens'] || 
    attrs['llm.token_count.completion'] || 
    attrs['completion_tokens'] || 0
  );
  const cacheReadTokens = Number(
    attrs['gen_ai.usage.cache_read.input_tokens'] || 
    attrs['gen_ai.usage.cache_read_input_tokens'] || 
    attrs['cache_read_input_tokens'] || 0
  );

  let toolName = attrs['gen_ai.tool.name'] || attrs['tool.name'] || attrs['tool'] || null;
  if (!toolName && name.startsWith('execute_tool ')) {
    toolName = name.replace('execute_tool ', '').trim();
  }

  const toolInput = attrs['gen_ai.tool.call.arguments'] || attrs['tool.input'] || attrs['tool_input'] || null;
  const toolOutput = attrs['gen_ai.tool.call.result'] || attrs['tool.output'] || attrs['tool_output'] || null;

  const lgNode = attrs['traceloop.association.properties.langgraph_node'] || attrs['langgraph.node'];
  const entityPath = attrs['traceloop.entity.path'] || '';
  let agentHint = attrs['gen_ai.agent.name'] || 
                  attrs['agent.name'] || 
                  attrs['agent'] || 
                  (entityPath ? entityPath.split('.')[0] : null);
  if (!agentHint && name.startsWith('execute_task ')) {
    const taskName = name.replace('execute_task ', '').trim();
    if (taskName && taskName !== 'tools' && taskName !== 'agent') {
      agentHint = taskName;
    }
  }
  if (!agentHint && lgNode && lgNode !== 'tools' && lgNode !== 'agent') {
    agentHint = lgNode;
  }

  let spanKind = attrs['openinference.span.kind'] || 
                 attrs['traceloop.span.kind'] || 
                 attrs['span.kind'] || 
                 src.kind;

  if (toolName) spanKind = 'TOOL';
  else if (modelName) spanKind = 'LLM';
  else if (name.includes('router') || lgNode === 'router') spanKind = 'SUPERVISOR';
  else if (agentHint && agentHint !== 'router') spanKind = 'AGENT';

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
    spanKind: String(spanKind || 'INTERNAL').toUpperCase(),
    agentHint,
    lgNode
  };
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
  if (avgHops >= 4 || lowerName.includes('reason') || lowerName.includes('reconciliation') || lowerName.includes('matching') || lowerName.includes('insights')) {
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

function formatAgentName(raw) {
  if (!raw) return 'Agent Worker';
  const clean = String(raw).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
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

    function resolveWorkerName(span) {
      let curr = span;
      while (curr) {
        if (curr.agentHint && curr.agentHint !== 'router' && !/langgraph|workflow/i.test(curr.agentHint)) {
          return curr.agentHint;
        }
        curr = spanMap.get(curr.parentSpanId);
      }
      return null;
    }

    let supervisorModel = null;
    for (const s of traceSpans) {
      if ((s.name.includes('router') || s.lgNode === 'router' || s.spanKind === 'SUPERVISOR') && s.modelName) {
        supervisorModel = s.modelName;
        break;
      }
    }
    if (!supervisorModel) {
      const roots = traceSpans.filter(s => !s.parentSpanId || !spanMap.has(s.parentSpanId));
      for (const r of roots) {
        if (r.modelName) { supervisorModel = r.modelName; break; }
        const rChildren = childrenMap.get(r.spanId) || [];
        const llm = rChildren.find(c => c.modelName);
        if (llm) { supervisorModel = llm.modelName; break; }
      }
    }
    if (supervisorModel) allSupervisorModels.push(supervisorModel);

    const workersInRun = new Map();

    for (const s of traceSpans) {
      const isRouter = s.lgNode === 'router' || s.name.includes('router');
      if (isRouter) continue;

      let wName = resolveWorkerName(s);
      if (!wName && (s.toolName || s.spanKind === 'TOOL')) {
        wName = 'Specialist Agent';
      }

      if (wName) {
        const cleanName = formatAgentName(wName);
        if (!workersInRun.has(cleanName)) {
          workersInRun.set(cleanName, {
            name: cleanName,
            spans: []
          });
        }
        workersInRun.get(cleanName).spans.push(s);
      }
    }

    const workerNames = Array.from(workersInRun.keys());
    for (let i = 0; i < workerNames.length; i++) {
      for (let j = i + 1; j < workerNames.length; j++) {
        const spans1 = workersInRun.get(workerNames[i]).spans;
        const spans2 = workersInRun.get(workerNames[j]).spans;
        for (const s1 of spans1) {
          for (const s2 of spans2) {
            if (s1.startTimeMs < s2.endTimeMs && s2.startTimeMs < s1.endTimeMs) {
              hasParallelExecutions = true;
            }
          }
        }
      }
    }

    const routingCyclesInRun = Math.max(1, workersInRun.size);

    for (const [wName, wGroup] of workersInRun.entries()) {
      if (!discoveredWorkersMap.has(wName)) {
        discoveredWorkersMap.set(wName, {
          name: wName,
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

      const wEntry = discoveredWorkersMap.get(wName);
      wEntry.totalInvocations += 1;

      const toolSpans = wGroup.spans.filter(s => s.toolName);
      wEntry.hopsList.push(toolSpans.length);

      for (const ts of toolSpans) {
        wEntry.toolsSet.add(ts.toolName);
        if (ts.isError) wEntry.errorsCount += 1;

        let obsTokens = ts.outputTokens;
        if (!obsTokens && ts.toolOutput) {
          obsTokens = estimateTokensFromText(ts.toolOutput);
        }
        if (obsTokens > 0) wEntry.observationTokensList.push(obsTokens);
      }

      const llmSpans = wGroup.spans.filter(s => s.modelName || s.inputTokens > 0);
      for (const ls of llmSpans) {
        if (ls.modelName) wEntry.models.push(ls.modelName);
        if (ls.inputTokens > 0) wEntry.promptTokensList.push(ls.inputTokens);
        if (ls.outputTokens > 0) wEntry.outputTokensList.push(ls.outputTokens);
        totalCacheReadTokens += ls.cacheReadTokens || 0;
        totalInputTokensAcrossAll += ls.inputTokens || 0;
      }
    }

    runStats.push({
      traceId,
      routingCycles: routingCyclesInRun,
      workerCount: workersInRun.size,
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

    const chosenHops = baselineType === 'conservative_p90' ? hopsDist.p90 : hopsDist.p50;
    const chosenObs = baselineType === 'conservative_p90' ? obsDist.p90 : obsDist.p50;
    const chosenPrompt = baselineType === 'conservative_p90' ? promptDist.p90 : promptDist.p50;
    const chosenOut = baselineType === 'conservative_p90' ? outDist.p90 : outDist.p50;

    const totalToolCalls = wData.hopsList.reduce((a, b) => a + b, 0);
    const retryProb = totalToolCalls > 0 
      ? Math.min(1.0, Math.round((wData.errorsCount / totalToolCalls) * 100) / 100)
      : 0.05;

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
      retryProbability: retryProb,
      executionMode: hasParallelExecutions ? 'parallel_map_reduce' : 'sequential',
      parallelInstances: hasParallelExecutions ? 2 : 1,
      isReflectorNode: false,
      refinementIterations: 1
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
