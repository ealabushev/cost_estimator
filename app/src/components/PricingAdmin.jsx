import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, Alert, CircularProgress, Snackbar, Chip, IconButton, TableSortLabel
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import RestoreIcon from '@mui/icons-material/Restore';
import SaveIcon from '@mui/icons-material/Save';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { getProviderLabel, groupByProvider } from '../utils/modelGrouping';

const MODEL_REGISTRY_COLUMNS = [
  { field: 'modelName', label: 'Model', align: 'left' },
  { field: 'description', label: 'API Description', align: 'left' },
  { field: 'contextWindowTokens', label: 'Context Length', align: 'right' },
  { field: 'capabilities', label: 'Capabilities', align: 'left' },
  { field: 'genAiTokenInputRate', label: 'Input Factor / 1K', align: 'right' },
  { field: 'genAiTokenOutputRate', label: 'Output Factor / 1K', align: 'right' },
  { field: 'consumptionSource', label: 'Data source', align: 'left' },
  { field: 'supportsPromptCaching', label: 'Prompt Caching', align: 'center' },
  { field: 'supportsExtendedThinking', label: 'Extended Thinking', align: 'center' }
];

const NUMERIC_MODEL_FIELDS = new Set([
  'contextWindowTokens',
  'genAiTokenInputRate',
  'genAiTokenOutputRate'
]);
const BOOLEAN_MODEL_FIELDS = new Set(['supportsPromptCaching', 'supportsExtendedThinking']);

function compareModelRows(a, b, field, direction) {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (NUMERIC_MODEL_FIELDS.has(field)) {
    const aValue = Number.parseFloat(a[field] ?? 0);
    const bValue = Number.parseFloat(b[field] ?? 0);
    if (aValue !== bValue) return (aValue - bValue) * multiplier;
    return String(a.modelName || '').localeCompare(String(b.modelName || ''));
  }

  if (BOOLEAN_MODEL_FIELDS.has(field)) {
    const aValue = a[field] ? 1 : 0;
    const bValue = b[field] ? 1 : 0;
    if (aValue !== bValue) return (aValue - bValue) * multiplier;
    return String(a.modelName || '').localeCompare(String(b.modelName || ''));
  }

  const aValue = field === 'provider' ? getProviderLabel(a.provider) : String(a[field] || '');
  const bValue = field === 'provider' ? getProviderLabel(b.provider) : String(b[field] || '');
  const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
  if (comparison !== 0) return comparison * multiplier;
  return String(a.modelName || '').localeCompare(String(b.modelName || ''));
}

function parseCapabilities(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [String(value)];
  } catch {
    return String(value)
      .split(',')
      .map(capability => capability.trim())
      .filter(Boolean);
  }
}

function formatModelValue(value, field) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  if (field === 'contextWindowTokens') {
    return Math.round(numeric).toLocaleString();
  }

  if (field === 'genAiTokenInputRate' || field === 'genAiTokenOutputRate') {
    return numeric.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  }

  return String(value);
}

function formatDataSource(source) {
  if (!source) return '—';
  if (source === 'api_fetch' || source === 'GenAI Hub') return 'GenAI Hub';
  return source;
}

function ReadOnlyNumber({ value, field }) {
  return (
    <Typography
      component="span"
      sx={{
        display: 'inline-block',
        minWidth: field === 'contextWindowTokens' ? 96 : 104,
        fontFamily: 'monospace',
        fontSize: 13,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 700,
        textAlign: 'right',
        whiteSpace: 'nowrap'
      }}
    >
      {formatModelValue(value, field)}
    </Typography>
  );
}

