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
  ListSubheader, Tooltip
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

import ExecutiveDashboard from './ExecutiveDashboard';
import { getProviderLabel, groupByProvider, sortByProviderAndModel } from '../utils/modelGrouping';

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
      title={data.showTokenOverlay && data.telemetry ? `Formula: ${data.telemetry.formula}` : undefined}
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
          <Box className="token-telemetry-box" title={`Formula: ${data.telemetry.formula}`}>
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

  // Error notifications
  const [errorMsg, setErrorMsg] = useState(null);

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
            setExecutionMode(data.orchestrationPattern || 'sequential');
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
    setName(preset.name);
    setProject(preset.project);
    setExecutionMode(preset.executionMode);
    setStateMode(preset.stateMode);
    setComplexityProfile(preset.complexityProfile);
    setExpectedRoutingCycles(preset.expectedRoutingCycles);
    setUseCustomRoutingCycles(preset.useCustomRoutingCycles);
    setPromptCachingEnabled(preset.promptCachingEnabled);
    setEstimatedCacheHitRate(preset.estimatedCacheHitRate);
    setMonthlyRunVolume(preset.monthlyRunVolume);
    setTags(preset.tags);

    // Map worker models based on fetched model list
    if (models.length > 0) {
      const gpt4o = models.find(m => m.modelName === 'gpt-4o');
      const mini = models.find(m => m.modelName === 'gpt-4o-mini');
      const sonnet = models.find(m => m.modelName.includes('claude-3-5-sonnet'));

      // Set supervisor model matching template specs
      if (preset.name.includes('Intercompany')) {
        setSupervisorModelId(sonnet ? sonnet.ID : models[0].ID);
      } else {
        setSupervisorModelId(gpt4o ? gpt4o.ID : models[0].ID);
      }

      setSynthesizerModelId(mini ? mini.ID : models[0].ID);

      const mappedWorkers = preset.workers.map((w, idx) => {
        let selectedModelId = mini ? mini.ID : models[0].ID;
        if (w.name.includes('Validator') || w.name.includes('Specialist') || w.name.includes('Matching')) {
          selectedModelId = sonnet ? sonnet.ID : (gpt4o ? gpt4o.ID : models[0].ID);
        }
        return {
          ID: `w-${idx}`,
          name: w.name,
          model_ID: selectedModelId,
          toolCount: w.toolCount,
          taskType: w.taskType,
          avgObservationTokens: w.avgObservationTokens || 1000,
          basePromptTokens: w.basePromptTokens || 400,
          avgOutputTokensPerHop: w.avgOutputTokensPerHop || 300,
          useCustomToolHops: w.useCustomToolHops || false,
          avgToolHops: w.avgToolHops || 2,
          retryProbability: w.retryProbability || 0.10,
          executionMode: w.executionMode || 'sequential',
          parallelInstances: w.parallelInstances || 1,
          isReflectorNode: w.isReflectorNode || false,
          refinementIterations: w.refinementIterations || 1
        };
      });
      setWorkers(mappedWorkers);
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

    if (nodeType === 'supervisor') {
      const sysTok = Number(supervisorSystemPromptTokens) || 500;
      const regTok = Number(workerRegistryTokens) || 200;
      inputTokens = sysTok + regTok + 500;
      outputTokens = 150;
      formula = `System Prompt (${sysTok}) + Worker Registry (${regTok}) + Est. History (500)`;
    } else if (nodeType === 'synthesizer') {
      inputTokens = 1500;
      outputTokens = 500;
      thinkingTokens = Math.round(outputTokens * thinkingMult);
      formula = 'Aggregated Worker Outputs (1500) → Final Synthesis (500)';
    } else if (nodeType === 'worker' && workerConfig) {
      const hops = getDerivedHops(workerConfig);
      const toolCount = workerConfig.toolCount || 0;
      const obsTokens = workerConfig.avgObservationTokens || 1000;
      const basePrompt = workerConfig.basePromptTokens !== undefined && workerConfig.basePromptTokens !== null ? Number(workerConfig.basePromptTokens) : 400;
      const hopOutTok = workerConfig.avgOutputTokensPerHop !== undefined && workerConfig.avgOutputTokensPerHop !== null ? Number(workerConfig.avgOutputTokensPerHop) : 300;
      const schemaTok = Number(avgToolSchemaTokens) || 250;
      
      let totalInput = 0;
      let hist = 0;
      for (let h = 1; h <= hops; h++) {
        totalInput += basePrompt + (toolCount * schemaTok) + hist + ((h - 1) * obsTokens);
        hist += Math.round((hopOutTok + obsTokens) * 0.7);
      }
      inputTokens = Math.round(totalInput);
      outputTokens = Math.round(hopOutTok * hops);
      thinkingTokens = Math.round(outputTokens * thinkingMult);
      formula = `Base (${basePrompt}) + ${toolCount} Tools × ${schemaTok} + Obs (${obsTokens}) across ${hops} hops`;
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
    recalculateLayout(false);
  }, [workers, executionMode, stateMode, supervisorModelId, synthesizerModelId, name, models, showTokenOverlay, modelPricing, supervisorSystemPromptTokens, workerRegistryTokens, avgToolSchemaTokens, recalculateLayout]);


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
        orchestrationPattern: 'subagents_router',
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
        supervisorSystemPromptTokens: parseInt(supervisorSystemPromptTokens) || 500,
        workerRegistryTokens: parseInt(workerRegistryTokens) || 200,
        avgToolSchemaTokens: parseInt(avgToolSchemaTokens) || 250,
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
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ 
              fontWeight: 800, 
              fontFamily: '"Outfit", sans-serif', 
              color: 'secondary.main',
              mb: 1.5,
              background: 'linear-gradient(135deg, #0f172a 0%, #4f46e5 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Choose a Workflow Template to Start
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', fontWeight: 500 }}>
              Select from our pre-configured enterprise SAP templates optimized for agentic orchestration, or start with a custom blank canvas.
            </Typography>
          </Box>

          {/* Template Grid */}
          <Grid container spacing={3}>
            {TEMPLATE_PRESETS.map((t, idx) => {
              const isCustom = t.name === 'Custom Workflow';
              return (
                <Grid item xs={12} sm={6} md={4} key={idx}>
                  <Card 
                    onClick={() => handleApplyTemplate(t)}
                    sx={{ 
                      cursor: 'pointer', 
                      height: '100%',
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
                    <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'secondary.main', lineHeight: 1.2 }}>
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
                              borderColor: 'divider' 
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
                              color: 'primary.main' 
                            }} 
                          />
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, fontSize: '13px', lineHeight: 1.5 }}>
                        {t.description}
                      </Typography>

                      {/* Metadata summary */}
                      <Box sx={{ 
                        bgcolor: '#f8fafc', 
                        p: 2, 
                        borderRadius: 2, 
                        border: '1px dashed #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">Orchestration:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            {t.executionMode === 'sequential' ? 'Sequential Hub' : 'Parallel Map-Reduce'}
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
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 'auto' }}>
                        {t.tags.split(' ').map((tag, tIdx) => (
                          <Chip key={tIdx} label={tag} size="small" sx={{ fontSize: '9px', height: 16 }} />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      ) : (
        /* Main Builder Full-Width Canvas */
        <Box sx={{ flexGrow: 1, position: 'relative', height: '700px', display: 'flex', flexDirection: 'column' }}>
          <Card sx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* Canvas Top Bar */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', zIndex: 5 }}>
              {/* Left: Title */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LayersIcon sx={{ color: 'primary.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  Interactive Orchestration Topology Map
                </Typography>
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
                    setIsTemplateSelected(false);
                  }}
                  sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 600, fontSize: 12 }}
                >
                  Reset
                </Button>
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
                  <MiniMap />
                  <Background variant="dots" gap={12} size={1} />
                  <Panel position="top-right">
                    <Card sx={{ p: 1, px: 1.5, boxShadow: 2, bgcolor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(8px)', borderRadius: 2 }}>
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
    </Box>
  );
}
