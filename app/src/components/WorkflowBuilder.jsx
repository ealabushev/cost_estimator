import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';


import {
  Box, Grid, Card, CardContent, Typography, Button, TextField, Select,
  MenuItem, FormControl, InputLabel, FormControlLabel, Switch, Drawer,
  IconButton, Divider, Slider, Chip, Alert, CircularProgress, RadioGroup, Radio,
  ListSubheader, Tooltip, InputAdornment, Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BarChartIcon from '@mui/icons-material/BarChart';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LayersIcon from '@mui/icons-material/Layers';
import TuneIcon from '@mui/icons-material/Tune';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import BusinessIcon from '@mui/icons-material/Business';

import ExecutiveDashboard from './ExecutiveDashboard';
import TelemetryImportModal from './TelemetryImportModal';
import { getProviderLabel, groupByProvider, sortByProviderAndModel } from '../utils/modelGrouping';
import { matchModelToCatalog } from '../utils/telemetryParser';

// Provider Color Mappings for badges
const PROVIDER_COLORS = {
  openai: '#10a37f',
  anthropic: '#d97706',
  sap_ai_hub: '#7c3aed',
  google: '#2563eb',
  mistral: '#2e303a',
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback = false) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
};

// Preset Workflow Templates based on §4.D
const TEMPLATE_PRESETS = [
  {
    name: 'Purchase Order Processing',
    description: 'SAP S/4HANA Procurement sequential validation and BAPI posting',
    project: 'SAP S/4HANA Procurement',
    executionMode: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'standard',
    expectedRoutingCycles: 4,
    useCustomRoutingCycles: false,
    promptCachingEnabled: true,
    estimatedCacheHitRate: 0.50,
    monthlyRunVolume: 10000,
    tags: 'erp purchase-order s4hana',
    workers: [
      { name: 'PO Data Extractor', taskType: 'retrieval_response', toolCount: 3, avgObservationTokens: 1000, retryProbability: 0.05, executionMode: 'sequential', isReflectorNode: false },
      { name: 'Rules Validator', taskType: 'analysis', toolCount: 5, avgObservationTokens: 1500, retryProbability: 0.10, executionMode: 'sequential', isReflectorNode: false },
      { name: 'GR Poster (BAPI)', taskType: 'transformation', toolCount: 2, avgObservationTokens: 2000, retryProbability: 0.15, executionMode: 'sequential', isReflectorNode: false }
    ]
  },
  {
    name: 'S/4HANA Migration Planner',
    description: 'Autonomous planning and schema validation workflow',
    project: 'S/4HANA Migration',
    executionMode: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'complex',
    expectedRoutingCycles: 8,
    useCustomRoutingCycles: false,
    promptCachingEnabled: true,
    estimatedCacheHitRate: 0.40,
    monthlyRunVolume: 5000,
    tags: 'migration s4hana bulk-posting',
    workers: [
      { name: 'Migration Planner', taskType: 'analysis', toolCount: 4, avgObservationTokens: 1500, retryProbability: 0.10, executionMode: 'sequential', isReflectorNode: false },
      { name: 'Schema Validator', taskType: 'transformation', toolCount: 8, avgObservationTokens: 2500, retryProbability: 0.05, executionMode: 'sequential', isReflectorNode: false },
      { name: 'Batch Poster', taskType: 'erp_data_pipeline', toolCount: 2, avgObservationTokens: 5000, retryProbability: 0.20, executionMode: 'sequential', isReflectorNode: false },
      { name: 'Replanner', taskType: 'retrieval_response', toolCount: 3, avgObservationTokens: 1000, retryProbability: 0.10, executionMode: 'sequential', isReflectorNode: true, refinementIterations: 2 }
    ]
  },
  {
    name: 'Multi-Vendor Catalog Query',
    description: 'Parallel Map-Reduce catalog query across multiple subgraphs',
    project: 'Ariba Supplier Network',
    executionMode: 'parallel_map_reduce',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'standard',
    expectedRoutingCycles: 4,
    useCustomRoutingCycles: false,
    promptCachingEnabled: true,
    estimatedCacheHitRate: 0.50,
    monthlyRunVolume: 20000,
    tags: 'ariba parallel catalog-search',
    workers: [
      { name: 'OData Catalog Reader', taskType: 'retrieval_response', toolCount: 2, avgObservationTokens: 1200, retryProbability: 0.05, executionMode: 'parallel_map_reduce', parallelInstances: 5 },
      { name: 'Price Comparer', taskType: 'analysis', toolCount: 4, avgObservationTokens: 1500, retryProbability: 0.10, executionMode: 'sequential' }
    ]
  },
  {
    name: 'Intercompany Reconciliation',
    description: 'Deep collaborative research and correction across company codes',
    project: 'SAP FI/CO Finance',
    executionMode: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'research_heavy',
    expectedRoutingCycles: 10,
    useCustomRoutingCycles: false,
    promptCachingEnabled: true,
    estimatedCacheHitRate: 0.60,
    monthlyRunVolume: 8000,
    tags: 'finance reconciliation audit',
    workers: [
      { name: 'CoCode A Reader', taskType: 'retrieval_response', toolCount: 3, avgObservationTokens: 1000, retryProbability: 0.05, executionMode: 'sequential' },
      { name: 'CoCode B Reader', taskType: 'retrieval_response', toolCount: 3, avgObservationTokens: 1000, retryProbability: 0.05, executionMode: 'sequential' },
      { name: 'Matching Engine', taskType: 'multi_step_reasoning', toolCount: 6, avgObservationTokens: 3000, retryProbability: 0.15, executionMode: 'sequential' },
      { name: 'Difference Poster', taskType: 'transformation', toolCount: 4, avgObservationTokens: 2000, retryProbability: 0.10, executionMode: 'sequential' }
    ]
  },
  {
    name: 'Custom Workflow',
    description: 'Start with a clean slate and build your own custom agent topology',
    project: 'Custom Project',
    executionMode: 'sequential',
    stateMode: 'scoped_subgraph',
    complexityProfile: 'simple',
    expectedRoutingCycles: 2,
    useCustomRoutingCycles: false,
    promptCachingEnabled: true,
    estimatedCacheHitRate: 0.50,
    monthlyRunVolume: 1000,
    tags: 'custom custom-topology',
    workers: [
      { name: 'Custom Agent 1', taskType: 'analysis', toolCount: 3, avgObservationTokens: 1000, retryProbability: 0.10, executionMode: 'sequential', isReflectorNode: false }
    ]
  }
];

// Custom Node Component to display inside React Flow
function CustomNode({ data }) {
  const isSupervisor = data.isSupervisor;
  const isSynthesizer = data.isSynthesizer;

  return (
    <Box 
      className="custom-node" 
      sx={{
        borderLeft: 6,
        borderColor: isSupervisor ? 'primary.main' : isSynthesizer ? 'secondary.main' : 'success.main'
      }}
    >
      <Box className="custom-node-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, pr: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {data.label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!isSupervisor && !isSynthesizer && data.onDeleteClick && (
            <IconButton 
              size="small" 
              color="error" 
              onClick={data.onDeleteClick}
              sx={{ p: 0.2, '& svg': { fontSize: 14 } }}
              title="Delete Worker"
            >
              <DeleteIcon />
            </IconButton>
          )}
          <Chip
            label={isSupervisor ? 'Supervisor' : isSynthesizer ? 'Synthesizer' : 'Worker'}
            size="small"
            color={isSupervisor ? 'primary' : isSynthesizer ? 'secondary' : 'success'}
            sx={{ height: 16, fontSize: '9px', fontWeight: 700 }}
          />
        </Box>
      </Box>

      <Box className="custom-node-body">
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Model:</span> 
          <span style={{ fontWeight: 600, color: PROVIDER_COLORS[data.provider] || '#333' }}>
            {data.modelName}
          </span>
        </Typography>
        {!isSupervisor && !isSynthesizer && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Task Type:</span> 
              <span style={{ fontWeight: 600 }}>{data.taskType}</span>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Hops & Tools:</span> 
              <span style={{ fontWeight: 600 }}>{data.hops} hops | {data.tools} tools</span>
            </Typography>
          </>
        )}
        {data.showTokenOverlay && data.telemetry && (
          <Tooltip
            arrow
            placement="right"
            enterDelay={150}
            componentsProps={{
              tooltip: {
                sx: {
                  bgcolor: '#0f172a',
                  color: '#f8fafc',
                  p: 1.5,
                  maxWidth: 420,
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                  border: '1px solid #334155',
                  borderRadius: 2
                }
              },
              arrow: {
                sx: { color: '#0f172a' }
              }
            }}
            title={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', pb: 0.75, gap: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#38bdf8', letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '10px' }}>
                    {isSupervisor ? 'Supervisor Routing Formula' : isSynthesizer ? 'Synthesizer Formula' : `Worker Reasoning Formula (${data.telemetry.hops || 1} Hops)`}
                  </Typography>
                  <Chip 
                    label={`${data.telemetry.inputTokens.toLocaleString()} in · ${data.telemetry.outputTokens.toLocaleString()} out`} 
                    size="small" 
                    sx={{ height: 18, fontSize: '9px', fontWeight: 700, bgcolor: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }} 
                  />
                </Box>
                <Typography variant="caption" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '11px', color: '#e2e8f0', lineHeight: 1.45 }}>
                  {data.telemetry.formula}
                </Typography>
                <Box sx={{ borderTop: '1px solid #334155', pt: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '10px' }}>
                    AI Hub CU: <strong style={{ color: '#cbd5e1' }}>{data.telemetry.cu} CU</strong>
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#4ade80', fontWeight: 700, fontSize: '11px' }}>
                    {data.telemetry.costEur}
                  </Typography>
                </Box>
              </Box>
            }
          >
            <Box className="token-telemetry-box" sx={{ cursor: 'help' }}>
              <Box className="telemetry-row">
                <span className="telemetry-label">🪙 Input / Out:</span>
                <span className="telemetry-value">{data.telemetry.inputTokens.toLocaleString()} / {data.telemetry.outputTokens.toLocaleString()}</span>
              </Box>
              {data.telemetry.thinkingTokens > 0 && (
                <Box className="telemetry-row">
                  <span className="telemetry-label">🧠 Thinking:</span>
                  <span className="telemetry-value telemetry-highlight">{data.telemetry.thinkingTokens.toLocaleString()} tok</span>
                </Box>
              )}
              <Box className="telemetry-row">
                <span className="telemetry-label">⚡ AI Hub CU:</span>
                <span className="telemetry-value">{data.telemetry.cu}</span>
              </Box>
              <Box className="telemetry-row">
                <span className="telemetry-label">💶 Est. Cost:</span>
                <span className="telemetry-value telemetry-cost">{data.telemetry.costEur}</span>
              </Box>
            </Box>
          </Tooltip>
        )}
      </Box>
      {/* Handles for connections */}
      {isSupervisor && (
        <>
          <Handle type="target" position={Position.Top} id="t" style={{ background: '#4f46e5', width: 8, height: 8 }} />
          <Handle type="source" position={Position.Bottom} id="s" style={{ background: '#4f46e5', width: 8, height: 8 }} />
        </>
      )}
      {isSynthesizer && (
        <Handle type="target" position={Position.Top} id="t" style={{ background: '#0f172a', width: 8, height: 8 }} />
      )}
      {!isSupervisor && !isSynthesizer && (
        <>
          <Handle type="target" position={Position.Top} id="t" style={{ background: '#10b981', width: 8, height: 8 }} />
          <Handle type="source" position={Position.Bottom} id="s" style={{ background: '#10b981', width: 8, height: 8 }} />
        </>
      )}
    </Box>
  );
}