export default function PricingAdmin() {
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [modelConfigs, setModelConfigs] = useState([]);
  const [globalSettings, setGlobalSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState({ field: 'modelName', direction: 'asc' });
  const [collapsedPricingProviders, setCollapsedPricingProviders] = useState(() => new Set());
  const modelRows = useMemo(() => modelConfigs.map(model => {
    const consumption = model.consumption || {};
    return {
      ...model,
      genAiTokenInputRate: consumption.genAiTokenInputRate,
      genAiTokenOutputRate: consumption.genAiTokenOutputRate,
      consumptionSource: formatDataSource(consumption.source)
    };
  }), [modelConfigs]);
  const pricingGroups = useMemo(() => {
    const baseGroups = groupByProvider(modelRows);
    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;
    const grouped = baseGroups.map(group => ({
      ...group,
      models: [...group.models].sort((a, b) => compareModelRows(a, b, sortConfig.field, sortConfig.direction))
    }));

    if (sortConfig.field === 'provider') {
      return grouped.sort((a, b) => a.label.localeCompare(b.label) * directionMultiplier);
    }

    return grouped;
  }, [modelRows, sortConfig]);
  
  // Notification states
  const [alertInfo, setAlertInfo] = useState({ open: false, message: '', severity: 'success' });

  // Fetch Pricing Registry & Global Settings
  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [modelRes, pricingRes, settingsRes] = await Promise.all([
        fetch('/api/v1/estimation/ModelConfigs?$orderby=provider,modelName'),
        fetch('/api/v1/estimation/ModelPricing?$orderby=provider,modelName,effectiveDate desc'),
        fetch('/api/v1/estimation/GlobalAssumptionSettings')
      ]);

      if (!modelRes.ok || !pricingRes.ok || !settingsRes.ok) {
        throw new Error('Failed to fetch administrative data.');
      }
      
      const modelData = await modelRes.json();
      const pricingData = await pricingRes.json();
      const settingsData = await settingsRes.json();
      const pricingByModel = new Map((pricingData.value || []).map(pricing => [
        `${pricing.provider}::${pricing.modelName}`,
        pricing
      ]));
      
      setModelConfigs((modelData.value || []).map(model => ({
        ...model,
        consumption: pricingByModel.get(`${model.provider}::${model.modelName}`) || null
      })));
      setGlobalSettings(settingsData.value || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to fetch administrative data from SAP BTP.", "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setAlertInfo({ open: true, message, severity });
  };

  const togglePricingProvider = (provider) => {
    setCollapsedPricingProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const handleSort = (field) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const renderSortableHeader = ({ field, label, align }) => (
    <TableCell key={field} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} align={align}>
      <TableSortLabel
        active={sortConfig.field === field}
        direction={sortConfig.field === field ? sortConfig.direction : 'asc'}
        onClick={() => handleSort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const renderReadOnlyNumberCell = (row, field) => (
    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
      <ReadOnlyNumber value={row[field]} field={field} />
    </TableCell>
  );

  const renderBooleanCell = (value) => (
    <TableCell align="center">
      <Chip
        size="small"
        label={value ? 'Yes' : 'No'}
        color={value ? 'success' : 'default'}
        variant={value ? 'filled' : 'outlined'}
        sx={{ minWidth: 48, fontWeight: 700 }}
      />
    </TableCell>
  );

  const renderCapabilitiesCell = (capabilities) => {
    const parsed = parseCapabilities(capabilities);
    return (
      <TableCell sx={{ minWidth: 240, maxWidth: 340 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {parsed.length > 0 ? parsed.map(capability => (
            <Chip key={capability} size="small" label={capability} variant="outlined" sx={{ height: 22, maxWidth: 180 }} />
          )) : (
            <Typography variant="body2" color="text.secondary">—</Typography>
          )}
        </Box>
      </TableCell>
    );
  };

  // Handle field change in global settings
  const handleSettingFieldChange = (id, value) => {
    const updated = globalSettings.map(s => {
      if (s.ID === id) {
        return { ...s, settingValue: value };
      }
      return s;
    });
    setGlobalSettings(updated);
  };

  // Save changes to Model Pricing Registry and settings
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      if (activeSubTab === 0) {
        showSnackbar("Model pricing is read-only in this registry view.", "info");
      } else {
        // Save global settings
        for (const s of globalSettings) {
          await fetch(`/api/v1/estimation/GlobalAssumptionSettings(${s.ID})`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settingValue: s.settingValue })
          });
        }
        showSnackbar("Successfully saved global configuration rules.");
      }
      setSaving(false);
    } catch (err) {
      console.error(err);
      showSnackbar("An error occurred while saving updates.", "error");
      setSaving(false);
    }
  };

  // CAP Action: Sync models from SAP AI Core Model Discovery API
  const handleSyncModels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/estimation/refreshAiHubPricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      await loadAdminData();
      showSnackbar(`Sync complete. Updated ${data.value || 0} model metadata records.`);
    } catch (err) {
      console.error(err);
      showSnackbar(err.message || "Failed to trigger AI Core sync.", "error");
      setLoading(false);
    }
  };

  // CAP Action: Reset assumptions to SAP Defaults
  const handleResetDefaults = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/estimation/resetAssumptionsToDefaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      showSnackbar("Restored global guidelines to SAP Signavio industry benchmarks.");
      loadAdminData();
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to reset to factory defaults.", "error");
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f8fafc' }}>
      
      {/* Top Title Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
            Administrative Control Panel
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Configure SAP GenAI Hub baseline rates, model discovery synchronization, and stochastic thresholds.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {activeSubTab === 0 ? (
            <Button 
              variant="outlined" 
              startIcon={<CloudSyncIcon />}
              onClick={handleSyncModels}
              disabled={loading}
            >
              Sync AI Core Models
            </Button>
          ) : (
            <Button 
              variant="outlined" 
              startIcon={<RestoreIcon />}
              onClick={handleResetDefaults}
              disabled={loading}
            >
              Reset to SAP Defaults
            </Button>
          )}
          
          <Button 
            variant="contained" 
            color="primary"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveChanges}
            disabled={loading || saving || activeSubTab === 0}
            sx={{ fontWeight: 700 }}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs 
          value={activeSubTab} 
          onChange={(e, val) => setActiveSubTab(val)} 
          textColor="primary" 
          indicatorColor="primary" 
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="AI Hub Model Registry" sx={{ minHeight: 48, fontWeight: 700 }} />
          <Tab label="Global Heuristics Settings" sx={{ minHeight: 48, fontWeight: 700 }} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : activeSubTab === 0 ? (
          // Tab 1: AI Hub Model Discovery Registry
          <Box>
            <Alert severity="info" sx={{ m: 2, borderRadius: 2 }}>
              This view shows model metadata returned by SAP AI Core Model Discovery plus GenAI token conversion factors per 1,000 model tokens from versions[].cost when available. Capacity Unit conversion and EUR/CU price are maintained in Global Heuristics Settings.
            </Alert>
            <TableContainer component={Paper} elevation={0}>
            <Table sx={{ minWidth: 1680 }}>
              <TableHead sx={{ bgcolor: 'background.default' }}>
                <TableRow>
                  {MODEL_REGISTRY_COLUMNS.map(renderSortableHeader)}
                </TableRow>
              </TableHead>
              <TableBody>
                {pricingGroups.map(group => {
                  const isCollapsed = collapsedPricingProviders.has(group.provider);
                  return (
                  <React.Fragment key={group.provider}>
                    <TableRow
                      sx={{ bgcolor: '#eef2ff', cursor: 'pointer', '&:hover': { bgcolor: '#e0e7ff' } }}
                      onClick={() => togglePricingProvider(group.provider)}
                    >
                      <TableCell colSpan={9} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <IconButton size="small" sx={{ p: 0.25 }} aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}>
                            {isCollapsed ? <KeyboardArrowRightIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                            {group.label}
                          </Typography>
                          <Chip size="small" label={`${group.models.length} models`} sx={{ height: 22, fontWeight: 700 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                    {!isCollapsed && group.models.map(row => (
                      <TableRow key={row.ID} hover>
                        <TableCell sx={{ fontWeight: 700, pl: 4, minWidth: 220 }}>
                          {row.modelName}
                        </TableCell>
                        <TableCell sx={{ minWidth: 320, maxWidth: 460 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                            {row.description || '—'}
                          </Typography>
                        </TableCell>
                        {renderReadOnlyNumberCell(row, 'contextWindowTokens')}
                        {renderCapabilitiesCell(row.capabilities)}
                        {renderReadOnlyNumberCell(row, 'genAiTokenInputRate')}
                        {renderReadOnlyNumberCell(row, 'genAiTokenOutputRate')}
                        <TableCell sx={{ minWidth: 150 }}>
                          <Chip size="small" label={row.consumptionSource} color={row.consumptionSource === 'GenAI Hub' ? 'primary' : 'default'} variant="outlined" sx={{ fontWeight: 700 }} />
                        </TableCell>
                        {renderBooleanCell(row.supportsPromptCaching)}
                        {renderBooleanCell(row.supportsExtendedThinking)}
                      </TableRow>
                    ))}
                  </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>
        ) : (
          // Tab 2: Global Heuristics Settings
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Set standard ERP baseline labor hourly costs and default stochastic settings used when generating estimates.
            </Typography>
            <Grid container spacing={3}>
              {globalSettings.map(setting => (
                <Grid item xs={12} sm={6} key={setting.ID}>
                  <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {setting.settingKey.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        {setting.description || 'Global calculation setting.'}
                      </Typography>
                      <TextField 
                        value={setting.settingValue}
                        size="small"
                        onChange={(e) => handleSettingFieldChange(setting.ID, e.target.value)}
                        fullWidth
                        inputProps={{ style: { fontWeight: 600 } }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Box>

      {/* Snackbar alerts */}
      <Snackbar 
        open={alertInfo.open} 
        autoHideDuration={4000} 
        onClose={() => setAlertInfo({ ...alertInfo, open: false })}
      >
        <Alert severity={alertInfo.severity} sx={{ width: '100%', borderRadius: 2 }}>
          {alertInfo.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
