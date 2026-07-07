import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Alert, Chip, Divider, Checkbox
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

export default function HistoryComparison({ onLoadWorkflow }) {
  const [estimations, setEstimations] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // A/B Comparison Selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const [compareResult, setCompareResult] = useState(null);

  // Fetch Estimations & Workflow metadata
  const fetchData = async () => {
    setLoading(true);
    try {
      const [estRes, wfRes] = await Promise.all([
        fetch('/api/v1/estimation/Estimations?$expand=scenarios'),
        fetch('/api/v1/estimation/WorkflowConfigs')
      ]);

      const estData = await estRes.json();
      const wfData = await wfRes.json();

      setEstimations(estData.value || []);
      setWorkflows(wfData.value || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load historical estimations from SAP HANA Cloud.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map workflow config details to estimation records
  const mappedEstimations = estimations.map(est => {
    const wf = workflows.find(w => w.ID === est.workflow_ID);
    const medianRes = est.scenarios?.find(s => s.scenarioName === 'median') || est.scenarios?.[0];
    
    return {
      ID: est.ID,
      workflowId: est.workflow_ID,
      name: wf ? wf.name : 'Unknown Workflow',
      project: wf ? wf.project : 'Default',
      stateMode: wf ? wf.stateMode : 'scoped_subgraph',
      volume: wf ? wf.monthlyRunVolume : 10000,
      createdAt: est.createdAt,
      medianTco: medianRes ? parseFloat(medianRes.monthlyTcoUsd) : 0,
      medianCpo: medianRes ? parseFloat(medianRes.costPerRunUsd) : 0,
      medianBtp: medianRes ? parseFloat(medianRes.monthlyTcoBtpCredits) : 0,
      rawObj: est,
      workflowObj: wf
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Handle estimation deletion
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/v1/estimation/Estimations(${id})`, {
        method: 'DELETE'
      });
      if (res.status >= 400) throw new Error("Failed to delete estimation");
      
      // Update list
      setEstimations(prev => prev.filter(e => e.ID !== id));
      setSelectedIds(prev => prev.filter(x => x !== id));
      if (compareResult && (compareResult.est1.ID === id || compareResult.est2.ID === id)) {
        setCompareResult(null);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Perform A/B Comparison locally
  const handleSelectCompare = (id) => {
    const active = [...selectedIds];
    const index = active.indexOf(id);
    if (index === -1) {
      if (active.length >= 2) {
        active.shift(); // Keep max 2
      }
      active.push(id);
    } else {
      active.splice(index, 1);
    }
    setSelectedIds(active);
  };

  const handleRunComparison = () => {
    if (selectedIds.length !== 2) return;
    const est1 = mappedEstimations.find(e => e.ID === selectedIds[0]);
    const est2 = mappedEstimations.find(e => e.ID === selectedIds[1]);
    
    if (!est1 || !est2) return;

    // Calculate deltas (est2 vs est1)
    const costDeltaVal = est2.medianTco - est1.medianTco;
    const costDeltaPct = est1.medianTco > 0 ? (costDeltaVal / est1.medianTco) * 100 : 0;
    
    const cpoDeltaVal = est2.medianCpo - est1.medianCpo;
    const cpoDeltaPct = est1.medianCpo > 0 ? (cpoDeltaVal / est1.medianCpo) * 100 : 0;

    const btpDeltaVal = est2.medianBtp - est1.medianBtp;
    const btpDeltaPct = est1.medianBtp > 0 ? (btpDeltaVal / est1.medianBtp) * 100 : 0;

    setCompareResult({
      est1,
      est2,
      costDeltaVal,
      costDeltaPct: costDeltaPct.toFixed(1),
      cpoDeltaVal,
      cpoDeltaPct: cpoDeltaPct.toFixed(1),
      btpDeltaVal,
      btpDeltaPct: btpDeltaPct.toFixed(1)
    });
  };

  // Format date
  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f8fafc' }}>
      {errorMsg && (
        <Alert severity="error" onClose={() => setErrorMsg(null)}>
          {errorMsg}
        </Alert>
      )}

      {/* A/B Comparison Result Dialog/Section */}
      {compareResult && (
        <Card sx={{ borderLeft: 6, borderColor: 'primary.main', bgcolor: 'primary.light' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                A/B Topology Comparison Analysis
              </Typography>
              <Button size="small" variant="text" onClick={() => setCompareResult(null)}>Close Diff</Button>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Baseline (A): {compareResult.est1.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ran: {formatDate(compareResult.est1.createdAt)} | Volume: {compareResult.est1.volume.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">Monthly TCO: <strong>€{compareResult.est1.medianTco.toFixed(2)}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">CPO: €{compareResult.est1.medianCpo.toFixed(3)}</Typography>
                  <Typography variant="body2" color="text.secondary">CU-based EUR cost: {compareResult.est1.medianBtp.toFixed(1)}</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={2} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <CompareArrowsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                <Chip 
                  label={`${compareResult.costDeltaPct > 0 ? '+' : ''}${compareResult.costDeltaPct}%`} 
                  color={parseFloat(compareResult.costDeltaPct) > 0 ? 'error' : 'success'} 
                  sx={{ fontWeight: 800, mt: 1 }}
                />
              </Grid>

              <Grid item xs={12} sm={5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Variant (B): {compareResult.est2.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ran: {formatDate(compareResult.est2.createdAt)} | Volume: {compareResult.est2.volume.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">Monthly TCO: <strong>€{compareResult.est2.medianTco.toFixed(2)}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">CPO: €{compareResult.est2.medianCpo.toFixed(3)}</Typography>
                  <Typography variant="body2" color="text.secondary">CU-based EUR cost: {compareResult.est2.medianBtp.toFixed(1)}</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Saved Estimations List */}
      <Card>
        <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Available estimations
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<CompareArrowsIcon />}
            disabled={selectedIds.length !== 2}
            onClick={handleRunComparison}
          >
            Compare Selected (A/B)
          </Button>
        </Box>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Diff</Typography>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Workflow Configurations</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>BTP Project / Domain</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>State mode</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Monthly TCO</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Cost per Outcome</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Saved Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : mappedEstimations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    No estimations saved. Configure and run an estimate in the Builder to persist results.
                  </TableCell>
                </TableRow>
              ) : (
                mappedEstimations.map(row => (
                  <TableRow key={row.ID} hover>
                    <TableCell padding="checkbox">
                      <Checkbox 
                        checked={selectedIds.includes(row.ID)}
                        onChange={() => handleSelectCompare(row.ID)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
                    <TableCell>{row.project}</TableCell>
                    <TableCell>
                      <Chip 
                        label={row.stateMode === 'scoped_subgraph' ? 'Scoped Subgraph' : 'Shared Global'} 
                        size="small"
                        color={row.stateMode === 'scoped_subgraph' ? 'success' : 'error'}
                        variant="outlined"
                        sx={{ fontSize: '10px', height: 20 }}
                      />
                    </TableCell>
                    <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 600 }}>
                      ${row.medianTco.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="right" className="tabular-nums">
                      ${row.medianCpo.toFixed(3)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Button 
                          size="small" 
                          variant="outlined"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => {
                            // Extract JSON summary from Saved Estimation
                            let loadedSummary = null;
                            try {
                              const rawEst = row.rawObj;
                              // Build a mock summary payload to reload the results page directly
                              const medianSc = rawEst.scenarios?.find(s => s.scenarioName === 'median') || rawEst.scenarios?.[0];
                              loadedSummary = {
                                estimationId: rawEst.ID,
                                workflowName: row.name,
                                monthlyRunVolume: row.volume,
                                executiveRoi: {
                                  manualBaselineCostUsd: (row.volume * 12.50).toFixed(2),
                                  agentMonthlyTcoUsd: row.medianTco.toFixed(2),
                                  monthlyNetSavingsUsd: (row.volume * 12.50 - row.medianTco).toFixed(2),
                                  roiPercentage: `${((row.volume * 12.50 - row.medianTco)/row.medianTco * 100).toFixed(1)}%`,
                                  paybackPeriodDays: (row.medianTco / ((row.volume * 12.50 - row.medianTco)/30 || 1)).toFixed(1)
                                },
                                scenarios: rawEst.scenarios.map(s => ({
                                  name: s.scenarioName,
                                  costPerRunUsd: s.costPerRunUsd,
                                  monthlyTcoUsd: s.monthlyTcoUsd,
                                  costPerRunBtpCredits: s.costPerRunBtpCredits,
                                  monthlyTcoBtpCredits: s.monthlyTcoBtpCredits,
                                  totalCapacityUnits: s.totalCapacityUnits,
                                  totalTokens: s.totalInputTokens + s.totalOutputTokens
                                }))
                              };
                            } catch (e) {
                              console.error(e);
                            }
                            onLoadWorkflow(row.workflowId, loadedSummary);
                          }}
                          sx={{ textTransform: 'none', py: 0.25 }}
                        >
                          Load
                        </Button>
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDelete(row.ID)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