// React Flow needs nodeTypes declared outside component or memoized
const nodeTypes = {
  custom: CustomNode,
};

export default function WorkflowBuilder({ workflowId, initialEstimation, onLoadWorkflow }) {
  // Models list fetched from CAP
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);

  // Flow control states
  const [isTemplateSelected, setIsTemplateSelected] = useState(false);
  const [isSpecsExpanded, setIsSpecsExpanded] = useState(true);
  const [triggerAutoLayout, setTriggerAutoLayout] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);
  const [activeTelemetryBenchmark, setActiveTelemetryBenchmark] = useState(null);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState(null);

  // Template Gallery Search & Filter states
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('all'); // 'all' | 'custom' | 'preset'
  const [templateProject, setTemplateProject] = useState('ALL');

  // Form inputs representing the active WorkflowConfig
  const [name, setName] = useState('New Agentic Workflow');
  const [project, setProject] = useState('Default Project');
  const [executionMode, setExecutionMode] = useState('sequential');
  const [stateMode, setStateMode] = useState('scoped_subgraph');
  const [complexityProfile, setComplexityProfile] = useState('standard');
  const [expectedRoutingCycles, setExpectedRoutingCycles] = useState(4);
  const [useCustomRoutingCycles, setUseCustomRoutingCycles] = useState(false);
  const [monthlyRunVolume, setMonthlyRunVolume] = useState(10000);
  const [promptCachingEnabled, setPromptCachingEnabled] = useState(true);
  const [estimatedCacheHitRate, setEstimatedCacheHitRate] = useState(0.50);
  const [hitlPauseDuration, setHitlPauseDuration] = useState('none');
  const [supervisorModelId, setSupervisorModelId] = useState('');
  const [synthesizerModelId, setSynthesizerModelId] = useState('');
  const [tags, setTags] = useState('erp');
  const [notes, setNotes] = useState('Created via builder');
  const [capacityUnitsPerToken, setCapacityUnitsPerToken] = useState(1.90385);
  const [capacityUnitCostEur, setCapacityUnitCostEur] = useState(1.04);
  const [supervisorSystemPromptTokens, setSupervisorSystemPromptTokens] = useState(500);
  const [workerRegistryTokens, setWorkerRegistryTokens] = useState(200);
  const [avgToolSchemaTokens, setAvgToolSchemaTokens] = useState(250);

  // List of Workers config
  const [workers, setWorkers] = useState([
    { ID: '1', name: 'Worker Agent 1', model_ID: '', toolCount: 3, taskType: 'analysis', avgObservationTokens: 1000, basePromptTokens: 400, avgOutputTokensPerHop: 300, useCustomToolHops: false, avgToolHops: 2, retryProbability: 0.10, executionMode: 'sequential', parallelInstances: 1, isReflectorNode: false, refinementIterations: 1 }
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Drawer & Selection state for configuring specific workers
  const [selectedWorkerIndex, setSelectedWorkerIndex] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsedModelProviders, setCollapsedModelProviders] = useState(() => new Set());
  const groupedModels = useMemo(() => groupByProvider(models), [models]);


  // Estimation and Simulation states
  const [estimating, setEstimating] = useState(false);
  const [estimationResult, setEstimationResult] = useState(null);
  const [monteCarloMode, setMonteCarloMode] = useState(false);

  // Token Telemetry and Pricing State
  const [modelPricing, setModelPricing] = useState([]);
  const [showTokenOverlay, setShowTokenOverlay] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(false);

  // Error and success notifications
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Automatically bypass template selection if workflow was loaded from history
  useEffect(() => {
    if (workflowId || initialEstimation) {
      setIsTemplateSelected(true);
    }
    if (workflowId) {
      fetch(`/api/v1/estimation/WorkflowConfigs(${workflowId})?$expand=workers`)
        .then(res => res.json())
        .then(data => {
          if (!data.error && data.ID) {
            setName(data.name || 'Loaded Workflow');
            setProject(data.project || '');
            setExecutionMode((data.orchestrationPattern === 'subagents_router' ? 'sequential' : data.orchestrationPattern) || 'sequential');
            setStateMode(data.stateMode || 'scoped_subgraph');
            setComplexityProfile(data.complexityProfile || 'standard');
            setExpectedRoutingCycles(toNumber(data.expectedRoutingCycles, 4));
            setUseCustomRoutingCycles(toBoolean(data.useCustomRoutingCycles));
            setMonthlyRunVolume(toInteger(data.monthlyRunVolume, 10000));
            setPromptCachingEnabled(toBoolean(data.promptCachingEnabled, true));
            setEstimatedCacheHitRate(toNumber(data.estimatedCacheHitRate, 0.50));
            setSupervisorModelId(data.supervisorModel_ID || '');
            if (data.synthesizerModel_ID) setSynthesizerModelId(data.synthesizerModel_ID);
            setSupervisorSystemPromptTokens(toInteger(data.supervisorSystemPromptTokens, 500));
            setWorkerRegistryTokens(toInteger(data.workerRegistryTokens, 200));
            setAvgToolSchemaTokens(toInteger(data.avgToolSchemaTokens, 250));
            if (data.workers && data.workers.length > 0) {
              setWorkers(data.workers.map(w => ({
                ID: w.ID,
                name: w.name,
                model_ID: w.model_ID,
                toolCount: toInteger(w.toolCount, 0),
                taskType: w.taskType || 'analysis',
                avgObservationTokens: toInteger(w.avgObservationTokens, 1000),
                basePromptTokens: toInteger(w.basePromptTokens, 400),
                avgOutputTokensPerHop: toInteger(w.avgOutputTokensPerHop, 300),
                useCustomToolHops: toBoolean(w.useCustomToolHops),
                avgToolHops: toNumber(w.avgToolHops, 2),
                retryProbability: toNumber(w.retryProbability, 0.10),
                executionMode: w.executionMode || 'sequential',
                parallelInstances: toInteger(w.parallelInstances, 1),
                isReflectorNode: toBoolean(w.isReflectorNode),
                refinementIterations: toInteger(w.refinementIterations, 1)
              })));
            }
            if (data.telemetryMetadata) {
              let tplMeta = data.telemetryMetadata;
              if (typeof tplMeta === 'string') {
                try { tplMeta = JSON.parse(tplMeta); } catch (e) { tplMeta = null; }
              }
              setActiveTelemetryBenchmark(tplMeta || null);
            }
            setTriggerAutoLayout(true);
          }
        })
        .catch(err => console.error("Error loading workflow config:", err));
    }
  }, [workflowId, initialEstimation]);

  // Fetch models from CAP Service
  useEffect(() => {
    fetch('/api/v1/estimation/ModelConfigs?$orderby=provider,modelName')
      .then(res => res.json())
      .then(data => {
        const list = sortByProviderAndModel(data.value || []);
        setModels(list);
        if (list.length > 0) {
          // Set initial defaults
          const gpt4o = list.find(m => m.modelName === 'gpt-4o');
          const mini = list.find(m => m.modelName === 'gpt-4o-mini');
          setSupervisorModelId(prev => prev || (gpt4o ? gpt4o.ID : list[0].ID));
          setSynthesizerModelId(prev => prev || (mini ? mini.ID : list[0].ID));
          // Set initial models for workers only if not already assigned
          setWorkers(prev => prev.map(w => ({ ...w, model_ID: w.model_ID || (mini ? mini.ID : list[0].ID) })));
        }
        setLoadingModels(false);
      })
      .catch(err => {
        console.error("Failed to load models:", err);
        setLoadingModels(false);
        setErrorMsg("Failed to load models from CAP service. Using offline fallback.");
      });
  }, []);

  // Load global pricing defaults and copy them into per-estimation input parameters
  useEffect(() => {
    fetch('/api/v1/estimation/GlobalAssumptionSettings')
      .then(res => res.json())
      .then(data => {
        const settings = data.value || [];
        const cuMultiplier = settings.find(s => s.settingKey === 'capacity_units_per_token');
        const cuCost = settings.find(s => s.settingKey === 'capacity_unit_cost_eur');
        if (cuMultiplier) setCapacityUnitsPerToken(Number.parseFloat(cuMultiplier.settingValue) || 1.90385);
        if (cuCost) setCapacityUnitCostEur(Number.parseFloat(cuCost.settingValue) || 1.04);
      })
      .catch(err => {
        console.error("Failed to load GenAI Hub pricing defaults:", err);
      });
  }, []);

  // Load ModelPricing for live token/CU/cost telemetry overlay
  useEffect(() => {
    fetch('/api/v1/estimation/ModelPricing')
      .then(res => res.json())
      .then(data => {
        setModelPricing(data.value || []);
      })
      .catch(err => {
        console.error("Failed to load model pricing:", err);
      });
  }, []);

  // Fetch saved custom templates from database
  const fetchCustomTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/estimation/WorkflowConfigs?$filter=isTemplate eq true&$expand=workers');
      if (res.ok) {
        const data = await res.json();
        const templates = (data.value || []).map(t => {
          let parsedMeta = t.telemetryMetadata;
          if (typeof parsedMeta === 'string') {
            try {
              parsedMeta = JSON.parse(parsedMeta);
            } catch (e) {
              console.warn("Could not parse telemetryMetadata for template:", t.name, e);
              parsedMeta = null;
            }
          }
          return {
            ...t,
            executionMode: t.executionMode || (parsedMeta?.detectedConcurrency ? 'parallel_map_reduce' : 'sequential'),
            isCustomTemplate: true,
            telemetryMetadata: parsedMeta,
            description: t.notes || `Custom template with ${t.workers?.length || 0} agents (${t.telemetrySource || 'manual'})`,
            workers: (t.workers || []).map(w => ({
              name: w.name,
              model_ID: w.model_ID,
              toolCount: w.toolCount,
              taskType: w.taskType,
              avgObservationTokens: w.avgObservationTokens,
              basePromptTokens: w.basePromptTokens,
              avgOutputTokensPerHop: w.avgOutputTokensPerHop,
              retryProbability: w.retryProbability,
              executionMode: w.executionMode,
              parallelInstances: w.parallelInstances,
              isReflectorNode: w.isReflectorNode,
              refinementIterations: w.refinementIterations,
              avgToolHops: w.avgToolHops,
              useCustomToolHops: w.useCustomToolHops
            }))
          };
        });
        setCustomTemplates(templates);
      }
    } catch (err) {
      console.warn("Could not load custom templates:", err);
    }
  }, []);

  useEffect(() => {
    fetchCustomTemplates();
  }, [fetchCustomTemplates]);

  // Delete saved custom template from database
  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setIsDeletingTemplate(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/estimation/deleteTemplate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templateToDelete.ID })
      });

      if (!res.ok) {
        // Fallback to standard OData DELETE if action fails
        const fallbackRes = await fetch(`/api/v1/estimation/WorkflowConfigs(${templateToDelete.ID})`, {
          method: 'DELETE'
        });
        if (!fallbackRes.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || 'Failed to delete template from database');
        }
      }

      setCustomTemplates(prev => prev.filter(t => t.ID !== templateToDelete.ID));
      if (activeCustomTemplateId === templateToDelete.ID) {
        setActiveCustomTemplateId(null);
        setIsTemplateSelected(false);
        if (onLoadWorkflow) onLoadWorkflow(null);
      }
      setSuccessMsg(`Template "${templateToDelete.name || 'Custom Template'}" was deleted successfully.`);
      setTemplateToDelete(null);
    } catch (err) {
      console.error("Failed to delete template:", err);
      setErrorMsg(err.message || "Failed to delete template");
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  // Extract distinct Customer / Domain values across custom templates and presets
  const allTemplateProjects = useMemo(() => {
    const set = new Set();
    customTemplates.forEach(t => {
      if (t.project && t.project.trim()) set.add(t.project.trim());
    });
    TEMPLATE_PRESETS.forEach(t => {
      if (t.project && t.project.trim()) set.add(t.project.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customTemplates]);

  // Filtered Custom Templates
  const filteredCustomTemplates = useMemo(() => {
    if (templateCategory === 'preset') return [];
    return customTemplates.filter(t => {
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase();
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchDesc = (t.description || t.notes || '').toLowerCase().includes(q);
        const matchProj = (t.project || '').toLowerCase().includes(q);
        const matchTags = (t.tags || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchProj && !matchTags) return false;
      }
      if (templateProject !== 'ALL' && (t.project || '').trim() !== templateProject) {
        return false;
      }
      return true;
    });
  }, [customTemplates, templateSearch, templateCategory, templateProject]);

  // Filtered SAP Presets
  const filteredPresets = useMemo(() => {
    if (templateCategory === 'custom') return [];
    return TEMPLATE_PRESETS.filter(t => {
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase();
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchProj = (t.project || '').toLowerCase().includes(q);
        const matchTags = (t.tags || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchProj && !matchTags) return false;
      }
      if (templateProject !== 'ALL' && (t.project || '').trim() !== templateProject) {
        return false;
      }
      return true;
    });
  }, [templateSearch, templateCategory, templateProject]);

  const hasActiveTemplateFilters = templateSearch.trim() !== '' || templateCategory !== 'all' || templateProject !== 'ALL';
  const handleResetTemplateFilters = () => {
    setTemplateSearch('');
    setTemplateCategory('all');
    setTemplateProject('ALL');
  };

  const toggleModelProvider = useCallback((provider) => {
    setCollapsedModelProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  const renderGroupedModelMenuItems = useCallback((selectedValue) => (
    groupedModels.flatMap(group => {
      const isCollapsed = collapsedModelProviders.has(group.provider);
      const visibleModels = isCollapsed
        ? group.models.filter(m => m.ID === selectedValue)
        : group.models;

      return [
        <ListSubheader
          key={`${group.provider}-header`}
          disableSticky
          component="div"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleModelProvider(group.provider);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          sx={{
            bgcolor: '#eef2ff',
            color: 'secondary.main',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.8,
            lineHeight: '32px',
            px: 1.5,
            textTransform: 'uppercase',
            '&:hover': { bgcolor: '#e0e7ff' }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {isCollapsed ? <KeyboardArrowRightIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
            <span>{group.label} · {group.models.length} models</span>
          </Box>
        </ListSubheader>,
        ...visibleModels.map(m => (
          <MenuItem key={m.ID} value={m.ID} sx={{ pl: 3, display: isCollapsed ? 'none' : 'flex' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }} noWrap>
                {m.modelName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {getProviderLabel(m.provider)}
              </Typography>
            </Box>
          </MenuItem>
        ))
      ];
    })
  ), [collapsedModelProviders, groupedModels, toggleModelProvider]);

  // Handle template selection
  const handleApplyTemplate = (preset) => {
    if (preset.isCustomTemplate && preset.ID) {
      setActiveCustomTemplateId(preset.ID);
    } else {
      setActiveCustomTemplateId(null);
    }
    setName(preset.name || 'Calibrated Workflow');
    setProject(preset.project || 'Default Project');
    setExecutionMode(preset.executionMode || 'sequential');
    setStateMode(preset.stateMode || 'scoped_subgraph');
    setComplexityProfile(preset.complexityProfile || 'standard');
    setExpectedRoutingCycles(preset.expectedRoutingCycles || 4);
    setUseCustomRoutingCycles(preset.useCustomRoutingCycles !== undefined ? preset.useCustomRoutingCycles : true);
    setPromptCachingEnabled(preset.promptCachingEnabled !== undefined ? preset.promptCachingEnabled : true);
    setEstimatedCacheHitRate(preset.estimatedCacheHitRate || 0.50);
    setMonthlyRunVolume(preset.monthlyRunVolume || 10000);
    setTags(preset.tags || 'erp');
    if (preset.notes) setNotes(preset.notes);
    if (preset.supervisorSystemPromptTokens !== undefined && preset.supervisorSystemPromptTokens !== null) {
      setSupervisorSystemPromptTokens(toInteger(preset.supervisorSystemPromptTokens, 500));
    }
    if (preset.workerRegistryTokens !== undefined && preset.workerRegistryTokens !== null) {
      setWorkerRegistryTokens(toInteger(preset.workerRegistryTokens, 200));
    }
    if (preset.avgToolSchemaTokens !== undefined && preset.avgToolSchemaTokens !== null) {
      setAvgToolSchemaTokens(toInteger(preset.avgToolSchemaTokens, 250));
    }
    let tplMetadata = preset.telemetryMetadata;
    if (typeof tplMetadata === 'string') {
      try {
        tplMetadata = JSON.parse(tplMetadata);
      } catch (e) {
        tplMetadata = null;
      }
    }
    setActiveTelemetryBenchmark(tplMetadata || null);

    // Map worker models based on fetched model list
    if (models.length > 0) {
      const gpt4o = models.find(m => m.modelName === 'gpt-4o');
      const mini = models.find(m => m.modelName === 'gpt-4o-mini');
      const sonnet = models.find(m => m.modelName.includes('claude-3-5-sonnet'));

      // Set supervisor model matching template specs
      if (preset.supervisorModel_ID) {
        setSupervisorModelId(preset.supervisorModel_ID);
      } else if (preset.supervisorModelName) {
        const matched = matchModelToCatalog(preset.supervisorModelName, models);
        setSupervisorModelId(matched?.ID || models[0].ID);
      } else if (preset.name.includes('Intercompany')) {
        setSupervisorModelId(sonnet ? sonnet.ID : models[0].ID);
      } else {
        setSupervisorModelId(gpt4o ? gpt4o.ID : models[0].ID);
      }

      if (preset.synthesizerModel_ID) {
        setSynthesizerModelId(preset.synthesizerModel_ID);
      } else if (preset.synthesizerModelName) {
        const matched = matchModelToCatalog(preset.synthesizerModelName, models);
        setSynthesizerModelId(matched?.ID || models[0].ID);
      } else {
        setSynthesizerModelId(mini ? mini.ID : models[0].ID);
      }

      const mappedWorkers = (preset.workers || []).map((w, idx) => {
        let selectedModelId = w.model_ID;
        if (!selectedModelId && w.modelName) {
          const matched = matchModelToCatalog(w.modelName, models);
          selectedModelId = matched?.ID;
        }
        if (!selectedModelId) {
          selectedModelId = mini ? mini.ID : models[0].ID;
          if (w.name.includes('Validator') || w.name.includes('Specialist') || w.name.includes('Matching')) {
            selectedModelId = sonnet ? sonnet.ID : (gpt4o ? gpt4o.ID : models[0].ID);
          }
        }
        return {
          ID: `w-${idx}`,
          name: w.name,
          model_ID: selectedModelId,
          toolCount: w.toolCount,
          taskType: w.taskType || 'analysis',
          avgObservationTokens: w.avgObservationTokens || 1000,
          basePromptTokens: w.basePromptTokens || 400,
          avgOutputTokensPerHop: w.avgOutputTokensPerHop || 300,
          useCustomToolHops: w.useCustomToolHops !== undefined ? w.useCustomToolHops : false,
          avgToolHops: w.avgToolHops !== undefined ? w.avgToolHops : 2,
          retryProbability: w.retryProbability !== undefined ? w.retryProbability : 0.10,
          executionMode: w.executionMode || 'sequential',
          parallelInstances: w.parallelInstances || 1,
          isReflectorNode: Boolean(w.isReflectorNode),
          refinementIterations: w.refinementIterations || 1
        };
      });
      setWorkers(mappedWorkers);
      setTriggerAutoLayout(true);
    }
    setIsTemplateSelected(true);
  };

  // Add a new worker node
  const handleAddWorker = () => {
    const mini = models.find(m => m.modelName === 'gpt-4o-mini');
    const newWorker = {
      ID: `w-${Date.now()}`,
      name: `Worker Agent ${workers.length + 1}`,
      model_ID: mini ? mini.ID : (models[0]?.ID || ''),
      toolCount: 3,
      taskType: 'analysis',
      avgObservationTokens: 1000,
      basePromptTokens: 400,
      avgOutputTokensPerHop: 300,
      useCustomToolHops: false,
      avgToolHops: 2,
      retryProbability: 0.10,
      executionMode: 'sequential',
      parallelInstances: 1,
      isReflectorNode: false,
      refinementIterations: 1
    };
    setWorkers([...workers, newWorker]);
  };

  // Delete a worker node
  const handleDeleteWorker = useCallback((index) => {
    setWorkers(prev => {
      const updated = prev.filter((_, idx) => idx !== index);
      // We check if the selected index is deleted
      return updated;
    });
    if (selectedWorkerIndex === index) {
      setDrawerOpen(false);
      setSelectedWorkerIndex(null);
    }
  }, [selectedWorkerIndex]);


  // Worker detail edit helper
  const handleWorkerChange = (field, value) => {
    if (selectedWorkerIndex === null) return;
    const updated = [...workers];
    updated[selectedWorkerIndex][field] = value;
    setWorkers(updated);
  };

  // Load selected workflow / estimation from history (triggered via onLoadWorkflow callback)
  useEffect(() => {
    if (initialEstimation) {
      setEstimationResult(initialEstimation);
    }
  }, [initialEstimation]);

  // Derived routing cycles heuristic (Complexity Profile -> expectedRoutingCycles)
  useEffect(() => {
    if (!useCustomRoutingCycles) {
      let baseM = 4;
      if (complexityProfile === 'simple') baseM = 2;
      else if (complexityProfile === 'standard') baseM = 4;
      else if (complexityProfile === 'complex') baseM = 6;
      else if (complexityProfile === 'research_heavy') baseM = 10;

      // Adjust for workers count
      const derived = baseM + Math.max(0, workers.length - baseM) * 0.5;
      setExpectedRoutingCycles(derived);
    }
  }, [complexityProfile, useCustomRoutingCycles, workers.length]);

  // Derive worker hops L based on Task Type & toolCount
  const getDerivedHops = useCallback((w) => {
    if (w.useCustomToolHops && w.avgToolHops) {
      return Math.max(1, Math.round(Number(w.avgToolHops) || 1));
    }
    let baseL = 3;
    if (w.taskType === 'simple_lookup') baseL = 1;
    else if (w.taskType === 'retrieval_response') baseL = 2;
    else if (w.taskType === 'analysis') baseL = 3;
    else if (w.taskType === 'transformation') baseL = 4;
    else if (w.taskType === 'multi_step_reasoning') baseL = 6;
    else if (w.taskType === 'erp_data_pipeline') baseL = 8;

    const derived = baseL + Math.floor(w.toolCount / 5) * 0.5;
    return Math.max(1, Math.round(derived));
  }, []);

  // Compute real-time token, CU, and cost telemetry for nodes and edges
  const getNodeTelemetry = useCallback((nodeType, modelId, workerConfig = null) => {
    const model = models.find(m => m.ID === modelId) || {};
    const pricing = modelPricing.find(p => p.provider === model.provider && p.modelName === model.modelName) || {};
    
    const inputRate = Number.parseFloat(pricing.genAiTokenInputRate || 0);
    const outputRate = Number.parseFloat(pricing.genAiTokenOutputRate || 0);
    const inputPrice = Number.parseFloat(pricing.inputPricePerMtok || model.customPriceInputPerMtok || 0);
    const outputPrice = Number.parseFloat(pricing.outputPricePerMtok || model.customPriceOutputPerMtok || 0);
    const thinkingPrice = Number.parseFloat(pricing.thinkingPricePerMtok || outputPrice || 0);
    const thinkingMult = Number.parseFloat(model.thinkingTokenMultiplier || 0);

    let inputTokens = 0;
    let outputTokens = 0;
    let thinkingTokens = 0;
    let formula = '';
    let hopsCount = 1;

    if (nodeType === 'supervisor') {
      const sysTok = toInteger(supervisorSystemPromptTokens, 500);
      const regTok = toInteger(workerRegistryTokens, 200);
      inputTokens = sysTok + regTok;
      outputTokens = 150; // Standard routing decision / worker dispatch JSON call
      hopsCount = 1;

      const breakdown = regTok > 0
        ? `System Prompt (${sysTok.toLocaleString()}) + Worker Registry (${regTok.toLocaleString()})`
        : `System Prompt (${sysTok.toLocaleString()}) + Worker Registry (0)`;

      formula = `• Input: ${inputTokens.toLocaleString()} tok = ${breakdown}\n• Output: ${outputTokens.toLocaleString()} tok = Routing Decision / Worker Dispatch Payload\n• Total: ${(inputTokens + outputTokens).toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out)`;
    } else if (nodeType === 'synthesizer') {
      inputTokens = 1500;
      outputTokens = 500;
      thinkingTokens = Math.round(outputTokens * thinkingMult);
      hopsCount = 1;

      formula = `• Input: 1,500 tok = Aggregated Worker Outputs Context\n• Output: 500 tok = Final Synthesis & Summary Report${thinkingTokens > 0 ? `\n• Thinking: ${thinkingTokens.toLocaleString()} tok (${outputTokens} out × ${thinkingMult}x)` : ''}\n• Total: ${(inputTokens + outputTokens + thinkingTokens).toLocaleString()} tokens (1,500 in / 500 out)`;
    } else if (nodeType === 'worker' && workerConfig) {
      const hops = Math.max(1, getDerivedHops(workerConfig));
      hopsCount = hops;
      const toolCount = workerConfig.toolCount || 0;
      const obsTokens = workerConfig.avgObservationTokens || 1000;
      const basePrompt = workerConfig.basePromptTokens !== undefined && workerConfig.basePromptTokens !== null ? Number(workerConfig.basePromptTokens) : 400;
      const hopOutTok = workerConfig.avgOutputTokensPerHop !== undefined && workerConfig.avgOutputTokensPerHop !== null ? Number(workerConfig.avgOutputTokensPerHop) : 300;
      const schemaTok = toInteger(avgToolSchemaTokens, 250);
      const toolSchemaTotal = toolCount * schemaTok;
      
      let totalInput = 0;
      let hist = 0;
      const hopDetails = [];

      for (let h = 1; h <= hops; h++) {
        // Matches srv/estimation-service.js line 1040:
        // Context window for hop h = base prompt + tool schemas + accumulated history from previous hops
        const hopIn = basePrompt + toolSchemaTotal + hist;
        totalInput += hopIn;
        hopDetails.push({
          hop: h,
          hopIn,
          base: basePrompt,
          tools: toolSchemaTotal,
          hist
        });
        // Matches srv/estimation-service.js line 1058-1059:
        // Assistant tool call (~300 tok max) + observation, with 30% history compression (0.7 factor)
        const stateAppendOutputTok = Math.min(300, hopOutTok);
        hist += Math.round((stateAppendOutputTok + obsTokens) * 0.7);
      }
      inputTokens = Math.round(totalInput);
      outputTokens = Math.round(hopOutTok * hops);
      thinkingTokens = Math.round(outputTokens * thinkingMult);

      const hopInputBreakdown = hops === 1
        ? `Base (${basePrompt}) + Tools (${toolCount} × ${schemaTok} = ${toolSchemaTotal}) = ${inputTokens.toLocaleString()} tok`
        : hopDetails.map(d => `Hop ${d.hop}: ${d.base} base + ${d.tools} tools${d.hist > 0 ? ` + ${d.hist} hist` : ''} = ${d.hopIn.toLocaleString()} tok`).join('\n  ↳ ') + `\n  Total Input = ${hopDetails.map(d => d.hopIn.toLocaleString()).join(' + ')} = ${inputTokens.toLocaleString()} tok`;

      formula = `• Input: ${inputTokens.toLocaleString()} tok across ${hops} ${hops === 1 ? 'hop' : 'hops'}\n  ↳ ${hopInputBreakdown}\n• Output: ${outputTokens.toLocaleString()} tok (${hops} ${hops === 1 ? 'hop' : 'hops'} × ${hopOutTok} tok/hop)${thinkingTokens > 0 ? `\n• Thinking: ${thinkingTokens.toLocaleString()} tok (${outputTokens.toLocaleString()} out × ${thinkingMult}x)` : ''}\n• Total: ${(inputTokens + outputTokens + thinkingTokens).toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out${thinkingTokens > 0 ? ` + ${thinkingTokens.toLocaleString()} think` : ''})`;
    }

    const billableOutput = outputTokens + thinkingTokens;
    const weightedTokens = ((inputTokens * inputRate) + (billableOutput * outputRate)) / 1000;
    const cu = inputRate > 0 || outputRate > 0
      ? weightedTokens * capacityUnitsPerToken
      : ((inputTokens + billableOutput) / 1000) * capacityUnitsPerToken;
      
    const costEur = cu * capacityUnitCostEur;
    const costUsd = ((inputTokens / 1e6) * inputPrice) + ((outputTokens / 1e6) * outputPrice) + ((thinkingTokens / 1e6) * thinkingPrice);

    return {
      inputTokens,
      outputTokens,
      thinkingTokens,
      hops: hopsCount,
      cu: cu.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
      costEur: costEur > 0 ? `€${costEur.toFixed(4)}` : (costUsd > 0 ? `$${costUsd.toFixed(4)}` : '€0.0050'),
      formula
    };
  }, [models, modelPricing, capacityUnitsPerToken, capacityUnitCostEur, getDerivedHops, supervisorSystemPromptTokens, workerRegistryTokens, avgToolSchemaTokens]);

  const getModelName = useCallback((id) => {
    const m = models.find(x => x.ID === id);
    return m ? m.modelName : 'Loading...';
  }, [models]);

  const getModelProvider = useCallback((id) => {
    const m = models.find(x => x.ID === id);
    return m ? m.provider : 'openai';
  }, [models]);

  // Recalculate layout of nodes and edges dynamically (preserving dragged positions unless forceLayout=true)
  const recalculateLayout = useCallback((forceLayout = false) => {
    const newNodes = [];
    const newEdges = [];

    // Calculate horizontal layout parameters for all workers
    const workerNodeX = 80;
    const xGap = 340; // 340px ensures generous spacing without overlap for 270px wide nodes
    const workerNodeY = 240;
    const totalWorkers = workers.length;

    // Center Supervisor above the horizontal line of workers
    const centerX = totalWorkers > 0 ? workerNodeX + ((totalWorkers - 1) * xGap) / 2 : 300;

    // 1. Supervisor
    const supId = 'supervisor';
    const supModel = getModelName(supervisorModelId);
    const supProv = getModelProvider(supervisorModelId);
    const supTelemetry = getNodeTelemetry('supervisor', supervisorModelId);
    
    newNodes.push({
      id: supId,
      type: 'custom',
      data: {
        label: name,
        isSupervisor: true,
        modelName: supModel,
        provider: supProv,
        showTokenOverlay,
        telemetry: supTelemetry
      },
      position: { x: centerX, y: 50 } // Centered above workers
    });

    // 2. Workers - Placed horizontally on one line without overlap
    workers.forEach((w, index) => {
      const hops = getDerivedHops(w);
      const mName = getModelName(w.model_ID);
      const mProv = getModelProvider(w.model_ID);
      const workerTelemetry = getNodeTelemetry('worker', w.model_ID, w);

      const defaultX = workerNodeX + (index * xGap);
      const defaultY = workerNodeY;

      newNodes.push({
        id: w.ID,
        type: 'custom',
        data: {
          label: w.name,
          taskType: w.taskType.replace('_', ' '),
          hops,
          tools: w.toolCount,
          modelName: mName,
          provider: mProv,
          showTokenOverlay,
          telemetry: workerTelemetry,
          onDeleteClick: (e) => {
            e.stopPropagation();
            handleDeleteWorker(index);
          }
        },
        position: { x: defaultX, y: defaultY }
      });

      // Edge from Supervisor to Worker (one bi-directional connector in sequential mode)
      const edgeLabel = showTokenOverlay
        ? (executionMode === 'sequential'
          ? `🪙 ~${workerTelemetry.inputTokens.toLocaleString()} in / ~${workerTelemetry.outputTokens.toLocaleString()} out`
          : `🪙 ~${workerTelemetry.inputTokens.toLocaleString()} tok`)
        : undefined;

      newEdges.push({
        id: `e-sup-${w.ID}`,
        source: 'supervisor',
        sourceHandle: 's',
        target: w.ID,
        targetHandle: 't',
        className: stateMode === 'scoped_subgraph' ? 'edge-scoped' : 'edge-global',
        animated: true,
        label: edgeLabel,
        labelStyle: { fill: '#0f172a', fontWeight: 700, fontSize: 11, fontFamily: 'Inter, sans-serif' },
        labelBgStyle: { fill: 'rgba(255, 255, 255, 0.95)', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1 },
        labelBgPadding: [8, 5],
        labelBgBorderRadius: 6,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: stateMode === 'scoped_subgraph' ? '#4f46e5' : '#ef4444',
        },
        ...(executionMode === 'sequential' ? {
          markerStart: {
            type: MarkerType.ArrowClosed,
            color: stateMode === 'scoped_subgraph' ? '#4f46e5' : '#ef4444',
          }
        } : {})
      });
    });

    // 3. Synthesizer
    if (executionMode === 'parallel_map_reduce') {
      const synthId = 'synthesizer';
      const synthModel = getModelName(synthesizerModelId);
      const synthProv = getModelProvider(synthesizerModelId);
      const synthTelemetry = getNodeTelemetry('synthesizer', synthesizerModelId);
      
      const defaultSynthX = centerX;
      const defaultSynthY = 440; // Centered below workers

      newNodes.push({
        id: synthId,
        type: 'custom',
        data: {
          label: 'Price & Data Synthesizer',
          isSynthesizer: true,
          modelName: synthModel,
          provider: synthProv,
          showTokenOverlay,
          telemetry: synthTelemetry
        },
        position: { x: defaultSynthX, y: defaultSynthY }
      });

      // Connect workers to Synthesizer
      workers.forEach((w) => {
        const workerTelemetry = getNodeTelemetry('worker', w.model_ID, w);
        newEdges.push({
          id: `e-${w.ID}-synth`,
          source: w.ID,
          sourceHandle: 's',
          target: synthId,
          targetHandle: 't',
          className: stateMode === 'scoped_subgraph' ? 'edge-scoped' : 'edge-global',
          animated: true,
          label: showTokenOverlay ? `🪙 ~${workerTelemetry.outputTokens.toLocaleString()} tok` : undefined,
          labelStyle: { fill: '#0f172a', fontWeight: 700, fontSize: 11, fontFamily: 'Inter, sans-serif' },
          labelBgStyle: { fill: 'rgba(255, 255, 255, 0.95)', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1 },
          labelBgPadding: [8, 5],
          labelBgBorderRadius: 6,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: stateMode === 'scoped_subgraph' ? '#4f46e5' : '#ef4444',
          },
        });
      });
    }

    // Preserve dragged coords unless forced auto layout
    setNodes((prevNodes) => {
      return newNodes.map(node => {
        const existingNode = prevNodes.find(n => n.id === node.id);
        if (!forceLayout && existingNode) {
          return { ...node, position: existingNode.position };
        }
        return node;
      });
    });

    setEdges(newEdges);
  }, [workers, executionMode, stateMode, supervisorModelId, synthesizerModelId, name, models, showTokenOverlay, supervisorSystemPromptTokens, workerRegistryTokens, avgToolSchemaTokens, getNodeTelemetry, getDerivedHops, getModelName, getModelProvider, setNodes, setEdges, handleDeleteWorker]);

  // Synchronize layout when parameters change
  useEffect(() => {
    if (triggerAutoLayout) {
      recalculateLayout(true);
      setTriggerAutoLayout(false);
    } else {
      recalculateLayout(false);
    }
  }, [workers, executionMode, stateMode, supervisorModelId, synthesizerModelId, name, models, showTokenOverlay, modelPricing, supervisorSystemPromptTokens, workerRegistryTokens, avgToolSchemaTokens, triggerAutoLayout, recalculateLayout]);


  // Deep save the workflow config and invoke estimation
  const handleRunEstimation = async (isMonteCarlo = false) => {
    setEstimating(true);
    setMonteCarloMode(isMonteCarlo);
    setErrorMsg(null);

    try {
      // 1. Save workflow config metadata
      const workflowData = {
        name,
        project,
        orchestrationPattern: executionMode || 'sequential',
        stateMode,
        complexityProfile,
        expectedRoutingCycles: parseFloat(expectedRoutingCycles),
        useCustomRoutingCycles,
        monthlyRunVolume: parseInt(monthlyRunVolume),
        promptCachingEnabled,
        estimatedCacheHitRate: parseFloat(estimatedCacheHitRate),
        hitlPauseDuration,
        tags,
        notes,
        supervisorModel_ID: supervisorModelId,
        synthesizerModel_ID: executionMode === 'parallel_map_reduce' ? synthesizerModelId : null,
        supervisorSystemPromptTokens: toInteger(supervisorSystemPromptTokens, 500),
        workerRegistryTokens: toInteger(workerRegistryTokens, 200),
        avgToolSchemaTokens: toInteger(avgToolSchemaTokens, 250),
      };

      let workflowDbId = workflowId;
      
      // If it's a new workflow, POST to create
      if (!workflowDbId) {
        const createRes = await fetch('/api/v1/estimation/WorkflowConfigs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowData)
        });
        const createdObj = await createRes.json();
        if (createdObj.error) throw new Error(createdObj.error.message);
        workflowDbId = createdObj.ID;
      } else {
        // PATCH existing workflow config
        const updateRes = await fetch(`/api/v1/estimation/WorkflowConfigs(${workflowDbId})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workflowData)
        });
        if (updateRes.status >= 400) {
          const errData = await updateRes.json();
          throw new Error(errData.error?.message || "Failed to update workflow metadata");
        }

        // Fetch and Delete old workers
        const getWorkersRes = await fetch(`/api/v1/estimation/WorkerConfigs?$filter=workflow_ID eq ${workflowDbId}`);
        const oldWorkers = await getWorkersRes.json();
        for (const oldW of (oldWorkers.value || [])) {
          await fetch(`/api/v1/estimation/WorkerConfigs(${oldW.ID})`, { method: 'DELETE' });
        }
      }

      // 2. Insert new workers
      for (const w of workers) {
        const workerData = {
          workflow_ID: workflowDbId,
          name: w.name,
          model_ID: w.model_ID,
          toolCount: parseInt(w.toolCount),
          taskType: w.taskType,
          avgToolHops: parseFloat(getDerivedHops(w)),
          avgObservationTokens: parseInt(w.avgObservationTokens) || 1000,
          basePromptTokens: parseInt(w.basePromptTokens) || 400,
          avgOutputTokensPerHop: parseInt(w.avgOutputTokensPerHop) || 300,
          retryProbability: parseFloat(w.retryProbability),
          executionMode: w.executionMode,
          parallelInstances: parseInt(w.parallelInstances || 1),
          isReflectorNode: w.isReflectorNode,
          refinementIterations: parseInt(w.refinementIterations || 1),
          useCustomToolHops: Boolean(w.useCustomToolHops)
        };

        const wCreateRes = await fetch('/api/v1/estimation/WorkerConfigs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workerData)
        });
        if (wCreateRes.status >= 400) {
          const errData = await wCreateRes.json();
          throw new Error(errData.error?.message || "Failed to save workers configurations");
        }
      }

      // Propagate ID to parent App.jsx
      onLoadWorkflow(workflowDbId);

      // 3. Trigger action
      const actionName = isMonteCarlo ? 'runMonteCarloSimulation' : 'runEstimation';
      const actionPayload = {
        workflowId: workflowDbId,
        capacityUnitsPerToken: parseFloat(capacityUnitsPerToken),
        capacityUnitCostEur: parseFloat(capacityUnitCostEur)
      };
      if (isMonteCarlo) actionPayload.iterations = 1000;

      const actionRes = await fetch(`/api/v1/estimation/${actionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionPayload)
      });
      const actionData = await actionRes.json();
      if (actionData.error) throw new Error(actionData.error.message);

      // 4. Load resulting estimation details
      const summary = JSON.parse(actionData.summary || '{}');
      setEstimationResult(summary);
      setEstimating(false);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred during calculation.");
      setEstimating(false);
    }
  };

  // Render Screen 2 (Dashboard) if result is calculated
  if (estimationResult) {
    return (
      <ExecutiveDashboard 
        estimation={estimationResult} 
        isMonteCarlo={monteCarloMode}
        onBack={() => setEstimationResult(null)} 
      />
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f8fafc' }}>
      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)} sx={{ borderRadius: 2 }}>
          {errorMsg}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ borderRadius: 2 }}>
          {successMsg}
        </Alert>
      )}

      {/* Template Selection Screen */}
      {!isTemplateSelected ? (
        <Box sx={{ 
          maxWidth: 1200, 
          mx: 'auto', 
          width: '100%',
          px: { xs: 2, md: 4 }, 
          py: 4, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 4 
        }}>
          {/* Header Hero Section */}
          <Box sx={{ textAlign: 'center', mb: 1 }}>
            <Typography variant="h5" sx={{ 
              fontWeight: 700, 
              fontFamily: '"Outfit", sans-serif', 
              color: 'secondary.main',
              mb: 1,
              background: 'linear-gradient(135deg, #0f172a 0%, #4f46e5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Choose a Workflow Template to Start
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 500 }}>
              Select from our pre-configured enterprise SAP templates optimized for agentic orchestration, or start with a custom blank canvas.
            </Typography>
          </Box>

          {/* Search & Filter Toolbar */}
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              borderRadius: 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              bgcolor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            <Grid container spacing={2} alignItems="center">
              {/* Search text field */}
              <Grid item xs={12} sm={6} md={5}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search template name, customer, tags..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                    endAdornment: templateSearch && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setTemplateSearch('')}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{ bgcolor: '#f8fafc', borderRadius: 1 }}
                />
              </Grid>

              {/* Customer / Domain Dropdown */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small" sx={{ bgcolor: '#f8fafc', borderRadius: 1 }}>
                  <InputLabel id="tpl-project-filter-label">Customer / Domain</InputLabel>
                  <Select
                    labelId="tpl-project-filter-label"
                    value={templateProject}
                    label="Customer / Domain"
                    onChange={(e) => setTemplateProject(e.target.value)}
                  >
                    <MenuItem value="ALL">All Customers & Domains ({allTemplateProjects.length})</MenuItem>
                    {allTemplateProjects.map(proj => (
                      <MenuItem key={proj} value={proj}>{proj}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Reset Filters action */}
              <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
                {hasActiveTemplateFilters && (
                  <Button 
                    size="small" 
                    variant="text" 
                    color="secondary"
                    startIcon={<ClearIcon />}
                    onClick={handleResetTemplateFilters}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    Reset Filters
                  </Button>
                )}
              </Grid>
            </Grid>

            {/* Category / Source Filter Chips */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
                Category:
              </Typography>
              <Chip
                label={`All Templates (${customTemplates.length + TEMPLATE_PRESETS.length})`}
                size="small"
                clickable
                color={templateCategory === 'all' ? 'primary' : 'default'}
                variant={templateCategory === 'all' ? 'filled' : 'outlined'}
                onClick={() => setTemplateCategory('all')}
                sx={{ height: 24, fontSize: 12, fontWeight: templateCategory === 'all' ? 700 : 500 }}
              />
              <Chip
                label={`Custom & OTel (${customTemplates.length})`}
                size="small"
                clickable
                color={templateCategory === 'custom' ? 'primary' : 'default'}
                variant={templateCategory === 'custom' ? 'filled' : 'outlined'}
                onClick={() => setTemplateCategory(prev => prev === 'custom' ? 'all' : 'custom')}
                sx={{ height: 24, fontSize: 12, fontWeight: templateCategory === 'custom' ? 700 : 500 }}
              />
              <Chip
                label={`SAP Presets (${TEMPLATE_PRESETS.length})`}
                size="small"
                clickable
                color={templateCategory === 'preset' ? 'primary' : 'default'}
                variant={templateCategory === 'preset' ? 'filled' : 'outlined'}
                onClick={() => setTemplateCategory(prev => prev === 'preset' ? 'all' : 'preset')}
                sx={{ height: 24, fontSize: 12, fontWeight: templateCategory === 'preset' ? 700 : 500 }}
              />
            </Box>
          </Paper>

          {/* Template Grid */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
            gap: 3 
          }}>
            {/* OpenTelemetry Ingestion Hero Card */}
            {templateCategory !== 'preset' && (
            <Card 
              onClick={() => setIsTelemetryModalOpen(true)}
              sx={{ 
                cursor: 'pointer', 
                height: 300,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '2px dashed',
                borderColor: 'primary.main',
                position: 'relative',
                overflow: 'hidden',
                bgcolor: '#f5f3ff',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '4px',
                  background: 'linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%)',
                },
                '&:hover': { 
                  boxShadow: '0 14px 32px rgba(79, 70, 229, 0.2)', 
                  transform: 'translateY(-6px)',
                  bgcolor: '#ede9fe'
                }
              }}
            >
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CloudUploadIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', lineHeight: 1.2, fontSize: '1rem' }}>
                      Import from OTel Runs
                    </Typography>
                  </Box>
                  <Chip 
                    label="Auto-Detect" 
                    size="small" 
                    color="primary" 
                    sx={{ 
                      fontWeight: 700, 
                      fontSize: '10px', 
                      height: 20, 
                      flexShrink: 0
                    }} 
                  />
                </Box>

                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    fontSize: '13px', 
                    lineHeight: 1.5
                  }}
                >
                  Upload OpenTelemetry or OpenInference runtime traces from real agent runs. Automatically reconstructs the agent topology, routing cycles (M), and tool hops (L̄).
                </Typography>

                <Box sx={{ 
                  bgcolor: 'rgba(255, 255, 255, 0.85)', 
                  p: 2, 
                  borderRadius: 1.5, 
                  border: '1px solid', 
                  borderColor: 'rgba(79, 70, 229, 0.2)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 0.8, 
                  mt: 'auto' 
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Formats:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>OTLP JSON · OpenInference</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>Baselines:</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>P50 Median · P90 Ceiling</Typography>
                  </Box>
                </Box>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ mt: 1, fontWeight: 700, borderRadius: 2 }}
                >
                  Import Telemetry Trace
                </Button>
              </CardContent>
            </Card>
            )}

            {/* Custom Saved Templates from Database */}
            {filteredCustomTemplates.map((t, idx) => (
              <Card 
                key={`custom-tpl-${idx}`}
                onClick={() => handleApplyTemplate(t)}
                sx={{ 
                  cursor: 'pointer', 
                  height: 300,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: '1px solid',
                  borderColor: 'primary.light',
                  bgcolor: '#ffffff',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '4px',
                    background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
                  },
                  '&:hover': { 
                    borderColor: 'primary.main', 
                    boxShadow: '0 12px 30px rgba(16, 185, 129, 0.15)', 
                    transform: 'translateY(-6px)' 
                  }
                }}
              >
                <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 40, gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', lineHeight: 1.2, fontSize: '1rem', flex: 1, minWidth: 0 }}>
                      {t.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip 
                        label={t.telemetryRunsCount ? `OTel (${t.telemetryRunsCount} runs)` : "Custom Template"} 
                        size="small" 
                        color="success"
                        sx={{ 
                          fontWeight: 700, 
                          fontSize: '10px', 
                          height: 20, 
                          flexShrink: 0
                        }} 
                      />
                      <Tooltip title="Delete Template">
                        <IconButton
                          size="small"
                          aria-label={`Delete ${t.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateToDelete(t);
                          }}
                          sx={{
                            color: 'text.secondary',
                            p: 0.5,
                            transition: 'all 0.2s',
                            '&:hover': {
                              color: 'error.main',
                              bgcolor: 'rgba(239, 68, 68, 0.1)',
                              transform: 'scale(1.1)'
                            }
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Customer / Project Badge & Creator */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={t.project || 'Default Project'} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontWeight: 600, fontSize: '11px', height: 20, bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}
                    />
                    {t.createdBy && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                        by {t.createdBy}
                      </Typography>
                    )}
                  </Box>

                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      height: 38, 
                      fontSize: '13px', 
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {t.description || t.notes || 'Calibrated workflow template.'}
                  </Typography>

                  <Box sx={{ 
                    bgcolor: '#f8fafc', 
                    p: 1.5, 
                    borderRadius: 2, 
                    border: '1px dashed #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.8
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Orchestration:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {t.executionMode === 'parallel_map_reduce' ? 'Parallel Map-Reduce' : 'Sequential Hub'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Complexity:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {(t.complexityProfile || 'standard').replace('_', ' ')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Worker Agents:</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {t.workers?.length || 0} agents
                      </Typography>
                    </Box>
                    {t.telemetryMetadata && (t.telemetryMetadata.totalInputTokens || t.telemetryMetadata.avgInputTokensPerRun) ? (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, borderTop: '1px dashed #cbd5e1' }}>
                        <Typography variant="caption" sx={{ color: 'success.dark', fontWeight: 600 }}>Ground Truth:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main' }}>
                          {(((t.telemetryMetadata.avgInputTokensPerRun || t.telemetryMetadata.totalInputTokens || 0) + (t.telemetryMetadata.avgOutputTokensPerRun || t.telemetryMetadata.totalOutputTokens || 0))).toLocaleString()} tok/run
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 'auto', minHeight: 22, alignItems: 'center' }}>
                    {(t.tags || 'custom').split(' ').map((tag, tIdx) => (
                      <Chip key={tIdx} label={tag} size="small" sx={{ fontSize: '9px', height: 18 }} />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            ))}

            {filteredPresets.map((t, idx) => {
              const isCustom = t.name === 'Custom Workflow';
              return (
                <Card 
                  key={idx}
                  onClick={() => handleApplyTemplate(t)}
                  sx={{ 
                    cursor: 'pointer', 
                    height: 300,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '4px',
                      background: isCustom 
                        ? 'linear-gradient(90deg, #64748b 0%, #475569 100%)' 
                        : 'linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%)',
                    },
                    '&:hover': { 
                      borderColor: isCustom ? 'text.secondary' : 'primary.main', 
                      boxShadow: '0 12px 30px rgba(79, 70, 229, 0.12)', 
                      transform: 'translateY(-6px)' 
                    }
                  }}
                >
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 40 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', lineHeight: 1.2, fontSize: '1rem' }}>
                        {t.name}
                      </Typography>
                      {isCustom ? (
                        <Chip 
                          label="Custom" 
                          size="small" 
                          variant="outlined" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: '10px', 
                            height: 20, 
                            color: 'text.secondary', 
                            borderColor: 'divider',
                            flexShrink: 0,
                            ml: 1
                          }} 
                        />
                      ) : (
                        <Chip 
                          label="SAP Preset" 
                          size="small" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: '10px', 
                            height: 20, 
                            bgcolor: 'primary.light', 
                            color: 'primary.main',
                            flexShrink: 0,
                            ml: 1
                          }} 
                        />
                      )}
                    </Box>

                    {/* Customer / Domain Badge */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={t.project} 
                        size="small" 
                        variant="outlined" 
                        sx={{ fontWeight: 600, fontSize: '11px', height: 20, bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}
                      />
                    </Box>

                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        height: 38, 
                        fontSize: '13px', 
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {t.description}
                    </Typography>

                    {/* Metadata summary */}
                    <Box sx={{ 
                      bgcolor: '#f8fafc', 
                      p: 1.5, 
                      borderRadius: 2, 
                      border: '1px dashed #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.8
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Orchestration:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {t.executionMode === 'parallel_map_reduce' ? 'Parallel Map-Reduce' : 'Sequential Hub'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Complexity:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {t.complexityProfile.replace('_', ' ')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">Worker Agents:</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {t.workers.length} agents
                        </Typography>
                      </Box>
                    </Box>

                    {/* Tags */}
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 'auto', minHeight: 22, alignItems: 'center' }}>
                      {t.tags.split(' ').map((tag, tIdx) => (
                        <Chip key={tIdx} label={tag} size="small" sx={{ fontSize: '9px', height: 18 }} />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}

            {/* Empty State when no templates match */}
            {filteredCustomTemplates.length === 0 && filteredPresets.length === 0 && (
              <Card sx={{ gridColumn: '1 / -1', p: 5, textAlign: 'center', bgcolor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                  No workflow templates match the current filter criteria
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Try adjusting your search query, selecting "All Customers", or resetting the category filter.
                </Typography>
                <Button variant="outlined" size="small" onClick={handleResetTemplateFilters}>
                  Reset All Filters
                </Button>
              </Card>
            )}
          </Box>
        </Box>
      ) : (
        /* Main Builder Full-Width Canvas */
        <Box sx={{ flexGrow: 1, position: 'relative', height: '700px', display: 'flex', flexDirection: 'column' }}>
          <Card sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Canvas Top Bar */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', zIndex: 5 }}>
              {/* Left: Title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LayersIcon sx={{ color: 'primary.main', fontSize: 26 }} />
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, color: 'secondary.main', fontFamily: '"Outfit", sans-serif' }}>
                    {name || 'Interactive Orchestration Topology Map'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {project ? `${project} · ` : ''}Configure parameters in the Global Specs panel
                  </Typography>
                </Box>
              </Box>

              {/* Right: Actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip 
                    arrow 
                    placement="bottom" 
                    title="Deterministic Baseline: Calculates happy-path monthly TCO using static averages (no retries, fixed hops, static cache rates). Best for rapid iteration and architecture comparison during workflow design."
                  >
                    <span style={{ display: 'inline-block' }}>
                      <Button 
                        size="small"
                        variant="contained" 
                        color="primary" 
                        startIcon={estimating && !monteCarloMode ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                        disabled={estimating || workers.length === 0}
                        onClick={() => handleRunEstimation(false)}
                        sx={{ fontWeight: 700 }}
                      >
                        {estimating && !monteCarloMode ? 'Calculating...' : 'Quick Estimate'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip 
                    arrow 
                    placement="bottom" 
                    title="Deterministic Baseline: Calculates happy-path monthly TCO using static averages (no retries, fixed hops, static cache rates). Best for rapid iteration and architecture comparison during workflow design."
                  >
                    <IconButton size="small" sx={{ color: 'text.secondary', p: 0.5 }}>
                      <HelpOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Tooltip 
                    arrow 
                    placement="bottom" 
                    title="Stochastic Risk Modeling: Runs 1,000 simulations injecting real-world variances (Poisson hops, retry loops, cache fluctuations) to predict P90 budget ceilings and P99 tail risk. Best for executive sign-off and stress-testing."
                  >
                    <span style={{ display: 'inline-block' }}>
                      <Button 
                        size="small"
                        variant="outlined" 
                        color="primary" 
                        startIcon={estimating && monteCarloMode ? <CircularProgress size={16} color="inherit" /> : <BarChartIcon />}
                        disabled={estimating || workers.length === 0}
                        onClick={() => handleRunEstimation(true)}
                        sx={{ fontWeight: 700 }}
                      >
                        {estimating && monteCarloMode ? 'Simulating...' : 'Risk Simulation'}
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip 
                    arrow 
                    placement="bottom" 
                    title="Stochastic Risk Modeling: Runs 1,000 simulations injecting real-world variances (Poisson hops, retry loops, cache fluctuations) to predict P90 budget ceilings and P99 tail risk. Best for executive sign-off and stress-testing."
                  >
                    <IconButton size="small" sx={{ color: 'text.secondary', p: 0.5 }}>
                      <HelpOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Box>

            {/* Telemetry Ground Truth Sanity Check Banner */}
            {activeTelemetryBenchmark && (
              <Box sx={{ 
                px: 2.5, 
                py: 0.75, 
                bgcolor: '#f0fdf4', 
                borderBottom: '1px solid #bbf7d0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                zIndex: 5,
                flexWrap: 'wrap',
                gap: 1
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip 
                    label="OTel Ground Truth" 
                    size="small" 
                    color="success" 
                    sx={{ height: 20, fontSize: 10, fontWeight: 700 }} 
                  />
                  {(() => {
                    const runs = activeTelemetryBenchmark.runsAnalyzed || 1;
                    const inTok = activeTelemetryBenchmark.avgInputTokensPerRun || activeTelemetryBenchmark.totalInputTokens || 0;
                    const outTok = activeTelemetryBenchmark.avgOutputTokensPerRun || activeTelemetryBenchmark.totalOutputTokens || 0;
                    const totalTok = inTok + outTok;
                    return (
                      <Typography variant="caption" sx={{ color: '#166534', fontWeight: 600 }}>
                        {runs} {runs === 1 ? 'Run' : 'Runs'} Measured: <strong>{inTok.toLocaleString()} input</strong> · <strong>{outTok.toLocaleString()} output</strong> (Total: {totalTok.toLocaleString()} tokens/run)
                      </Typography>
                    );
                  })()}
                </Box>
                <Typography variant="caption" sx={{ color: '#15803d', fontSize: 11 }}>
                  Sanity Check: Run <strong>Quick Estimate</strong> (with Volume = 1) to verify calibration against trace ground truth.
                </Typography>
              </Box>
            )}

            {/* Sub-Header: Builder Utilities Toolbar */}
            <Box sx={{ 
              p: 1.25, 
              borderBottom: 1, 
              borderColor: 'divider', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              bgcolor: '#f8fafc',
              zIndex: 4 
            }}>
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '999px',
                px: 2,
                py: 0.5,
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
              }}>
                <Button 
                  size="small" 
                  startIcon={<AutoAwesomeIcon />} 
                  variant="text" 
                  onClick={() => recalculateLayout(true)}
                  sx={{ color: 'text.primary', textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                >
                  Auto Layout
                </Button>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Button 
                  size="small" 
                  startIcon={<AddIcon />} 
                  variant="text" 
                  onClick={handleAddWorker}
                  sx={{ color: 'text.primary', textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                >
                  Add Worker
                </Button>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Button 
                  size="small" 
                  startIcon={<CloseIcon />} 
                  variant="text" 
                  onClick={() => {
                    onLoadWorkflow(null);
                    setActiveCustomTemplateId(null);
                    setIsTemplateSelected(false);
                  }}
                  sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                >
                  Reset
                </Button>
                {activeCustomTemplateId && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                    <Button 
                      size="small" 
                      startIcon={<DeleteIcon />} 
                      variant="text" 
                      onClick={() => {
                        const tpl = customTemplates.find(t => t.ID === activeCustomTemplateId) || { ID: activeCustomTemplateId, name };
                        setTemplateToDelete(tpl);
                      }}
                      sx={{ 
                        color: 'error.main', 
                        textTransform: 'none', 
                        fontWeight: 600, 
                        fontSize: 12,
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.08)' } 
                      }}
                    >
                      Delete Template
                    </Button>
                  </>
                )}
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Button 
                  size="small" 
                  startIcon={<SettingsIcon />} 
                  variant="text" 
                  onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
                  sx={{ 
                    color: isSpecsExpanded ? 'primary.main' : 'text.secondary', 
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: 12,
                    '&:hover': { bgcolor: 'action.hover' } 
                  }}
                >
                  {isSpecsExpanded ? 'Hide Specs' : 'Show Specs'}
                </Button>
                <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                <Button 
                  size="small" 
                  startIcon={<CloudUploadIcon />} 
                  variant="text" 
                  onClick={() => setIsTelemetryModalOpen(true)}
                  sx={{ 
                    color: 'primary.main', 
                    textTransform: 'none', 
                    fontWeight: 600, 
                    fontSize: 12,
                    '&:hover': { bgcolor: 'primary.light' }
                  }}
                >
                  Import OTel
                </Button>
              </Box>
            </Box>
            {/* React Flow Row Container (3-Column Layout: Left Worker Panel | Center React Flow | Right Specs Panel) */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', height: '100%' }}>

              {/* Left Panel - Configure Worker */}
              {drawerOpen && selectedWorkerIndex !== null && workers[selectedWorkerIndex] && (
                <Box sx={{
                  width: 360,
                  borderRight: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto'
                }}>
                  {/* Title bar */}
                  <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SettingsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      Configure Worker: {workers[selectedWorkerIndex].name}
                    </Typography>
                    <IconButton size="small" onClick={() => setDrawerOpen(false)}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  {/* Content */}
                  <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField 
                      label="Worker Name" 
                      value={workers[selectedWorkerIndex].name} 
                      onChange={(e) => handleWorkerChange('name', e.target.value)} 
                      fullWidth size="small" 
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel>Model Allocation</InputLabel>
                      <Select 
                        value={workers[selectedWorkerIndex].model_ID} 
                        label="Model Allocation" 
                        onChange={(e) => handleWorkerChange('model_ID', e.target.value)}
                      >
                        {renderGroupedModelMenuItems(workers[selectedWorkerIndex].model_ID)}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Task Type</InputLabel>
                      <Select 
                        value={workers[selectedWorkerIndex].taskType} 
                        label="Task Type" 
                        onChange={(e) => handleWorkerChange('taskType', e.target.value)}
                      >
                        <MenuItem value="simple_lookup">Simple Lookup (Material Master, etc.)</MenuItem>
                        <MenuItem value="retrieval_response">Retrieval & Response (RAG lookup)</MenuItem>
                        <MenuItem value="analysis">Analysis (Discrepancy review)</MenuItem>
                        <MenuItem value="transformation">Transformation (BAPI posting preparation)</MenuItem>
                        <MenuItem value="multi_step_reasoning">Multi-Step Reasoning (Complex checking)</MenuItem>
                        <MenuItem value="erp_data_pipeline">ERP Data Pipeline (Batch reconciliation)</MenuItem>
                      </Select>
                    </FormControl>

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Bound Tools Count: <strong>{toInteger(workers[selectedWorkerIndex].toolCount, 0)}</strong>
                      </Typography>
                      <Slider
                        value={toInteger(workers[selectedWorkerIndex].toolCount, 0)}
                        onChange={(_, val) => handleWorkerChange('toolCount', val)}
                        min={0}
                        max={20}
                        step={1}
                        valueLabelDisplay="auto"
                      />
                    </Box>

                    <Divider sx={{ my: 0.5 }}>
                      <Chip label="Advanced Token & Hops Overrides" size="small" sx={{ fontSize: '10px', fontWeight: 600 }} />
                    </Divider>

                    <FormControlLabel
                      control={
                        <Switch 
                          checked={workers[selectedWorkerIndex].useCustomToolHops || false} 
                          onChange={(e) => handleWorkerChange('useCustomToolHops', e.target.checked)} 
                          size="small"
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: '13px' }}>Override Derived Hops</Typography>}
                    />

                    {workers[selectedWorkerIndex].useCustomToolHops ? (
                      <TextField 
                        label="Manual Hops per Cycle" 
                        type="number"
                        value={workers[selectedWorkerIndex].avgToolHops || getDerivedHops(workers[selectedWorkerIndex])} 
                        onChange={(e) => handleWorkerChange('avgToolHops', parseFloat(e.target.value) || 1)}
                        fullWidth size="small"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1, mb: 0.5 }}>
                        Auto-derived hops: <strong>{getDerivedHops(workers[selectedWorkerIndex])}</strong> hops.
                      </Typography>
                    )}

                    <TextField 
                      label="Base Prompt Tokens" 
                      type="number"
                      value={workers[selectedWorkerIndex].basePromptTokens !== undefined && workers[selectedWorkerIndex].basePromptTokens !== null ? workers[selectedWorkerIndex].basePromptTokens : 400} 
                      onChange={(e) => handleWorkerChange('basePromptTokens', parseInt(e.target.value) || 0)}
                      fullWidth size="small"
                      helperText="Default: 400 tokens"
                    />

                    <TextField 
                      label="Output Tokens per Hop" 
                      type="number"
                      value={workers[selectedWorkerIndex].avgOutputTokensPerHop !== undefined && workers[selectedWorkerIndex].avgOutputTokensPerHop !== null ? workers[selectedWorkerIndex].avgOutputTokensPerHop : 300} 
                      onChange={(e) => handleWorkerChange('avgOutputTokensPerHop', parseInt(e.target.value) || 0)}
                      fullWidth size="small"
                      helperText="Default: 300 tokens"
                    />

                    <TextField 
                      label="Observation Density (Tokens)" 
                      type="number"
                      value={workers[selectedWorkerIndex].avgObservationTokens || 1000} 
                      onChange={(e) => handleWorkerChange('avgObservationTokens', parseInt(e.target.value) || 0)}
                      fullWidth size="small"
                      helperText="Low: ~200, Medium: ~1000 (OData response), High: ~3000 (nested tables)"
                    />
                    <Divider sx={{ my: 0.5 }} />

                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Stochastic Retry Rate: <strong>{Math.round(toNumber(workers[selectedWorkerIndex].retryProbability, 0.10) * 100)}%</strong>
                      </Typography>
                      <Slider
                        value={toNumber(workers[selectedWorkerIndex].retryProbability, 0.10)}
                        onChange={(_, val) => handleWorkerChange('retryProbability', val)}
                        min={0}
                        max={0.80}
                        step={0.05}
                        valueLabelDisplay="auto"
                      />
                    </Box>

                    <Divider />

                    <FormControlLabel
                      control={
                        <Switch 
                          checked={workers[selectedWorkerIndex].isReflectorNode || false} 
                          onChange={(e) => handleWorkerChange('isReflectorNode', e.target.checked)} 
                        />
                      }
                      label="Self-Correction / Critique Node"
                    />

                    {workers[selectedWorkerIndex].isReflectorNode && (
                      <TextField 
                        label="Refinement Cycles" 
                        type="number"
                        value={workers[selectedWorkerIndex].refinementIterations || 1} 
                        onChange={(e) => handleWorkerChange('refinementIterations', parseInt(e.target.value) || 1)}
                        fullWidth size="small"
                      />
                    )}

                    {executionMode === 'parallel_map_reduce' && (
                      <TextField 
                        label="Parallel Subgraph Instances (Send API)" 
                        type="number"
                        value={workers[selectedWorkerIndex].parallelInstances || 1} 
                        onChange={(e) => handleWorkerChange('parallelInstances', parseInt(e.target.value) || 1)}
                        fullWidth size="small"
                      />
                    )}

                    <Button 
                      variant="outlined" 
                      color="error" 
                      startIcon={<DeleteIcon />} 
                      sx={{ mt: 2 }}
                      onClick={() => handleDeleteWorker(selectedWorkerIndex)}
                    >
                      Remove Worker
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Center - Canvas Design Area */}
              <Box sx={{ flexGrow: 1, height: '100%', minWidth: 0, position: 'relative' }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  fitView
                  onNodeClick={(e, node) => {
                    if (node.id !== 'supervisor' && node.id !== 'synthesizer') {
                      const idx = workers.findIndex(w => w.ID === node.id);
                      if (idx !== -1) {
                        setSelectedWorkerIndex(idx);
                        setDrawerOpen(true);
                      }
                    }
                  }}
                >
                  <Controls />
                  {showMiniMap && <MiniMap />}
                  <Background variant="dots" gap={12} size={1} />
                  <Panel position="top-right">
                    <Card sx={{ p: 1, px: 1.5, boxShadow: 2, bgcolor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={showTokenOverlay}
                            onChange={(e) => setShowTokenOverlay(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={<Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>Live Token Telemetry</Typography>}
                        sx={{ m: 0 }}
                      />
                      <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={showMiniMap}
                            onChange={(e) => setShowMiniMap(e.target.checked)}
                            color="primary"
                          />
                        }
                        label={<Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary' }}>Mini-Map</Typography>}
                        sx={{ m: 0 }}
                      />
                    </Card>
                  </Panel>
                </ReactFlow>
              </Box>

              {/* Right Panel - Global Specifications */}
              {isSpecsExpanded && (
                <Box sx={{
                  width: 360,
                  borderLeft: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  overflowY: 'auto'
                }}>
                  {/* Title bar */}
                  <Box sx={{ p: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: '"Outfit", sans-serif', color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TuneIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                      Global Specifications
                    </Typography>
                    <IconButton size="small" onClick={() => setIsSpecsExpanded(false)}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  {/* Content */}
                  <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField 
                      label="Workflow Name" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      fullWidth size="small" 
                    />
                    <TextField 
                      label="BTP Project / Domain" 
                      value={project} 
                      onChange={(e) => setProject(e.target.value)} 
                      fullWidth size="small" 
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel>Execution & Orchestration Pattern</InputLabel>
                      <Select 
                        value={executionMode} 
                        label="Execution & Orchestration Pattern" 
                        onChange={(e) => setExecutionMode(e.target.value)}
                      >
                        <MenuItem value="sequential">Sequential Supervision (Hub-and-Spoke)</MenuItem>
                        <MenuItem value="parallel_map_reduce">Parallel Map-Reduce (Fan-Out / Fan-In)</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>State Passing mode</InputLabel>
                      <Select 
                        value={stateMode} 
                        label="State Passing mode" 
                        onChange={(e) => setStateMode(e.target.value)}
                      >
                        <MenuItem value="scoped_subgraph">Scoped Subgraph State (Recommended - Save 80%)</MenuItem>
                        <MenuItem value="global_shared">Shared Global MessagesState (Warning - Context Bloat)</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Complexity Profile</InputLabel>
                      <Select 
                        value={complexityProfile} 
                        label="Complexity Profile" 
                        onChange={(e) => setComplexityProfile(e.target.value)}
                      >
                        <MenuItem value="simple">Simple (1-2 workers, 1 pass)</MenuItem>
                        <MenuItem value="standard">Standard (2-4 workers, median loop)</MenuItem>
                        <MenuItem value="complex">Complex (multi-step review & refine)</MenuItem>
                        <MenuItem value="research_heavy">Research Heavy (deep reasoning loops)</MenuItem>
                      </Select>
                    </FormControl>

                    {useCustomRoutingCycles ? (
                      <TextField
                        type="number"
                        label="Expected Routing Cycles (Override)"
                        value={expectedRoutingCycles}
                        onChange={(e) => setExpectedRoutingCycles(e.target.value)}
                        fullWidth size="small"
                        InputProps={{
                          endAdornment: <IconButton size="small" onClick={() => setUseCustomRoutingCycles(false)}><TuneIcon /></IconButton>
                        }}
                      />
                    ) : (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Auto-derived cycles: <strong>{expectedRoutingCycles}</strong> turns.
                        </Typography>
                        <Button variant="text" size="small" onClick={() => setUseCustomRoutingCycles(true)} sx={{ p: 0, minWidth: 0, textTransform: 'none' }}>
                          ⚙️ Override routing cycles
                        </Button>
                      </Box>
                    )}

                    <FormControl fullWidth size="small">
                      <InputLabel>Supervisor / Router Model</InputLabel>
                      <Select 
                        value={supervisorModelId} 
                        label="Supervisor / Router Model" 
                        onChange={(e) => setSupervisorModelId(e.target.value)}
                        disabled={loadingModels}
                      >
                        {renderGroupedModelMenuItems(supervisorModelId)}
                      </Select>
                    </FormControl>

                    {executionMode === 'parallel_map_reduce' && (
                      <FormControl fullWidth size="small">
                        <InputLabel>Synthesizer / Reducer Model</InputLabel>
                        <Select 
                          value={synthesizerModelId} 
                          label="Synthesizer / Reducer Model" 
                          onChange={(e) => setSynthesizerModelId(e.target.value)}
                          disabled={loadingModels}
                        >
                          {renderGroupedModelMenuItems(synthesizerModelId)}
                        </Select>
                      </FormControl>
                    )}

                    <Divider sx={{ my: 0.5 }}>
                      <Chip label="Prompt & Tool Overhead" size="small" sx={{ fontSize: '10px', fontWeight: 600 }} />
                    </Divider>
                    <TextField 
                      label="Supervisor System Prompt (Tokens)" 
                      type="number" 
                      value={supervisorSystemPromptTokens} 
                      onChange={(e) => setSupervisorSystemPromptTokens(parseInt(e.target.value) || 0)} 
                      fullWidth size="small" 
                    />
                    <TextField 
                      label="Worker Registry Size (Tokens)" 
                      type="number" 
                      value={workerRegistryTokens} 
                      onChange={(e) => setWorkerRegistryTokens(parseInt(e.target.value) || 0)} 
                      fullWidth size="small" 
                    />
                    <TextField 
                      label="Avg Tool Schema Size (Tokens/Tool)" 
                      type="number" 
                      value={avgToolSchemaTokens} 
                      onChange={(e) => setAvgToolSchemaTokens(parseInt(e.target.value) || 0)} 
                      fullWidth size="small" 
                    />
                    <Divider sx={{ my: 1 }} />

                    <TextField 
                      label="Monthly Outcome Volume" 
                      type="number" 
                      value={monthlyRunVolume} 
                      onChange={(e) => setMonthlyRunVolume(e.target.value)} 
                      fullWidth size="small" 
                    />

                    <Grid container spacing={1.5}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="CU / Token Multiplier"
                          type="number"
                          value={capacityUnitsPerToken}
                          onChange={(e) => setCapacityUnitsPerToken(e.target.value)}
                          fullWidth
                          size="small"
                          inputProps={{ step: '0.00001' }}
                          helperText="Copied from global default"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="CU Cost (EUR)"
                          type="number"
                          value={capacityUnitCostEur}
                          onChange={(e) => setCapacityUnitCostEur(e.target.value)}
                          fullWidth
                          size="small"
                          inputProps={{ step: '0.01' }}
                          helperText="€ per Capacity Unit"
                        />
                      </Grid>
                    </Grid>

                    <FormControlLabel
                      control={<Switch checked={promptCachingEnabled} onChange={(e) => setPromptCachingEnabled(e.target.checked)} />}
                      label="Enable Prompt Caching"
                    />

                    {promptCachingEnabled && (
                      <Box sx={{ px: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Estimated Cache Hit Rate: {Math.round(toNumber(estimatedCacheHitRate, 0.50) * 100)}%
                        </Typography>
                        <Slider
                          value={toNumber(estimatedCacheHitRate, 0.50)}
                          onChange={(_, val) => setEstimatedCacheHitRate(val)}
                          min={0}
                          max={0.95}
                          step={0.05}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    )}

                    <FormControl fullWidth size="small">
                      <InputLabel>HITL Pause Duration</InputLabel>
                      <Select 
                        value={hitlPauseDuration} 
                        label="HITL Pause Duration" 
                        onChange={(e) => setHitlPauseDuration(e.target.value)}
                      >
                        <MenuItem value="none">No approvals / human checks</MenuItem>
                        <MenuItem value="short_under_5m">Short Pause (under 5 min - keep cache)</MenuItem>
                        <MenuItem value="long_over_5m">Long Pause (over 5 min - cache expires)</MenuItem>
                      </Select>
                    </FormControl>

                  </Box>
                </Box>
              )}

            </Box>
          </Card>
        </Box>
      )}

      {/* Telemetry Ingestion Modal */}
      <TelemetryImportModal
        open={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
        models={models}
        onApplyTemplate={(draft) => handleApplyTemplate(draft)}
        onTemplateSaved={async (savedTpl) => {
          await fetchCustomTemplates();
          setIsTemplateSelected(false);
          setSuccessMsg(`Template "${savedTpl?.name || 'Custom Template'}" saved successfully and added to your template library.`);
        }}
      />

      {/* Delete Template Confirmation Dialog */}
      <Dialog
        open={Boolean(templateToDelete)}
        onClose={() => !isDeletingTemplate && setTemplateToDelete(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon color="error" />
          Delete Saved Template
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.primary', mb: 2 }}>
            Are you sure you want to delete the template <strong>"{templateToDelete?.name}"</strong>?
          </DialogContentText>
          {templateToDelete && (
            <Box sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                <strong>Customer / Project:</strong> {templateToDelete.project || 'Default Project'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                <strong>Worker Agents:</strong> {templateToDelete.workers?.length || 0} agent(s)
              </Typography>
              {templateToDelete.createdBy && (
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  <strong>Created By:</strong> {templateToDelete.createdBy}
                </Typography>
              )}
            </Box>
          )}
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 2, fontWeight: 500 }}>
            This action cannot be undone. The template and its agent topology will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setTemplateToDelete(null)}
            disabled={isDeletingTemplate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={isDeletingTemplate ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            onClick={handleDeleteTemplate}
            disabled={isDeletingTemplate}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {isDeletingTemplate ? 'Deleting...' : 'Delete Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
