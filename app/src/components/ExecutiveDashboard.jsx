import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

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
  median: 'Normal (Expected Median) uses the expected routing cycle count, default stochastic retry probability, and configured cache hit rate.',
  fat_tail: 'Budget ceiling / fat-tail expands routing cycles, assumes elevated retries, and removes cache benefit for conservative budgeting.',
  monte_carlo_p10: 'P10 uses a representative Monte Carlo sample nearest the optimistic percentile and scales it to the stored percentile value.',
  monte_carlo_p50: 'P50 uses a representative Monte Carlo sample nearest the median percentile and scales it to the stored percentile value.',
  monte_carlo_p90: 'P90 uses a representative Monte Carlo sample nearest the budget-ceiling percentile and scales it to the stored percentile value.',
  monte_carlo_p99: 'P99 uses a representative Monte Carlo sample nearest the value-at-risk percentile and scales it to the stored percentile value.'
};

export default function ExecutiveDashboard({ estimation, isMonteCarlo, onBack }) {
  const [detailedData, setDetailedData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState(isMonteCarlo ? 'monte_carlo_p50' : 'median');

  const isMc = isMonteCarlo;
  const estimationId = isMc ? estimation.simulationId : estimation.estimationId;
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

  const optimisticScenario = isMc
    ? estimation.percentiles?.find(p => p.percentile.includes('P10'))
    : estimation.scenarios?.find(s => s.name === 'optimistic');

  const medianScenario = isMc
    ? estimation.percentiles?.find(p => p.percentile.includes('P50'))
    : estimation.scenarios?.find(s => s.name === 'median');

  const worstScenario = isMc
    ? estimation.percentiles?.find(p => p.percentile.includes('P90'))
    : estimation.scenarios?.find(s => s.name === 'fat_tail');

  const renderScenarioCard = ({ scenarioName, scenario, title, chipLabel, chipColor, chipVariant, color, emphasized = false }) => {
    const monthlyValue = Number.parseFloat(scenario?.monthlyTcoUsd || 0);
    const outcomeCost = isMc ? monthlyValue / volume : Number.parseFloat(scenario?.costPerRunUsd || 0);
    const cuMonthlyCost = isMc ? scenario?.monthlyBtpCredits : scenario?.monthlyTcoBtpCredits;
    const isSelected = selectedScenario === scenarioName;

    return (
      <Card 
        onClick={() => setSelectedScenario(scenarioName)}
        sx={{ 
          borderTop: 4, 
          borderColor: color,
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          border: isSelected ? `2px solid ${color}` : '1px solid #e2e8f0',
          borderTopWidth: 4,
          boxShadow: isSelected ? `0 12px 20px -5px rgba(0, 0, 0, 0.1), 0 0 0 3px ${color}20` : 'var(--shadow-sm)',
          transform: isSelected ? 'translateY(-2px)' : 'none',
          bgcolor: isSelected ? '#ffffff' : 'var(--bg-surface)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: 'var(--shadow-md)',
            borderColor: color,
            borderTopWidth: 4
          }
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
              {title}
            </Typography>
            <Chip 
              label={chipLabel} 
              size="small" 
              color={chipColor} 
              variant={chipVariant} 
              sx={{ height: 22, fontSize: '11px', fontWeight: 700 }} 
            />
          </Box>
          <Typography variant="h3" className="tabular-nums" sx={{ fontWeight: 800, color, mb: 1 }}>
            {formatWholeCurrency(monthlyValue)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: 14, fontWeight: 600, ml: 0.5 }}>/ month</Typography>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2, pb: 2, borderBottom: '1px solid #f1f5f9' }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Outcome cost:</span>
              <strong className="tabular-nums" style={{ color: '#0f172a' }}>{formatCurrency(outcomeCost, 3)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CU monthly cost:</span>
              <strong className="tabular-nums" style={{ color: '#0f172a' }}>{cuMonthlyCost || 0} CU</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: isSelected ? color : 'text.secondary' }}>
              {isSelected ? '● Active Table Displayed' : 'Click to view detailed table'}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 800, color: isSelected ? color : 'text.muted' }}>
              {isSelected ? '↓' : '→'}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderDetailedTable = () => {
    const scenarioName = selectedScenario;
    const scenario = isMc 
      ? estimation.percentiles?.find(p => p.percentile === scenarioName || (scenarioName === 'monte_carlo_p50' && p.percentile.includes('P50')) || (scenarioName === 'monte_carlo_p10' && p.percentile.includes('P10')) || (scenarioName === 'monte_carlo_p90' && p.percentile.includes('P90')))
      : estimation.scenarios?.find(s => s.name === scenarioName);

    const detailedScenario = detailedData?.scenarios?.find(s => s.scenarioName === scenarioName);
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

    const titleMap = {
      optimistic: 'Optimistic Scenario',
      median: 'Normal (Expected Median)',
      fat_tail: 'Budget Ceiling (Fat-Tail)',
      monte_carlo_p10: 'P10 (Optimistic)',
      monte_carlo_p50: 'P50 (Normal Expected)',
      monte_carlo_p90: 'P90 (Budget Ceiling)'
    };

    const displayTitle = titleMap[scenarioName] || scenarioName;

    return (
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 3, boxShadow: 'var(--shadow-md)', overflow: 'hidden', mt: 1 }}>
        <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon sx={{ color: 'primary.main' }} />
              Detailed Calculation Table — {displayTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 900, lineHeight: 1.5 }}>
              {scenarioAssumptionText[scenarioName] || 'Per-cycle token consumption and Capacity Unit (CU) conversion rollup.'}
            </Typography>
          </Box>
          <Chip 
            label={`Volume: ${volume.toLocaleString()} runs/mo`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
          />
        </Box>

        <Box sx={{ p: 3 }}>
          {loadingDetails ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 6 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                Loading detailed calculation rollup...
              </Typography>
            </Box>
          ) : !detailedScenario ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Detailed per-cycle breakdown records are not available for this scenario yet.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="medium">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Cycle</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.primary' }}>Worker</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Input tokens</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Output tokens</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Input CU</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Output CU</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Total CU</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>CU price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.primary' }}>Total CU price</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cycleCalculationRows.map(({ row, inputTokens, outputTokens, inputCu, outputCu, totalCu, cuPrice, totalCuPrice }) => (
                      <TableRow key={row.ID || `${scenarioName}-${row.cycle}`} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ fontWeight: 600 }}>{row.cycle}</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{row.workerName}</TableCell>
                        <TableCell align="right" className="tabular-nums">{formatNumber(inputTokens)}</TableCell>
                        <TableCell align="right" className="tabular-nums">{formatNumber(outputTokens)}</TableCell>
                        <TableCell align="right" className="tabular-nums">{formatNumber(inputCu, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums">{formatNumber(outputCu, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 600 }}>{formatNumber(totalCu, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums">{formatCurrency(cuPrice, 4)}</TableCell>
                        <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 700, color: 'text.primary' }}>{formatCurrency(totalCuPrice, 6)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#eff6ff' }}>
                      <TableCell sx={{ fontWeight: 800, color: 'primary.dark' }}>Total</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: 'primary.dark' }}>Cost per run</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatNumber(totalInputTokensFromCycles)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatNumber(totalOutputTokensFromCycles)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatNumber(totalInputCu, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatNumber(totalOutputCu, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatNumber(totalCuFromCycles, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: 'primary.dark' }}>{formatCurrency(capacityUnitCostEur, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 900, color: 'primary.main', fontSize: 14 }}>{formatCurrency(totalCuPriceFromCycles || reportedCostPerRun, 6)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#eef2ff' }}>
                      <TableCell sx={{ fontWeight: 800, color: '#312e81' }}>Monthly</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(volume)} runs</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalInputTokensFromCycles * volume)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalOutputTokensFromCycles * volume)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalInputCu * volume, 2)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalOutputCu * volume, 2)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalCuFromCycles * volume, 2)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatCurrency(capacityUnitCostEur, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 900, color: '#312e81', fontSize: 15 }}>{formatCurrency(monthlyTco, 2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, px: 1 }}>
                Each row reads left to right: estimated tokens → converted Capacity Units → CU unit price → total EUR cost for that cycle. The <strong>Total</strong> row is the cost per run; the <strong>Monthly</strong> row is that same total scaled by monthly volume ({volume.toLocaleString()} runs). Cache discount already reduces the total CU price. Recorded cache-discount reference: {formatCurrency(cycleRows.reduce((sum, row) => sum + Number.parseFloat(row.cacheDiscountUsd || 0), 0), 6)} per run.
              </Typography>
            </Box>
          )}
        </Box>
      </Card>
    );
  };

  // Export dynamically built CSV in browser
  const handleExportCsv = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Scenario,Cost Per Run (EUR),Monthly TCO (EUR),Monthly CU Cost (EUR),Total Tokens\n";
    
    if (isMc) {
      estimation.percentiles?.forEach(p => {
        csvContent += `"${p.percentile}",${(parseFloat(p.monthlyTcoUsd)/volume).toFixed(4)},${p.monthlyTcoUsd},${p.monthlyBtpCredits},N/A\n`;
      });
    } else {
      estimation.scenarios?.forEach(s => {
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
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, bgcolor: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
      {/* Top Header Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, '@media print': { display: 'none' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<ArrowBackIcon />} 
            onClick={onBack}
            sx={{ border: '1px solid #cbd5e1', bgcolor: 'background.paper', color: 'text.primary', fontWeight: 700, px: 2.5 }}
          >
            Back to Builder
          </Button>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
              Estimation Results
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click any scenario tile below to view its detailed per-cycle calculation breakdown.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button 
            variant="outlined" 
            startIcon={<FileDownloadIcon />} 
            onClick={handleExportCsv}
            sx={{ border: '1px solid #cbd5e1', bgcolor: 'background.paper', fontWeight: 600 }}
          >
            Export CSV
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<FileDownloadIcon />} 
            onClick={handlePrintPdf}
            sx={{ fontWeight: 700, px: 3, boxShadow: 'var(--shadow-sm)' }}
          >
            Export Proposal PDF
          </Button>
        </Box>
      </Box>

      {/* 3-Scenario Tiles */}
      <Grid container spacing={3}>
        {/* Normal / Median */}
        <Grid item xs={12} md={4}>
          {renderScenarioCard({
            scenarioName: isMc ? 'monte_carlo_p50' : 'median',
            scenario: medianScenario,
            title: isMc ? 'P50 (Normal Expected)' : 'Normal (Expected Median)',
            chipLabel: 'Recommended',
            chipColor: 'primary',
            color: SCENARIO_COLORS.median,
            emphasized: true
          })}
        </Grid>

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

        {/* Budget / Fat-Tail */}
        <Grid item xs={12} md={4}>
          {renderScenarioCard({
            scenarioName: isMc ? 'monte_carlo_p90' : 'fat_tail',
            scenario: worstScenario,
            title: isMc ? 'P90 (Budget Ceiling)' : 'Budget Ceiling (Fat-Tail)',
            chipLabel: 'Worst Case',
            chipColor: 'warning',
            chipVariant: 'outlined',
            color: SCENARIO_COLORS.fat_tail
          })}
        </Grid>
      </Grid>

      {/* Detailed Table for Selected Scenario */}
      <Box>
        {renderDetailedTable()}
      </Box>
    </Box>
  );
}
