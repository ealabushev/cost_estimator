namespace costestimator;

using { cuid, managed } from '@sap/cds/common';

// --- Enums ---

type ProviderName : String enum {
    openai      = 'openai';
    anthropic   = 'anthropic';
    google      = 'google';
    mistral     = 'mistral';
    sap_ai_hub  = 'sap_ai_hub';
    self_hosted = 'self_hosted';
}

type StateMode : String enum {
    global_shared   = 'global_shared';
    scoped_subgraph = 'scoped_subgraph';
}

type ScenarioName : String enum {
    optimistic = 'optimistic';
    median     = 'median';
    fat_tail   = 'fat_tail';
    monte_carlo_p10 = 'monte_carlo_p10';
    monte_carlo_p50 = 'monte_carlo_p50';
    monte_carlo_p90 = 'monte_carlo_p90';
    monte_carlo_p99 = 'monte_carlo_p99';
}


type ComplexityProfile : String enum {
    simple         = 'simple';
    standard       = 'standard';
    complex        = 'complex';
    research_heavy = 'research_heavy';
}

type WorkerTaskType : String enum {
    simple_lookup        = 'simple_lookup';
    retrieval_response   = 'retrieval_response';
    analysis             = 'analysis';
    transformation       = 'transformation';
    multi_step_reasoning = 'multi_step_reasoning';
    erp_data_pipeline    = 'erp_data_pipeline';
}

type ExecutionMode : String enum {
    sequential          = 'sequential';
    parallel_map_reduce = 'parallel_map_reduce';
}

type HitlPauseDuration : String enum {
    none           = 'none';
    short_under_5m = 'short_under_5m';
    long_over_5m   = 'long_over_5m';
}

type OrchestrationPattern : String enum {
    subagents_router    = 'subagents_router';
    sequential          = 'sequential';
    parallel_map_reduce = 'parallel_map_reduce';
}

// --- Input Configuration Entities ---

entity ModelConfigs : cuid {
    modelName                   : String(100) not null;
    provider                    : ProviderName not null;
    description                 : String(500);    // Dynamically fetched from SAP AI Core Model Discovery API (resource.description)
    capabilities                : String(300);    // JSON array of capabilities e.g. ["text-generation", "tool-calling"]
    customPriceInputPerMtok     : Decimal(10,4);  // Override input $/MTok (for self-hosted or custom pricing)
    customPriceOutputPerMtok    : Decimal(10,4);  // Override output $/MTok
    customPriceCacheReadPerMtok : Decimal(10,4);  // Override cache-read $/MTok
    contextWindowTokens         : Integer;        // Context window size (fetched from versions[].contextLength). Required for self-hosted.
    thinkingTokenMultiplier     : Decimal(3,1) default 0.0; // Extended thinking multiplier (e.g., 3.0 for Claude Sonnet w/ thinking). 0.0 = no thinking tokens.
    supportsPromptCaching       : Boolean default false;
    supportsExtendedThinking    : Boolean default false;
}

entity WorkerConfigs : cuid {
    workflow                : Association to WorkflowConfigs;
    name                    : String(100) not null;
    roleDescription         : String(500);
    model                   : Association to ModelConfigs;
    toolCount               : Integer not null;       // Number of tools bound via bind_tools (0–100)
    // Smart parameter derivation
    taskType                : WorkerTaskType default 'analysis';  // Intuitive selector → derives avgToolHops
    avgToolHops             : Decimal(4,1);           // Auto-derived from taskType + toolCount; user can override.
    avgObservationTokens    : Integer default 200;    // Average tokens per tool observation
    basePromptTokens        : Integer default 400;    // Base prompt tokens override (default 400)
    avgOutputTokensPerHop   : Integer default 300;    // Average output tokens per hop override (default 300)
    retryProbability        : Decimal(3,2) default 0.10 @assert.range: [0.00, 1.00]; // Per-invocation error retry probability
    invocationProbability   : Decimal(3,2) default 1.00 @assert.range: [0.00, 1.00]; // For dynamic worker selection weighting
    maxRetriesPerCycle      : Integer default 5;      // Cap on retry attempts per cycle
    useCustomToolHops       : Boolean default false;  // When true, avgToolHops is user-provided; otherwise derived
    // Architecture extensions: Parallelism and Reflection
    executionMode           : ExecutionMode default 'sequential';
    parallelInstances       : Integer default 1;      // Number of concurrent subgraph instances spawned via LangGraph Send API
    isReflectorNode         : Boolean default false;  // True for intentional Reflection/Critique refinement loops vs. error retries
    refinementIterations    : Integer default 1;      // Number of planned refinement passes for reflector nodes
    // Nested supervisor support
    subWorkflow             : Association to WorkflowConfigs;
}

