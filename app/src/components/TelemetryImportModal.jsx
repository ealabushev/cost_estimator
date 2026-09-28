import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  Button, TextField, Stepper, Step, StepLabel, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Alert, IconButton, Select, MenuItem, FormControl,
  InputLabel, RadioGroup, FormControlLabel, Radio, CircularProgress,
  Tooltip, Divider
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LayersIcon from '@mui/icons-material/Layers';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';

import {
  normalizeTracePayload,
  parseSpansToWorkflow,
  SAMPLE_ERP_OTEL_TRACE
} from '../utils/telemetryParser';

const STEPS = ['Upload Telemetry', 'Trace Analysis & Topology', 'Baseline & Save'];

export default function TelemetryImportModal({
  open,
  onClose,
  models = [],
  onApplyTemplate,
  onTemplateSaved
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [rawText, setRawText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Analysis result state
  const [parsedResult, setParsedResult] = useState(null);
  const [baselineType, setBaselineType] = useState('median_p50');
  const [templateName, setTemplateName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [templateTags, setTemplateTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset modal state
  const handleReset = () => {
    setActiveStep(0);
    setRawText('');
    setParsedResult(null);
    setBaselineType('median_p50');
    setErrorMsg(null);
    setIsSaving(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Process raw text / file
  const handleParse = (content, baseline = baselineType) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const spans = normalizeTracePayload(content);
      const result = parseSpansToWorkflow(spans, { baselineType: baseline });

      // Match models against available models in system
      const draft = result.workflowConfigDraft;
      if (models.length > 0) {
        const findModelId = (name) => {
          if (!name) return models[0]?.ID;
          const clean = name.toLowerCase().replace(/[@:_].*$/, '').replace(/-\d{8}$/, '');
          const exact = models.find(m => m.modelName.toLowerCase() === name.toLowerCase());
          if (exact) return exact.ID;
          const partial = models.find(m => m.modelName.toLowerCase().includes(clean) || clean.includes(m.modelName.toLowerCase()));
          if (partial) return partial.ID;
          return models[0]?.ID;
        };

        draft.supervisorModel_ID = findModelId(draft.supervisorModelName);
        if (draft.synthesizerModelName) {
          draft.synthesizerModel_ID = findModelId(draft.synthesizerModelName);
        }
        for (const w of draft.workers) {
          w.model_ID = findModelId(w.modelName);
        }
      }

      setParsedResult(result);
      setTemplateName(draft.name || 'Calibrated Workflow');
      setProjectName(draft.project || 'Telemetry Ingested');
      setTemplateTags(draft.tags || 'otel-imported');
      setActiveStep(1);
      setLoading(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to parse telemetry file');
      setLoading(false);
    }
  };

  // Load sample dataset
  const handleLoadSample = () => {
    const jsonStr = JSON.stringify(SAMPLE_ERP_OTEL_TRACE, null, 2);
    setRawText(jsonStr);
    handleParse(jsonStr);
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      setRawText(content);
      handleParse(content);
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file from disk');
    };
    reader.readAsText(file);
  };

  // Toggle baseline between P50 and P90
  const handleBaselineChange = (newBaseline) => {
    setBaselineType(newBaseline);
    if (rawText) {
      handleParse(rawText, newBaseline);
    }
  };

  // Override worker model in draft
  const handleWorkerModelChange = (index, modelId) => {
    if (!parsedResult) return;
    const updated = { ...parsedResult };
    updated.workflowConfigDraft.workers[index].model_ID = modelId;
    const mObj = models.find(m => m.ID === modelId);
    if (mObj) {
      updated.workflowConfigDraft.workers[index].modelName = mObj.modelName;
    }
    setParsedResult(updated);
  };

  // Save template to backend
  const handleSaveToLibrary = async () => {
    if (!parsedResult) return;
    setIsSaving(true);
    setErrorMsg(null);

    const draft = parsedResult.workflowConfigDraft;
    const payload = {
      name: templateName || draft.name,
      project: projectName || draft.project,
      description: `Calibrated from ${parsedResult.summary.runsAnalyzed} OpenTelemetry agent run(s) [${baselineType}]`,
      telemetryData: rawText,
      baselineType
    };

    try {
      const res = await fetch('/api/v1/estimation/createTemplateFromTelemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || 'Failed to save template to SAP HANA');
      }

      const resData = await res.json();
      setIsSaving(false);

      if (onTemplateSaved) {
        onTemplateSaved({
          ...draft,
          ID: resData.templateId,
          name: payload.name,
          project: payload.project,
          isTemplate: true
        });
      }

      handleClose();
    } catch (err) {
      setErrorMsg(err.message);
      setIsSaving(false);
    }
  };

  // Apply directly to canvas
  const handleApplyToCanvas = () => {
    if (!parsedResult) return;
    const draft = {
      ...parsedResult.workflowConfigDraft,
      name: templateName || parsedResult.workflowConfigDraft.name,
      project: projectName || parsedResult.workflowConfigDraft.project,
      tags: templateTags || parsedResult.workflowConfigDraft.tags
    };

    onApplyTemplate(draft);
    handleClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle sx={{ 
        m: 0, 
        p: 2.5, 
        bgcolor: 'background.paper', 
        borderBottom: '1px solid', 
        borderColor: 'divider',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            p: 1, 
            borderRadius: 2, 
            bgcolor: 'primary.light', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, fontFamily: '"Outfit", sans-serif' }}>
              Create Template from OpenTelemetry Logs
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Reconstruct agent topologies and derive empirical parameters from real production traces
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: '#fafafa' }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ '& .MuiStepLabel-label': { fontWeight: 600, fontSize: 13 } }}>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setErrorMsg(null)}>
            {errorMsg}
          </Alert>
        )}

        {/* STEP 0: Upload & Input */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Card
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: dragActive ? 'primary.main' : '#cbd5e1',
                bgcolor: dragActive ? 'primary.light' : '#ffffff',
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: 'primary.main', bgcolor: '#f8fafc' }
              }}
              onClick={() => document.getElementById('otel-file-input')?.click()}
            >
              <input
                id="otel-file-input"
                type="file"
                accept=".json,.jsonl,.txt"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Drop OpenTelemetry Trace File Here
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Supports OTLP JSON (ExportTraceServiceRequest), OpenInference, Traceloop, or JSONL trace logs
              </Typography>
              <Button variant="outlined" size="small" sx={{ fontWeight: 600 }}>
                Browse Computer
              </Button>
            </Card>

            <Divider sx={{ my: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, px: 1 }}>
                OR PASTE RAW TELEMETRY / LOAD PRESET
              </Typography>
            </Divider>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Raw JSON / OTLP Text:
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={handleLoadSample}
                startIcon={<SpeedIcon />}
                sx={{ textTransform: 'none', fontWeight: 600, borderColor: 'primary.main', color: 'primary.main' }}
              >
                Load Sample ERP Agent OTel Trace
              </Button>
            </Box>

            <TextField
              multiline
              rows={5}
              fullWidth
              placeholder="Paste OTLP JSON or OpenInference spans here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              sx={{
                bgcolor: '#ffffff',
                fontFamily: 'monospace',
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '12px' }
              }}
            />
          </Box>
        )}

        {/* STEP 1: Analysis & Topology Preview */}
        {activeStep === 1 && parsedResult && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Run Summary Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
              <Card sx={{ p: 1.5, textAlign: 'center', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  RUNS ANALYZED
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main', mt: 0.5 }}>
                  {parsedResult.summary.runsAnalyzed}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {parsedResult.summary.totalSpans} total spans
                </Typography>
              </Card>

              <Card sx={{ p: 1.5, textAlign: 'center', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  ROUTING CYCLES (M)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'secondary.main', mt: 0.5 }}>
                  {parsedResult.summary.routingCycles}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Handoffs / transitions
                </Typography>
              </Card>

              <Card sx={{ p: 1.5, textAlign: 'center', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  PATTERN DETECTED
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.8 }}>
                  {parsedResult.summary.executionMode === 'parallel_map_reduce' ? 'Parallel Map-Reduce' : 'Subagents Router'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {parsedResult.summary.complexityProfile}
                </Typography>
              </Card>

              <Card sx={{ p: 1.5, textAlign: 'center', bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  CACHE HIT RATE
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: parsedResult.summary.cacheHitRate > 0 ? '#10a37f' : 'text.secondary', mt: 0.5 }}>
                  {Math.round(parsedResult.summary.cacheHitRate * 100)}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Prompt reuse
                </Typography>
              </Card>
            </Box>

            {/* Supervisor Info Card */}
            <Card sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <LayersIcon sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Supervisor / Router Agent
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Detected Model from Root Span: <strong>{parsedResult.workflowConfigDraft.supervisorModelName}</strong>
                  </Typography>
                </Box>
              </Box>
              <Chip 
                label="Auto-Mapped" 
                size="small" 
                color="primary" 
                variant="outlined" 
                icon={<CheckCircleIcon />} 
                sx={{ fontWeight: 600 }}
              />
            </Card>

            {/* Discovered Workers Table */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
              Discovered Worker Subgraphs ({parsedResult.workflowConfigDraft.workers.length}):
            </Typography>

            <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Agent Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Model Inferred</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Task Type</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Tools Bound (T)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Avg Hops (L̄)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Obs. Tokens (P_tool)</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Retry Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedResult.workflowConfigDraft.workers.map((w, idx) => (
                    <TableRow key={idx} sx={{ '&:hover': { bgcolor: '#f1f5f9' } }}>
                      <TableCell sx={{ fontWeight: 600 }}>{w.name}</TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth sx={{ minWidth: 140 }}>
                          <Select
                            value={w.model_ID || models[0]?.ID || ''}
                            onChange={(e) => handleWorkerModelChange(idx, e.target.value)}
                            sx={{ fontSize: 13, height: 32 }}
                          >
                            {models.map((m) => (
                              <MenuItem key={m.ID} value={m.ID} sx={{ fontSize: 13 }}>
                                {m.modelName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Chip label={w.taskType} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title={w.toolsDiscovered?.join(', ') || 'No tools'}>
                          <Chip 
                            label={`${w.toolCount} tool${w.toolCount > 1 ? 's' : ''}`} 
                            size="small" 
                            color="info" 
                            variant="outlined" 
                            sx={{ fontWeight: 600, fontSize: 11, height: 22 }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{w.avgToolHops}</TableCell>
                      <TableCell>{w.avgObservationTokens.toLocaleString()} tok</TableCell>
                      <TableCell sx={{ color: w.retryProbability > 0.1 ? 'error.main' : 'text.primary' }}>
                        {Math.round(w.retryProbability * 100)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* STEP 2: Baseline & Customization */}
        {activeStep === 2 && parsedResult && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Select Calibration Baseline Profile:
            </Typography>

            <RadioGroup
              value={baselineType}
              onChange={(e) => handleBaselineChange(e.target.value)}
              sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}
            >
              <Card sx={{ 
                p: 2, 
                cursor: 'pointer',
                border: '2px solid',
                borderColor: baselineType === 'median_p50' ? 'primary.main' : '#e2e8f0',
                bgcolor: baselineType === 'median_p50' ? 'primary.light' : '#ffffff',
                transition: 'all 0.2s'
              }}>
                <FormControlLabel
                  value="median_p50"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Median Baseline (P50) — Recommended
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uses median routing cycles (M={parsedResult.workflowConfigDraft.telemetryMetadata?.routingCyclesStats?.p50 || parsedResult.summary.routingCycles}) and tool hops. Best for standard expected operational cost modeling.
                      </Typography>
                    </Box>
                  }
                />
              </Card>

              <Card sx={{ 
                p: 2, 
                cursor: 'pointer',
                border: '2px solid',
                borderColor: baselineType === 'conservative_p90' ? 'primary.main' : '#e2e8f0',
                bgcolor: baselineType === 'conservative_p90' ? 'primary.light' : '#ffffff',
                transition: 'all 0.2s'
              }}>
                <FormControlLabel
                  value="conservative_p90"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Conservative Baseline (P90)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Uses 90th percentile routing cycles and tool hops (M={parsedResult.workflowConfigDraft.telemetryMetadata?.routingCyclesStats?.p90 || parsedResult.summary.routingCycles}). Ideal for high-risk budget ceiling approval.
                      </Typography>
                    </Box>
                  }
                />
              </Card>
            </RadioGroup>

            <Divider sx={{ my: 1 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Template Metadata:
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Template Name"
                  fullWidth
                  size="small"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Project Identifier"
                  fullWidth
                  size="small"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Tags (space-separated)"
                  fullWidth
                  size="small"
                  value={templateTags}
                  onChange={(e) => setTemplateTags(e.target.value)}
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2.5, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', justifyContent: 'space-between' }}>
        {activeStep === 0 ? (
          <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 600 }}>
            Cancel
          </Button>
        ) : (
          <Button onClick={() => setActiveStep(prev => prev - 1)} color="inherit" sx={{ fontWeight: 600 }}>
            Back
          </Button>
        )}

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {activeStep === 0 && (
            <Button
              variant="contained"
              disabled={!rawText.trim() || loading}
              onClick={() => handleParse(rawText)}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
              sx={{ fontWeight: 700 }}
            >
              Analyze Telemetry
            </Button>
          )}

          {activeStep === 1 && (
            <Button
              variant="contained"
              onClick={() => setActiveStep(2)}
              sx={{ fontWeight: 700 }}
            >
              Next: Select Baseline & Save
            </Button>
          )}

          {activeStep === 2 && (
            <>
              <Button
                variant="outlined"
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={18} /> : <StorageIcon />}
                sx={{ fontWeight: 700, borderColor: 'primary.main' }}
              >
                Save as Custom Template
              </Button>
              <Button
                variant="contained"
                onClick={handleApplyToCanvas}
                startIcon={<AssessmentIcon />}
                sx={{ fontWeight: 700 }}
              >
                Apply to Canvas & Estimate
              </Button>
            </>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}
