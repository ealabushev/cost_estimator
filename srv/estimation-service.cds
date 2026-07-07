using { costestimator as db } from '../db/schema';

service EstimationService @(path: '/api/v1/estimation') {

    entity ModelConfigs as projection on db.ModelConfigs;
    entity WorkerConfigs as projection on db.WorkerConfigs;
    entity WorkflowConfigs as projection on db.WorkflowConfigs;
    entity Estimations as projection on db.Estimations;
    entity ScenarioResults as projection on db.ScenarioResults;
    entity PerCycleCostBreakdowns as projection on db.PerCycleCostBreakdowns;
    entity ModelPricing as projection on db.ModelPricing;
    
    // Assumption & Heuristic Rule Entities (Editable in UI)
    entity ComplexityProfileRules as projection on db.ComplexityProfileRules;
    entity TaskTypeRules as projection on db.TaskTypeRules;
    entity PayloadDensityRules as projection on db.PayloadDensityRules;
    entity GlobalAssumptionSettings as projection on db.GlobalAssumptionSettings;

    // --- CAP Actions ---

    // Run cost estimation for a given workflow configuration ID
    action runEstimation(
        workflowId : UUID,
        capacityUnitsPerToken : Decimal(12,5),
        capacityUnitCostEur : Decimal(10,4)
    ) returns {
        estimationId : UUID;
        status       : String;
        summary      : LargeString; // JSON summary of results
    };

    // Run N-iteration Monte Carlo stochastic simulation across parameter distributions
    // Generates empirical P10, P50, P90 (Budget Ceiling), P99 (VaR), and CVaR risk metrics
    action runMonteCarloSimulation(
        workflowId : UUID,
        iterations : Integer default 1000,
        capacityUnitsPerToken : Decimal(12,5),
        capacityUnitCostEur : Decimal(10,4)
    ) returns {
        simulationId : UUID;
        status       : String;
        summary      : LargeString; // JSON summary of P10, P50, P90, P99, VaR, and ROI metrics
    };

    // Submit actual token telemetry for model calibration and drift detection
    action submitCalibration(
        workflowId   : UUID,
        executionId  : String,
        actualTokens : LargeString  // JSON telemetry from @sap-ai-sdk/orchestration
    ) returns {
        driftReport : LargeString;  // JSON analysis report
    };

    // Refresh pricing from SAP GenAI Hub supported provider APIs
    action refreshPricing(provider : String) returns Integer; // Count of updated models

    // Refresh pricing and model metadata from SAP Generative AI Hub Model Discovery API
    // Fetches available models + conversion rates from AI Core, maps to ModelPricing records
    action refreshAiHubPricing() returns Integer; // Count of updated AI Hub models

    // Reset all Tier 2, Tier 3, and Tier 4 assumption templates to validated SAP industry benchmarks
    action resetAssumptionsToDefaults() returns Integer; // Count of reset rules
}