entity WorkflowConfigs : cuid, managed {
    name                          : String(200);
    project                       : String(100);          // Optional project/team identifier for data isolation within a tenant
    // Tier 0: Orchestration Pattern
    orchestrationPattern          : OrchestrationPattern default 'subagents_router';
    // Tier 1: Model Tiering
    supervisorModel               : Association to ModelConfigs; // Required central coordinator / router
    synthesizerModel              : Association to ModelConfigs; // Optional; used when executionMode = 'parallel_map_reduce'
    workers                       : Composition of many WorkerConfigs on workers.workflow = $self;
    // Tier 2: Topology
    stateMode                     : StateMode default 'scoped_subgraph';
    // Smart parameter derivation
    complexityProfile             : ComplexityProfile default 'standard';  // Intuitive selector → derives M / plan steps
    expectedRoutingCycles         : Decimal(4,1);         // Auto-derived from profile + worker count; represents cycles, handoffs, or plan steps.
    useCustomRoutingCycles        : Boolean default false; // When true, expectedRoutingCycles is user-provided
    supervisorSystemPromptTokens  : Integer default 500;
    workerRegistryTokens          : Integer default 200;
    // Tier 3: Tool overhead
    avgToolSchemaTokens           : Integer default 250;  // 50–1000
    // Tier 4: Middleware & HITL
    messageTrimmingEnabled        : Boolean default false;
    messageTrimmingMaxTokens      : Integer;
    summarizationEnabled          : Boolean default false;
    avgSummaryArtifactTokens      : Integer default 150;  // 10+
    checkpointingEnabled          : Boolean default false;
    hitlPauseDuration             : HitlPauseDuration default 'none'; // Controls HITL prompt cache expiration tax
    promptCachingEnabled          : Boolean default false;
    estimatedCacheHitRate         : Decimal(3,2) default 0.00 @assert.range: [0.00, 1.00]; // 0.00–1.00
    // Scenario controls
    monthlyRunVolume              : Integer default 10000; // 1+
    // Tags for filtering
    tags                          : String(500);
    notes                         : LargeString;
}

// --- Output / Results Entities ---

entity Estimations : cuid, managed {
    workflow          : Association to WorkflowConfigs;
    scenarios         : Composition of many ScenarioResults on scenarios.estimation = $self;
    capacityUnitsPerToken : Decimal(12,5); // Conversion constant from API-cost-weighted tokens to Capacity Units
    capacityUnitCostEur   : Decimal(10,4); // EUR cost per Capacity Unit used for this estimation
    pricingSnapshot   : LargeString;  // JSON: Model -> {input_$/MTok, output_$/MTok, ...}
    warnings          : LargeString;  // JSON array: e.g., ["Context window exceeded at cycle 6"]
}

entity ScenarioResults : cuid {
    estimation              : Association to Estimations;
    scenarioName            : ScenarioName;
    totalInputTokens        : Integer;
    totalOutputTokens       : Integer;
    totalThinkingTokens     : Integer;  // For extended-thinking models
    redundantContextRatio   : Decimal(3,2) @assert.range: [0.00, 1.00];  // "Re-Sent Context Tax" as a ratio (0.00–1.00).
    costPerRunUsd           : Decimal(10,4);
    monthlyTcoUsd           : Decimal(12,2);
    // SAP AI Hub dual-cost view
    costPerRunBtpCredits    : Decimal(10,4);  // Equivalent cost in SAP BTP Credits (for AI Hub models)
    monthlyTcoBtpCredits    : Decimal(12,2);
    totalGenAiTokens        : Integer;        // SAP AI Hub normalized GenAI tokens
    totalCapacityUnits      : Decimal(12,4);  // SAP BTP Capacity Units consumed
    perCycleBreakdown       : Composition of many PerCycleCostBreakdowns
                                on perCycleBreakdown.scenario = $self;
}

