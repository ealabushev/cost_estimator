import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Alert, Chip, Divider, Checkbox,
  TextField, InputAdornment, FormControl, InputLabel, Select, MenuItem,
  Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import ClearIcon from '@mui/icons-material/Clear';

const formatCu = (value) => `${(Number.parseFloat(value) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
})} CU`;

export default function HistoryComparison({ onLoadWorkflow }) {
  const [estimations, setEstimations] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Multi-user & Multi-customer Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');

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
  const mappedEstimations = useMemo(() => {
    return estimations.map(est => {
      const wf = workflows.find(w => w.ID === est.workflow_ID);
      const medianRes = est.scenarios?.find(s => s.scenarioName === 'median') || est.scenarios?.[0];
      
      return {
        ID: est.ID,
        workflowId: est.workflow_ID,
        name: wf ? wf.name : 'Unknown Workflow',
        version: wf ? (wf.version || 1) : 1,
        rootWorkflowId: wf ? (wf.rootWorkflowId || wf.ID) : null,
        project: (wf?.project || 'Default').trim(),
        stateMode: wf ? wf.stateMode : 'scoped_subgraph',
        volume: wf ? wf.monthlyRunVolume : 10000,
        createdAt: est.createdAt,
        createdBy: (est.createdBy || wf?.createdBy || 'anonymous').trim(),
        tags: wf?.tags || '',
        medianTco: medianRes ? parseFloat(medianRes.monthlyTcoUsd) : 0,
        medianCpo: medianRes ? parseFloat(medianRes.costPerRunUsd) : 0,
        medianBtp: medianRes ? parseFloat(medianRes.monthlyTcoBtpCredits) : 0,
        rawObj: est,
        workflowObj: wf
      };
    });
  }, [estimations, workflows]);

  // Extract distinct Customer/Project values
  const allProjects = useMemo(() => {
    const set = new Set();
    mappedEstimations.forEach(e => {
      if (e.project) set.add(e.project);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [mappedEstimations]);

  // Extract distinct Users/Creators
  const allUsers = useMemo(() => {
    const set = new Set();
    mappedEstimations.forEach(e => {
      if (e.createdBy) set.add(e.createdBy);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [mappedEstimations]);

  // Extract distinct tags
  const allTags = useMemo(() => {
    const set = new Set();
    mappedEstimations.forEach(e => {
      if (e.tags) {
        e.tags.split(' ').map(t => t.trim()).filter(Boolean).forEach(t => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [mappedEstimations]);

  // Filtered & Sorted Estimations
  const filteredEstimations = useMemo(() => {
    return mappedEstimations.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchProj = item.project.toLowerCase().includes(q);
        const matchTags = item.tags.toLowerCase().includes(q);
        const matchUser = item.createdBy.toLowerCase().includes(q);
        if (!matchName && !matchProj && !matchTags && !matchUser) return false;
      }
      if (selectedProject !== 'ALL' && item.project !== selectedProject) {
        return false;
      }
      if (selectedUser !== 'ALL' && item.createdBy !== selectedUser) {
        return false;
      }
      if (selectedTag !== 'ALL') {
        const tagsArr = item.tags.split(' ').map(t => t.trim());
        if (!tagsArr.includes(selectedTag)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'date_asc') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'tco_desc') return b.medianTco - a.medianTco;
      if (sortBy === 'tco_asc') return a.medianTco - b.medianTco;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [mappedEstimations, searchQuery, selectedProject, selectedUser, selectedTag, sortBy]);

  const hasActiveFilters = searchQuery.trim() !== '' || selectedProject !== 'ALL' || selectedUser !== 'ALL' || selectedTag !== 'ALL' || sortBy !== 'date_desc';

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProject('ALL');
    setSelectedUser('ALL');
    setSelectedTag('ALL');
    setSortBy('date_desc');
  };

  // Handle estimation and workflow version deletion (1:1 cascade)
  const handleDelete = async (id) => {
    try {
      const estToDelete = estimations.find(e => e.ID === id);
      const wfId = estToDelete?.workflow_ID;

      const res = await fetch(`/api/v1/estimation/Estimations(${id})`, {
        method: 'DELETE'
      });
      if (res.status >= 400) throw new Error("Failed to delete estimation");
      
      // Update list: remove both estimation and associated workflow configuration version
      setEstimations(prev => prev.filter(e => e.ID !== id));
      if (wfId) {
        setWorkflows(prev => prev.filter(w => w.ID !== wfId));
      }
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
                  Baseline (A): {compareResult.est1.name} (v{compareResult.est1.version})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ran: {formatDate(compareResult.est1.createdAt)} | Volume: {compareResult.est1.volume.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">Monthly TCO: <strong>€{compareResult.est1.medianTco.toFixed(2)}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">CPO: €{compareResult.est1.medianCpo.toFixed(3)}</Typography>
                  <Typography variant="body2" color="text.secondary">CU monthly cost: {formatCu(compareResult.est1.medianBtp)}</Typography>
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
                  Variant (B): {compareResult.est2.name} (v{compareResult.est2.version})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ran: {formatDate(compareResult.est2.createdAt)} | Volume: {compareResult.est2.volume.toLocaleString()}
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body1">Monthly TCO: <strong>€{compareResult.est2.medianTco.toFixed(2)}</strong></Typography>
                  <Typography variant="body2" color="text.secondary">CPO: €{compareResult.est2.medianCpo.toFixed(3)}</Typography>
                  <Typography variant="body2" color="text.secondary">CU monthly cost: {formatCu(compareResult.est2.medianBtp)}</Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Saved Estimations List */}
      <Card>
        <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Available estimations
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Showing {filteredEstimations.length} of {mappedEstimations.length} historical run{mappedEstimations.length === 1 ? '' : 's'} across clients & team members
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {hasActiveFilters && (
              <Button 
                size="small" 
                variant="text" 
                color="secondary"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Reset Filters
              </Button>
            )}
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
        </Box>

        {/* Multi-Customer & Multi-User Filter Toolbar */}
        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Grid container spacing={1.5} alignItems="center">
            {/* Search Input */}
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search workflow, customer, user, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: searchQuery && (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
                sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
              />
            </Grid>

            {/* Customer / Project Dropdown */}
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small" sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                <InputLabel id="project-filter-label">Customer / Project</InputLabel>
                <Select
                  labelId="project-filter-label"
                  value={selectedProject}
                  label="Customer / Project"
                  onChange={(e) => setSelectedProject(e.target.value)}
                >
                  <MenuItem value="ALL">All Customers & Projects ({allProjects.length})</MenuItem>
                  {allProjects.map(proj => (
                    <MenuItem key={proj} value={proj}>{proj}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* User / Created By Dropdown */}
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small" sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                <InputLabel id="user-filter-label">Created By</InputLabel>
                <Select
                  labelId="user-filter-label"
                  value={selectedUser}
                  label="Created By"
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <MenuItem value="ALL">All Users ({allUsers.length})</MenuItem>
                  {allUsers.map(usr => (
                    <MenuItem key={usr} value={usr}>{usr}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Sort Dropdown */}
            <Grid item xs={12} sm={6} md={2.5}>
              <FormControl fullWidth size="small" sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
                <InputLabel id="sort-filter-label">Sort By</InputLabel>
                <Select
                  labelId="sort-filter-label"
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="date_desc">Newest First</MenuItem>
                  <MenuItem value="date_asc">Oldest First</MenuItem>
                  <MenuItem value="tco_desc">Highest Monthly TCO</MenuItem>
                  <MenuItem value="tco_asc">Lowest Monthly TCO</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Quick Tag Filter Pills */}
          {allTags.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Filter by Tag:
              </Typography>
              <Chip
                label="All Tags"
                size="small"
                clickable
                color={selectedTag === 'ALL' ? 'primary' : 'default'}
                onClick={() => setSelectedTag('ALL')}
                sx={{ height: 22, fontSize: 11, fontWeight: selectedTag === 'ALL' ? 700 : 500 }}
              />
              {allTags.map(tag => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  clickable
                  color={selectedTag === tag ? 'primary' : 'default'}
                  variant={selectedTag === tag ? 'filled' : 'outlined'}
                  onClick={() => setSelectedTag(prev => prev === tag ? 'ALL' : tag)}
                  sx={{ height: 22, fontSize: 11 }}
                />
              ))}
            </Box>
          )}
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell padding="checkbox">
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>Diff</Typography>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Workflow & Creator</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Customer / Project</TableCell>
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
              ) : filteredEstimations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                    {hasActiveFilters ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          No estimations match the active filter criteria.
                        </Typography>
                        <Button size="small" variant="outlined" onClick={handleClearFilters}>
                          Reset All Filters
                        </Button>
                      </Box>
                    ) : (
                      "No estimations saved. Configure and run an estimate in the Builder to persist results."
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEstimations.map(row => (
                  <TableRow key={row.ID} hover>
                    <TableCell padding="checkbox">
                      <Checkbox 
                        checked={selectedIds.includes(row.ID)}
                        onChange={() => handleSelectCompare(row.ID)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.name}</Typography>
                        <Chip 
                          label={`v${row.version}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined" 
                          sx={{ height: 20, fontSize: 10, fontWeight: 700 }} 
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.3 }}>
                          <PersonIcon sx={{ fontSize: 13, color: 'text.secondary' }} /> {row.createdBy}
                        </Typography>
                        {row.tags && (
                          <Typography variant="caption" sx={{ color: 'primary.main', fontSize: 11 }}>
                            · {row.tags}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={row.project} 
                        size="small" 
                        variant="outlined" 
                        sx={{ fontWeight: 600, fontSize: 11, borderColor: '#cbd5e1', bgcolor: '#f8fafc' }} 
                      />
                    </TableCell>
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
