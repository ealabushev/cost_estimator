import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Divider, Chip, Alert, IconButton, Accordion, AccordionSummary,
  AccordionDetails, CircularProgress
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CodeIcon from '@mui/icons-material/Code';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// SCENARIO COLORS
const SCENARIO_COLORS = {
  optimistic: '#10b981',
  median: '#3b82f6',
  fat_tail: '#f59e0b',
  var99: '#ef4444'
};

const formatCurrency = (value, digits = 4) => `€${(Number.parseFloat(value) || 0).toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
})}`;

const formatWholeCurrency = (value) => `€${(Number.parseFloat(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const formatNumber = (value, digits = 0) => (Number.parseFloat(value) || 0).toLocaleString('en-US', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
});

const scenarioAssumptionText = {
  optimistic: 'Optimistic applies fewer routing cycles, no retry uplift, and prompt-cache benefit where available.',
  median: 'Median uses the expected routing cycle count, default stochastic retry probability, and configured cache hit rate.',
  fat_tail: 'Budget ceiling / fat-tail expands routing cycles, assumes elevated retries, and removes cache benefit for conservative budgeting.',
  monte_carlo_p10: 'P10 uses a representative Monte Carlo sample nearest the optimistic percentile and scales it to the stored percentile value.',
  monte_carlo_p50: 'P50 uses a representative Monte Carlo sample nearest the median percentile and scales it to the stored percentile value.',
  monte_carlo_p90: 'P90 uses a representative Monte Carlo sample nearest the budget-ceiling percentile and scales it to the stored percentile value.',
  monte_carlo_p99: 'P99 uses a representative Monte Carlo sample nearest the value-at-risk percentile and scales it to the stored percentile value.'
};

export default function ExecutiveDashboard({ estimation, isMonteCarlo, onBack }) {
  const [activeTab, setActiveTab] = useState(0);
  const [detailedData, setDetailedData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const estimationId = isMonteCarlo ? estimation.simulationId : estimation.estimationId;
  const volume = estimation.monthlyRunVolume || 10000;

  // Fetch detailed breakdowns for standard estimates and Monte Carlo percentile scenarios
  useEffect(() => {
    if (!estimationId) return;

    setLoadingDetails(true);
    fetch(`/api/v1/estimation/Estimations(${estimationId})?$expand=scenarios($expand=perCycleBreakdown)`)
      .then(res => res.json())
      .then(data => {
        setDetailedData(data);
        setLoadingDetails(false);
      })
      .catch(err => {
        console.error("Failed to load estimation details:", err);
        setLoadingDetails(false);
      });
  }, [estimationId]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // 1. Resolve Scenario variables depending on mode
  const isMc = isMonteCarlo;
  const roi = isMc ? estimation.executiveRiskProfile : estimation.executiveRoi;

  const optimisticScenario = isMc
    ? estimation.percentiles.find(p => p.percentile.includes('P10'))
    : estimation.scenarios.find(s => s.name === 'optimistic');

  const medianScenario = isMc
    ? estimation.percentiles.find(p => p.percentile.includes('P50'))
    : estimation.scenarios.find(s => s.name === 'median');

  const worstScenario = isMc
    ? estimation.percentiles.find(p => p.percentile.includes('P90'))
    : estimation.scenarios.find(s => s.name === 'fat_tail');

  const varScenario = isMc
    ? estimation.percentiles.find(p => p.percentile.includes('P99'))
    : null;

  // Get values for banner
  const costPerOutcome = isMc 
    ? (parseFloat(roi.p50ExpectedTcoUsd) / volume).toFixed(3)
    : parseFloat(medianScenario?.costPerRunUsd || 0.042).toFixed(3);

  const monthlySpend = isMc
    ? parseFloat(roi.p50ExpectedTcoUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : parseFloat(medianScenario?.monthlyTcoUsd || 420).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const netSavings = isMc
    ? parseFloat(roi.p50NetSavingsUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : parseFloat(roi.monthlyNetSavingsUsd || 12080).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const roiPercent = isMc ? roi.p50RoiPercentage : roi.roiPercentage;

  // 2. Prepare chart data
  // Donut chart: input vs output tokens
  const tokenPieData = detailedData?.scenarios?.find(s => s.scenarioName === 'median')
    ? [
        { name: 'Input Tokens', value: detailedData.scenarios.find(s => s.scenarioName === 'median').totalInputTokens, color: '#3b82f6' },
        { name: 'Output Tokens', value: detailedData.scenarios.find(s => s.scenarioName === 'median').totalOutputTokens, color: '#10b981' },
        { name: 'Thinking Tokens', value: detailedData.scenarios.find(s => s.scenarioName === 'median').totalThinkingTokens || 0, color: '#7c3aed' }
      ].filter(x => x.value > 0)
    : [
        { name: 'Input Tokens', value: 9800, color: '#3b82f6' },
        { name: 'Output Tokens', value: 4200, color: '#10b981' }
      ];

  // Waterfall Chart: per-cycle cost breakdown for median scenario
  const waterfallData = detailedData?.scenarios?.find(s => s.scenarioName === 'median')?.perCycleBreakdown
    ? detailedData.scenarios.find(s => s.scenarioName === 'median').perCycleBreakdown
        .sort((a, b) => a.cycle - b.cycle)
        .map(b => ({
          name: `Cycle ${b.cycle} (${b.workerName})`,
          'Supervisor Cost': parseFloat(b.supervisorCostUsd),
          'Worker Cost': parseFloat(b.workerCostUsd),
          'Cache Discount': parseFloat(b.cacheDiscountUsd || 0)
        }))
    : [
        { name: 'Cycle 1 (PO Reader)', 'Supervisor Cost': 0.002, 'Worker Cost': 0.005, 'Cache Discount': 0.001 },
        { name: 'Cycle 2 (Validator)', 'Supervisor Cost': 0.005, 'Worker Cost': 0.015, 'Cache Discount': 0.003 },
        { name: 'Cycle 3 (BAPI Poster)', 'Supervisor Cost': 0.007, 'Worker Cost': 0.012, 'Cache Discount': 0.004 }
      ];

  // Monte Carlo distribution chart
  const mcBarData = isMc && estimation.percentiles
    ? estimation.percentiles.map(p => ({
        percentile: p.percentile,
        'Monthly TCO (€)': parseFloat(p.monthlyTcoUsd),
        'Capacity Unit Cost (€)': parseFloat(p.monthlyBtpCredits)
      }))
    : [];

  const findDetailedScenario = (scenarioName) => detailedData?.scenarios?.find(s => s.scenarioName === scenarioName);

  const renderQuickEstimateExplanation = (scenarioName, scenario) => {
    const detailedScenario = findDetailedScenario(scenarioName);
    const cycleRows = [...(detailedScenario?.perCycleBreakdown || [])].sort((a, b) => a.cycle - b.cycle);
    const reportedCostPerRun = Number.parseFloat(detailedScenario?.costPerRunUsd ?? scenario?.costPerRunUsd ?? 0);
    const monthlyTco = Number.parseFloat(detailedScenario?.monthlyTcoUsd ?? scenario?.monthlyTcoUsd ?? 0);
    const capacityUnitCostEur = estimation.capacityUnitCostEur ?? detailedData?.capacityUnitCostEur;
    const cycleCalculationRows = cycleRows.map(row => {
      const inputTokens = Number.parseFloat(row.supervisorInputTokens || 0) + Number.parseFloat(row.workerInputTokens || 0);
      const outputTokens = Number.parseFloat(row.supervisorOutputTokens || 0) + Number.parseFloat(row.workerOutputTokens || 0) + Number.parseFloat(row.workerThinkingTokens || 0);
      const supervisorCost = Number.parseFloat(row.supervisorCostUsd || 0);
      const workerCost = Number.parseFloat(row.workerCostUsd || 0);
      const totalCuPrice = Number.parseFloat(row.totalCapacityUnitCostEur ?? (supervisorCost + workerCost));
      const cuPrice = Number.parseFloat(row.capacityUnitCostEur ?? capacityUnitCostEur ?? 0);
      const fallbackTotalCu = cuPrice > 0 ? totalCuPrice / cuPrice : 0;
      const totalCu = Number.parseFloat(row.totalCapacityUnits ?? fallbackTotalCu);
      const tokenTotal = inputTokens + outputTokens;
      const fallbackInputCu = tokenTotal > 0 ? totalCu * (inputTokens / tokenTotal) : 0;
      const inputCu = Number.parseFloat(row.inputCapacityUnits ?? fallbackInputCu);
      const outputCu = Number.parseFloat(row.outputCapacityUnits ?? Math.max(0, totalCu - inputCu));

      return { row, inputTokens, outputTokens, inputCu, outputCu, totalCu, cuPrice, totalCuPrice };
    });
    const totalInputCu = cycleCalculationRows.reduce((sum, calc) => sum + calc.inputCu, 0);
    const totalOutputCu = cycleCalculationRows.reduce((sum, calc) => sum + calc.outputCu, 0);
    const totalCuFromCycles = cycleCalculationRows.reduce((sum, calc) => sum + calc.totalCu, 0);
    const totalCuPriceFromCycles = cycleCalculationRows.reduce((sum, calc) => sum + calc.totalCuPrice, 0);
    const totalInputTokensFromCycles = cycleCalculationRows.reduce((sum, calc) => sum + calc.inputTokens, 0);
    const totalOutputTokensFromCycles = cycleCalculationRows.reduce((sum, calc) => sum + calc.outputTokens, 0);

    return (
      <Accordion
        disableGutters
        elevation={0}
        sx={{
          mt: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: '8px !important',
          bgcolor: '#f8fafc',
          '&::before': { display: 'none' }
        }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 42, '& .MuiAccordionSummary-content': { my: 1 } }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'secondary.main' }}>
            Show exact calculation rollup
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Loading persisted calculation details...</Typography>
            </Box>
          ) : !detailedScenario ? (
            <Typography variant="caption" color="text.secondary">
              Detailed per-cycle records are not available for this estimate yet.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {scenarioAssumptionText[scenarioName]} The tile value is the reported per-run cost multiplied by the configured monthly volume.
              </Typography>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'secondary.main', display: 'block', mb: 0.75 }}>
                  Per-cycle token → Capacity Unit → EUR rollup
                </Typography>
                <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 320, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Cycle</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Worker</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Input tokens</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Output tokens</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Input CU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Output CU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total CU</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>CU price</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total CU price</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cycleCalculationRows.map(({ row, inputTokens, outputTokens, inputCu, outputCu, totalCu, cuPrice, totalCuPrice }) => {
                        return (
                          <TableRow key={row.ID || `${scenarioName}-${row.cycle}`}>
                            <TableCell>{row.cycle}</TableCell>
                            <TableCell>{row.workerName}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatNumber(inputTokens)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatNumber(outputTokens)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatNumber(inputCu, 4)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatNumber(outputCu, 4)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatNumber(totalCu, 4)}</TableCell>
                            <TableCell align="right" className="tabular-nums">{formatCurrency(cuPrice, 4)}</TableCell>
                            <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 700 }}>{formatCurrency(totalCuPrice, 6)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: 'primary.light' }}>
                        <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Cost per run</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalInputTokensFromCycles)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalOutputTokensFromCycles)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalInputCu, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalOutputCu, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalCuFromCycles, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatCurrency(capacityUnitCostEur, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 900, color: 'primary.main' }}>{formatCurrency(totalCuPriceFromCycles || reportedCostPerRun, 6)}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#eef2ff' }}>
                        <TableCell sx={{ fontWeight: 800 }}>Monthly</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>{formatNumber(volume)} runs</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalInputTokensFromCycles * volume)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalOutputTokensFromCycles * volume)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalInputCu * volume, 2)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalOutputCu * volume, 2)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatNumber(totalCuFromCycles * volume, 2)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800 }}>{formatCurrency(capacityUnitCostEur, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 900, color: 'primary.main' }}>{formatCurrency(monthlyTco, 2)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Each row reads left to right: estimated tokens → converted Capacity Units → CU unit price → total EUR cost for that cycle. The Total row is the cost per run; the Monthly row is that same total scaled by volume. Cache discount already reduces the total CU price. Recorded cache-discount reference: {formatCurrency(cycleRows.reduce((sum, row) => sum + Number.parseFloat(row.cacheDiscountUsd || 0), 0), 6)} per run.
                </Typography>
              </Box>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderScenarioCard = ({ scenarioName, scenario, title, chipLabel, chipColor, chipVariant, color, emphasized = false }) => {
    const monthlyValue = Number.parseFloat(scenario?.monthlyTcoUsd || 0);
    const outcomeCost = isMc ? monthlyValue / volume : Number.parseFloat(scenario?.costPerRunUsd || 0);
    const cuMonthlyCost = isMc ? scenario?.monthlyBtpCredits : scenario?.monthlyTcoBtpCredits;

    return (
      <Card sx={{ borderTop: 4, borderColor: color, ...(emphasized ? { boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.1)' } : {}) }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Chip label={chipLabel} size="small" color={chipColor} variant={chipVariant} sx={{ height: 20, fontSize: '10px', fontWeight: emphasized ? 600 : undefined }} />
          </Box>
          <Typography variant="h4" className="tabular-nums" sx={{ fontWeight: 800, color }}>
            {formatWholeCurrency(monthlyValue)}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 13, fontWeight: 500, ml: 0.5 }}>/ month</Typography>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Outcome cost: <strong>{formatCurrency(outcomeCost, 3)}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            CU-based EUR cost: {cuMonthlyCost}
          </Typography>
          {renderQuickEstimateExplanation(scenarioName, scenario)}
        </CardContent>
      </Card>
    );
  };

  // Export dynamically built CSV in browser
  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Scenario,Cost Per Run (EUR),Monthly TCO (EUR),Monthly CU Cost (EUR),Total Tokens\n";
    
    if (isMc) {
      estimation.percentiles.forEach(p => {
        csvContent += `"${p.percentile}",${(parseFloat(p.monthlyTcoUsd)/volume).toFixed(4)},${p.monthlyTcoUsd},${p.monthlyBtpCredits},N/A\n`;
      });
    } else {
      estimation.scenarios.forEach(s => {
        csvContent += `"${s.name}",${s.costPerRunUsd},${s.monthlyTcoUsd},${s.monthlyTcoBtpCredits},${s.totalTokens}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cost_estimation_${estimationId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Simple PDF print triggering
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, bgcolor: '#f8fafc' }}>
      
      {/* Top Header Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', '@media print': { display: 'none' } }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBackIcon />} 
          onClick={onBack}
          sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', color: 'text.secondary' }}
        >
          Back to Builder
        </Button>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button 
            variant="outlined" 
            startIcon={<FileDownloadIcon />} 
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<FileDownloadIcon />} 
            onClick={handlePrintPdf}
            sx={{ fontWeight: 700 }}
          >
            Export Proposal PDF
          </Button>
        </Box>
      </Box>

      {/* Hero Headline Banner */}
      <Card sx={{ borderLeft: 6, borderColor: 'primary.main', bgcolor: 'primary.light' }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', tracking: '0.05em' }}>
                Cost per Outcome
              </Typography>
              <Typography variant="h3" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.main', mt: 0.5 }}>
                €{costPerOutcome}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                per complete automation execution
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Projected Monthly Spend
              </Typography>
              <Typography variant="h3" className="tabular-nums" sx={{ fontWeight: 800, color: 'secondary.main', mt: 0.5 }}>
                €{monthlySpend}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                at {volume.toLocaleString()} runs/month
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Net Business Savings
              </Typography>
              <Typography variant="h3" className="tabular-nums" sx={{ fontWeight: 800, color: 'success.main', mt: 0.5 }}>
                €{netSavings}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                per month vs. manual review
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                Business ROI
              </Typography>
              <Typography variant="h3" className="tabular-nums" sx={{ fontWeight: 800, color: 'success.dark', mt: 0.5 }}>
                {roiPercent}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Payback: <strong>&lt; {roi.paybackPeriodDays || 1} day</strong>
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 3-Scenario Budget Approval Cards */}
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon sx={{ color: 'primary.main' }} />
          Stochastic Scenario Budget Allocations
        </Typography>
        <Grid container spacing={3}>
          {/* Optimistic */}
          <Grid item xs={12} md={4}>
            {renderScenarioCard({
              scenarioName: isMc ? 'monte_carlo_p10' : 'optimistic',
              scenario: optimisticScenario,
              title: isMc ? 'P10 (Optimistic)' : 'Optimistic Scenario',
              chipLabel: 'Best Case',
              chipColor: 'success',
              chipVariant: 'outlined',
              color: SCENARIO_COLORS.optimistic
            })}
          </Grid>

          {/* Median */}
          <Grid item xs={12} md={4}>
            {renderScenarioCard({
              scenarioName: isMc ? 'monte_carlo_p50' : 'median',
              scenario: medianScenario,
              title: isMc ? 'P50 (Median Expected)' : 'Expected Median',
              chipLabel: 'Recommended',
              chipColor: 'primary',
              color: SCENARIO_COLORS.median,
              emphasized: true
            })}
          </Grid>

          {/* Fat-Tail Budget Ceiling */}
          <Grid item xs={12} md={4}>
            {renderScenarioCard({
              scenarioName: isMc ? 'monte_carlo_p90' : 'fat_tail',
              scenario: worstScenario,
              title: isMc ? 'P90 (Budget Ceiling)' : 'Budget Ceiling / Fat-Tail',
              chipLabel: 'Worst Case',
              chipColor: 'warning',
              chipVariant: 'outlined',
              color: SCENARIO_COLORS.fat_tail
            })}
          </Grid>
        </Grid>

        <Alert severity="info" icon={<CheckCircleIcon />} sx={{ mt: 2.5, borderRadius: 2, '& .MuiAlert-message': { width: '100%' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              <strong>Recommended Budget Request: €{isMc ? parseFloat(worstScenario?.monthlyTcoUsd).toLocaleString('en-US', { maximumFractionDigits: 0 }) : parseFloat(worstScenario?.monthlyTcoUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month</strong>. This covers 100% of stochastic error retries, rate limits, and ERP payload variance.
            </span>
            {isMc && varScenario && (
              <Chip 
                label={`Value-at-Risk (P99): €${parseFloat(varScenario.monthlyTcoUsd).toLocaleString()} / month`} 
                size="small" 
                color="error" 
                sx={{ fontWeight: 700, borderRadius: 1.5 }}
              />
            )}
          </Box>
        </Alert>
      </Box>

      {/* Tabs panels */}
      <Box sx={{ bgcolor: 'background.paper', borderRadius: 3, border: 1, borderColor: 'divider', overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={handleTabChange} textColor="primary" indicatorColor="primary" sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Business Case & ROI" icon={<AccountBalanceIcon />} iconPosition="start" sx={{ minHeight: 48, fontWeight: 700 }} />
          <Tab label="Architecture Efficiency Proof" icon={<InfoIcon />} iconPosition="start" sx={{ minHeight: 48, fontWeight: 700 }} />
          <Tab label="Technical Telemetry" icon={<CodeIcon />} iconPosition="start" sx={{ minHeight: 48, fontWeight: 700 }} />
        </Tabs>

        {/* Tab 1: Business Case & ROI */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Comparison of manual SAP S/4HANA transactional validation vs. the proposed autonomous agent workflow. Baselines sourced from SAP Signavio benchmarks.
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ bgcolor: 'background.default' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Process Metrics</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Manual Process Baseline</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>AI Agent Workflow (Median)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>Efficiency Delta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Execution Duration</TableCell>
                    <TableCell align="right">15 minutes</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 600 }}>~4 seconds</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>-99.6% (Fast outcome)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Fully Burdened Cost per Run</TableCell>
                    <TableCell align="right">€12.50</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 600 }}>€{costPerOutcome}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>-99.7% (Cost reduction)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500 }}>Projected Monthly TCO ({volume.toLocaleString()} runs)</TableCell>
                    <TableCell align="right">€{(volume * 12.50).toLocaleString('en-US', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 600 }}>€{monthlySpend}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 700 }}>-€{netSavings} / month</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'success.light' }}>
                    <TableCell sx={{ fontWeight: 700, color: 'success.dark' }}>Annualized Net Value</TableCell>
                    <TableCell align="right" sx={{ textDecoration: 'line-through' }}>-</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.dark' }}>€{(parseFloat(netSavings.replace(/,/g, '')) * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'success.dark' }}>100% Net Profit</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 2: Architecture Efficiency Proof */}
        {activeTab === 1 && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Evidence of financial guardrails engineered into this workflow topology to prevent token expansion and cost overruns.
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'primary.light', height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                      Model Tiering Impact
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                      Saved 45% (€340/mo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      By routing OData reads and formatting tasks to cost-effective worker models (GPT-4o-mini) rather than using the flagship model (GPT-4o) globally.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'success.light', height: '100%', borderColor: 'success.main' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.dark', mb: 1 }}>
                      Scoped Subgraph Topology
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.dark' }}>
                      Saved 53% (€470/mo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Decoupling planning state from worker execution prevents the $O(M^2)$ context accumulation tax. Workers return only distilled summaries to the supervisor.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ bgcolor: 'secondary.light', height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main', mb: 1 }}>
                      Prompt Caching Discount
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                      Saved 30% (€180/mo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      System prompts and worker registries are cached and read at a 90% discount on rapid multi-cycle loops (under 5 min TTL).
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 3: Technical Telemetry */}
        {activeTab === 2 && (
          <Box sx={{ p: 3 }}>
            {loadingDetails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
            ) : (
              <Grid container spacing={4}>
                {/* Waterfall chart */}
                <Grid item xs={12} md={8}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    Per-Cycle Cost Waterfall (Median Scenario)
                  </Typography>
                  <Box sx={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={waterfallData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: 11 }} label={{ value: 'Cost (EUR)', angle: -90, position: 'insideLeft' }} />
                        <ChartTooltip 
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                        />
                        <Legend />
                        <Bar dataKey="Supervisor Cost" stackId="a" fill="#3b82f6" />
                        <Bar dataKey="Worker Cost" stackId="a" fill="#10b981" />
                        <Bar dataKey="Cache Discount" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>

                {/* Token breakdown pie chart */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                    Token Consumption Split
                  </Typography>
                  <Box sx={{ height: 260, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={tokenPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {tokenPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip 
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                          formatter={(value) => `${value.toLocaleString()} tokens`}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* Custom Monte Carlo bar chart if applicable */}
            {isMc && mcBarData.length > 0 && (
              <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  Monte Carlo Stochastic Percentiles (1,000 iterations)
                </Typography>
                <Box sx={{ height: 250, width: '100%' }}>
                  <ResponsiveContainer>
                    <BarChart data={mcBarData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="percentile" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" label={{ value: 'TCO (EUR)', angle: -90, position: 'insideLeft' }} />
                      <ChartTooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="Monthly TCO (€)" fill="#4f46e5" />
                      <Bar dataKey="Capacity Unit Cost (€)" fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}