entity PerCycleCostBreakdowns : cuid {
    scenario                : Association to ScenarioResults;
    cycle                   : Integer;
    workerName              : String(100);
    supervisorInputTokens   : Integer;
    supervisorOutputTokens  : Integer;
    workerInputTokens       : Integer;
    workerOutputTokens      : Integer;
    workerThinkingTokens    : Integer;
    inputCapacityUnits      : Decimal(12,4);
    outputCapacityUnits     : Decimal(12,4);
    totalCapacityUnits      : Decimal(12,4);
    capacityUnitCostEur     : Decimal(10,4);
    totalCapacityUnitCostEur: Decimal(10,6);
    supervisorCostUsd       : Decimal(10,6);
    workerCostUsd           : Decimal(10,6);
    cacheDiscountUsd        : Decimal(10,6);
}

// --- Assumption & Heuristic Rule Entities (Editable in Admin Settings UI) ---

entity ComplexityProfileRules : cuid, managed {
    profileName             : ComplexityProfile not null;
    baseRoutingCycles       : Decimal(4,1) not null;     // Base M (e.g., 2.0, 4.0, 6.0, 10.0)
    workerCountDivisor      : Decimal(4,1) default 1.0;  // Divisor/multiplier for worker count adjustment
    workerCountMultiplier   : Decimal(3,2) default 0.50; // e.g., 0.50 for (N - M) * 0.5
    description             : String(300);
    isDefault               : Boolean default false;
}

entity TaskTypeRules : cuid, managed {
    taskTypeName            : WorkerTaskType not null;
    baseToolHops            : Decimal(4,1) not null;     // Base L (e.g., 1.0, 2.0, 3.0, 4.0, 6.0, 8.0)
    toolCountDivisor        : Integer default 5;         // For tool count adjustment floor(T / divisor)
    toolCountMultiplier     : Decimal(3,2) default 0.50; // e.g., 0.50 extra hops per 5 tools
    description             : String(300);
    isDefault               : Boolean default false;
}

entity PayloadDensityRules : cuid, managed {
    densityName             : String(50) not null;       // 'low', 'medium', 'high', 'custom_erp_heavy'
    avgObservationTokens    : Integer not null;          // e.g., 200, 1000, 3000
    description             : String(300);
    isDefault               : Boolean default false;
}

@assert.unique: { settingKey: [settingKey] }
entity GlobalAssumptionSettings : cuid, managed {
    settingKey              : String(100) not null;        // e.g., 'default_analyst_rate_usd'
    settingValue            : String(200) not null;        // e.g., '50.00'
    settingType             : String(50) default 'number'; // 'number', 'string', 'boolean', 'json'
    category                : String(100);                 // 'finops_roi', 'stochastic_retry', 'token_overhead'
    description             : String(300);
}

// --- Pricing Registry ---

@assert.unique: { pricingKey: [provider, modelName, effectiveDate] }
entity ModelPricing : cuid, managed {
    provider                    : ProviderName not null;
    modelName                   : String(100) not null;
    inputPricePerMtok           : Decimal(10,4) not null;
    outputPricePerMtok          : Decimal(10,4) not null;
    cacheReadPricePerMtok       : Decimal(10,4);
    cacheWritePricePerMtok      : Decimal(10,4);
    thinkingPricePerMtok        : Decimal(10,4);
    batchDiscountPercent        : Decimal(5,2);
    contextWindowTokens         : Integer;
    effectiveDate               : Date not null;
    source                      : String(50);  // Display data source, e.g. 'GenAI Hub'
    // SAP Generative AI Hub specific fields
    genAiTokenInputRate         : Decimal(10,6);  // GenAI token conversion factor per 1,000 input tokens
    genAiTokenOutputRate        : Decimal(10,6);  // GenAI token conversion factor per 1,000 output tokens
    capacityUnitRate            : Decimal(10,6);  // Deprecated: CU conversion now comes from global setting capacity_units_per_token
    btpCreditPerCapacityUnit    : Decimal(10,4);  // Deprecated: CU EUR cost now comes from global setting capacity_unit_cost_eur
}
