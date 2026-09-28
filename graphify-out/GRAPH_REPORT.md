# Graph Report - costestimator  (2026-09-28)

## Corpus Check
- 32 files · ~75,953 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 69 file(s) not represented in the graph (top: .csv 22, .hdbtable 12, .hdbview 11)

## Summary
- 196 nodes · 263 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.92)
- Token cost: 12,000 input · 3,500 output

## Community Hubs (Navigation)
- CAP Estimation & Pricing Service
- Frontend Build & Tooling
- Backend Dependencies & SDKs
- React Application & Admin Views
- Workflow Builder & Canvas
- Executive Dashboard & ROI
- Database Deployment Configuration
- UI Component Libraries
- SAP AppRouter Configuration
- Agentic Orchestration & State Topologies
- Oxlint Linter Configuration
- CAP Project CDS Configuration
- UI Icon Assets
- Brand Visual Assets
- Stochastic Simulation Engine
- HANA DB Deployer Module

## God Nodes (most connected - your core abstractions)
1. `WorkflowBuilder()` - 12 edges
2. `ExecutiveDashboard()` - 9 edges
3. `react` - 8 edges
4. `PricingAdmin()` - 8 edges
5. `getProviderLabel()` - 7 edges
6. `groupByProvider()` - 7 edges
7. `@mui/icons-material` - 6 edges
8. `@mui/material` - 6 edges
9. `App()` - 6 edges
10. `normalizeAiCoreModel()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Executive Approval Dashboard & ROI Framework` --implements--> `ExecutiveDashboard()`  [INFERRED]
  DESIGN_DOCUMENT.md → app/src/components/ExecutiveDashboard.jsx
- `Estimation Results & Executive Dashboard Mockup` --references--> `ExecutiveDashboard()`  [INFERRED]
  mockups/estimation_results.png → app/src/components/ExecutiveDashboard.jsx
- `Subagents / Router Pattern (Centralized Coordination)` --implements--> `WorkflowBuilder()`  [INFERRED]
  DESIGN_DOCUMENT.md → app/src/components/WorkflowBuilder.jsx
- `Workflow Builder Visual Canvas Mockup` --references--> `WorkflowBuilder()`  [INFERRED]
  mockups/workflow_builder.png → app/src/components/WorkflowBuilder.jsx
- `Routing Cycles (M) Heuristic Derivation` --implements--> `deriveBaseRoutingCycles()`  [INFERRED]
  DESIGN_DOCUMENT.md → srv/estimation-service.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Agentic Workflow Token & Cost Estimation Flow** — design_document_architecture, design_document_subagents_router_pattern, srv_estimation_service_computecyclecostandtokens, app_src_components_workflowbuilder_workflowbuilder, app_src_components_executivedashboard_executivedashboard [INFERRED 0.95]
- **SAP BTP Cloud Foundry Deployment Topology** — mta_costestimator_srv, mta_costestimator_approuter, mta_costestimator_auth, mta_cce_service_destination, mta_costestimator_db [EXTRACTED 1.00]

## Communities (16 total, 4 thin omitted)

### Community 0 - "CAP Estimation & Pricing Service"
Cohesion: 0.07
Nodes (34): Automated M & L Derivation Rationale (Cognitive Load Reduction), Routing Cycles (M) Heuristic Derivation, Worker Tool Hops (L) Heuristic Derivation, MTA Resource: CCE-service-destination (AI Core Destination), MTA Module: costestimator (SAP AppRouter), MTA Resource: costestimator-auth (XSUAA), MTA Resource: costestimator-db (SAP HANA HDI), MTA Module: costestimator-srv (CAP Node.js) (+26 more)

### Community 1 - "Frontend Build & Tooling"
Cohesion: 0.07
Nodes (26): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+18 more)

### Community 2 - "Backend Dependencies & SDKs"
Cohesion: 0.08
Nodes (25): dependencies, @cap-js/hana, jstat, @sap/cds, @sap-cloud-sdk/connectivity, @sap-cloud-sdk/http-client, @sap/xssec, simple-statistics (+17 more)

### Community 3 - "React Application & Admin Views"
Cohesion: 0.14
Nodes (20): Single Page Application HTML Entry Point, App(), theme, formatCu(), HistoryComparison(), baseParams, ModelExplanation(), BOOLEAN_MODEL_FIELDS (+12 more)

### Community 4 - "Workflow Builder & Canvas"
Cohesion: 0.25
Nodes (12): nodeTypes, PROVIDER_COLORS, TEMPLATE_PRESETS, toBoolean(), toInteger(), toNumber(), WorkflowBuilder(), getProviderLabel() (+4 more)

### Community 5 - "Executive Dashboard & ROI"
Cohesion: 0.24
Nodes (11): ExecutiveDashboard(), formatCu(), formatCurrency(), formatNumber(), formatWholeCurrency(), SCENARIO_COLORS, scenarioAssumptionText, Executive Approval Dashboard & ROI Framework (+3 more)

### Community 6 - "Database Deployment Configuration"
Cohesion: 0.18
Nodes (10): dependencies, hdb, @sap/hdi-deploy, engines, node, name, scripts, start (+2 more)

### Community 7 - "UI Component Libraries"
Cohesion: 0.20
Nodes (10): dependencies, @emotion/react, @emotion/styled, lucide-react, @mui/icons-material, @mui/material, react, react-dom (+2 more)

### Community 8 - "SAP AppRouter Configuration"
Cohesion: 0.29
Nodes (6): dependencies, @sap/approuter, name, scripts, start, @sap/approuter

### Community 9 - "Agentic Orchestration & State Topologies"
Cohesion: 0.29
Nodes (7): Cost Estimator Architecture Specification, Parallel Map-Reduce Execution Mode, Scoped Subgraph State (Task-Decoupled Planning TDP), Sequential Supervision Execution Mode, Shared Global State Topology (O(M^2) Token Bloat), Subagents / Router Pattern (Centralized Coordination), Task-Decoupled Planning Rationale (70-82% Token Reduction)

### Community 10 - "Oxlint Linter Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 11 - "CAP Project CDS Configuration"
Cohesion: 0.33
Nodes (6): cds, folders, requires, app, auth, [production]

## Knowledge Gaps
- **98 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `name` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Subagents / Router Pattern (Centralized Coordination)` connect `Agentic Orchestration & State Topologies` to `Workflow Builder & Canvas`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `WorkflowBuilder()` connect `Workflow Builder & Canvas` to `Agentic Orchestration & State Topologies`, `React Application & Admin Views`, `Executive Dashboard & ROI`?**
  _High betweenness centrality (0.248) - this node is a cross-community bridge._
- **Why does `Cost Estimator Architecture Specification` connect `Agentic Orchestration & State Topologies` to `CAP Estimation & Pricing Service`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `WorkflowBuilder()` (e.g. with `Subagents / Router Pattern (Centralized Coordination)` and `Workflow Builder Visual Canvas Mockup`) actually correct?**
  _`WorkflowBuilder()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `ExecutiveDashboard()` (e.g. with `Executive Approval Dashboard & ROI Framework` and `Estimation Results & Executive Dashboard Mockup`) actually correct?**
  _`ExecutiveDashboard()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CAP Estimation & Pricing Service` be split into smaller, more focused modules?**
  _Cohesion score 0.07112375533428165 - nodes in this community are weakly interconnected._