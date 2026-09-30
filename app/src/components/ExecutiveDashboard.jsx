import React, { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, CircularProgress, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

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

const formatCu = (value) => `${formatNumber(value, 4)} CU`;

// Comprehensive scenario profiles covering operational reality, mathematical mechanics, and budget governance
const SCENARIO_PROFILES = {
  optimistic: {
    title: 'Optimistic Scenario — Best Case Fast Path & Cost Floor',
    shortBadge: 'Best Case Floor',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    headerIcon: 'speed',
    parameters: [
      { label: 'Routing Cycles (M)', value: 'Fast Path: max(1, round(M × 0.75))', tooltip: 'Minimum turns required when user request is unambiguous' },
      { label: 'Retry Multiplier', value: '1.00× (Clean pass, 0% retries)', tooltip: 'Zero transient tool error contingency applied' },
      { label: 'Prompt Caching', value: '50% cache read discount (if enabled)', tooltip: 'Assumes high re-use of static instructions & tool schemas' },
      { label: 'Canvas Correlation', value: 'Exact 1:1 match with Canvas Node Cards', tooltip: 'Directly replicates the zero-retry clean pass token numbers from the workflow designer canvas' }
    ],
    operationalContext: 'Simulates an ideal execution where the user request is crystal-clear and resolved on the very first turn. Agents find necessary data immediately, tools succeed on the first attempt without exceptions or schema validation retries, and no supervisor re-routing occurs.',
    mathematicalMechanics: 'Evaluates the minimum necessary routing cycles with zero retry inflation (effectiveRetryProb = 0, retryMultiplier = 1.00). Worker output tokens equal exactly hops × avgOutputTokensPerHop (e.g. 2 hops × 1,024 = 2,048 tokens + 150 supervisor routing = 2,198 tokens). When prompt caching is active, repeated system prompt and worker registry tokens enjoy a 50% discount on billable input tokens.',
    budgetaryRole: 'Defines the theoretical lower-bound cost floor and minimum SLA expenditure. Use to benchmark unit economics against the raw single-turn numbers shown on the Workflow Designer canvas cards and calculate maximum caching ROI.'
  },
  median: {
    title: 'Normal (Expected Median) — Production Workload Baseline',
    shortBadge: 'Production Baseline',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    headerIcon: 'trending',
    parameters: [
      { label: 'Routing Cycles (M)', value: 'Nominal baseline: M cycles', tooltip: 'Standard multi-turn user conversation count' },
      { label: 'Retry Multiplier', value: '1 + p + p² (e.g. 1.0525× for 5% retry)', tooltip: 'Quadratic retry contingency for transient errors & schema validation loops' },
      { label: 'Prompt Caching', value: 'Configured hit rate (default ~35%–50%)', tooltip: 'Realistic cache hit rate observed in production' },
      { label: 'Canvas Correlation', value: 'Canvas baseline + retry uplift buffer', tooltip: 'Adds calibrated tool retry inflation to the canvas cards' }
    ],
    operationalContext: 'Models typical production workloads representing realistic day-to-day enterprise operations. Reflects normal multi-turn clarification conversations, occasional tool re-invocations due to schema validation or partial data fetches, and standard prompt cache warmup.',
    mathematicalMechanics: 'Simulates the full nominal routing cycle count M. Incorporates the worker\'s calibrated retry probability (p_retry, e.g. 5% nominal contingency from trace telemetry or 10% default) using the quadratic retry model: retryMultiplier = 1 + p_retry + p_retry² (e.g. for a 5% nominal retry rate, 1 + 0.05 + 0.0025 = 1.0525×). This uplifts worker output from 2,048 to 2,156 tokens (+108 contingency tokens), yielding 2,306 total output tokens with the supervisor dispatch (150 tokens). Later cycles accumulate 70% of prior turn context into the state history.',
    budgetaryRole: 'The primary SLA baseline for financial budgeting, annual IT cost forecasting, and SAP BTP Capacity Unit allocations. This is the recommended figure for formal business case ROI calculations.'
  },
  fat_tail: {
    title: 'Budget Ceiling (Fat-Tail) — Stress-Test Upper Guardrail',
    shortBadge: 'Risk Guardrail / Worst Case',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    headerIcon: 'warning',
    parameters: [
      { label: 'Routing Cycles (M)', value: 'Escalated: round(M × 1.5) + 1 cycles', tooltip: 'Extended turns due to supervisor re-routing & clarification' },
      { label: 'Retry Multiplier', value: 'Stress test: 1.39× to 2.44× multiplier', tooltip: 'Severe tool failure rate between 30% and 80%' },
      { label: 'Prompt Caching', value: '0% hit rate (Cold cache / invalidation)', tooltip: 'Conservative assumption: every turn is a full cache miss' },
      { label: 'Canvas Correlation', value: 'Worst-case multi-turn cascade', tooltip: 'Severe context snowballing & retry expansion' }
    ],
    operationalContext: 'Models challenging, high-friction edge cases: ambiguous or contradictory user prompts requiring supervisor re-routing, cascading tool execution errors, downstream API timeouts, and conversational context bloat.',
    mathematicalMechanics: 'Stretches routing cycles by 1.5× + 1 (e.g. 1 cycle stretches to 3 cycles; 4 cycles expand to 7 cycles), modeling prolonged multi-turn deliberation. Applies an aggressive retry rate between 30% and 80% (retryMultiplier = 1.39× to 2.44×), inflating per-hop token consumption. Strips out all prompt caching benefits (0% hit rate) to simulate cold starts and dynamic context shifts. Context history snowballs across all cycles up to the configured message trimming ceiling.',
    budgetaryRole: 'Defines the conservative high-water mark and financial safety ceiling. Allocating budget to this threshold guarantees that unexpected production spikes, API degradation incidents, or complex user prompts will not breach approved cost caps.'
  },
  monte_carlo_p10: {
    title: 'Monte Carlo P10 (Optimistic 10th Percentile)',
    shortBadge: 'P10 Lower Tail',
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    headerIcon: 'speed',
    parameters: [
      { label: 'Distribution Rank', value: '10th Percentile (Top 10% most efficient)', tooltip: 'Only 10% of simulation runs cost less than this' },
      { label: 'Tool Hops Sampling', value: 'Poisson sampled (Lower tail)', tooltip: 'Randomized tool hops sampled near lower bound' },
      { label: 'Retry Sampling', value: 'Binomial sampled (Minimal retries)', tooltip: 'Stochastically minimal transient retries' },
      { label: 'Cache Sampling', value: 'Normal distribution (High cache affinity)', tooltip: 'Sampled near high end of cache hit distribution' }
    ],
    operationalContext: 'Synthesized from 1,000 stochastic simulation iterations. Represents runs where random user requests required minimal tool hops, encountered virtually no transient network errors, and achieved optimal prompt cache re-use.',
    mathematicalMechanics: 'Extracts the cost threshold where 10% of all simulated runs fell at or below this value. Validates the lower tail of empirical risk distributions without relying on static happy-path assumptions.',
    budgetaryRole: 'Best-case operational benchmark for lean processing periods or high-cache repeat workflows.'
  },
  monte_carlo_p50: {
    title: 'Monte Carlo P50 (Stochastic Expected Median)',
    shortBadge: 'P50 Probabilistic Median',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    headerIcon: 'trending',
    parameters: [
      { label: 'Distribution Rank', value: '50th Percentile (True probabilistic median)', tooltip: 'Exact 500th iteration out of 1,000 runs' },
      { label: 'Tool Hops Sampling', value: 'L ~ Poisson(avgToolHops)', tooltip: 'Tool hops sampled from Poisson distribution' },
      { label: 'Retry Sampling', value: 'R ~ Binomial(maxRetries, p_retry)', tooltip: 'Retries sampled from Binomial distribution' },
      { label: 'Cache Sampling', value: 'C ~ Normal(cacheRate, 0.10)', tooltip: 'Cache rate sampled from truncated Normal distribution' }
    ],
    operationalContext: 'The statistically grounded median outcome across 1,000 end-to-end user simulation runs. Unlike deterministic models, it naturally captures the true variance in real-world LLM non-determinism, varying prompt lengths, and random network retries.',
    mathematicalMechanics: 'Identifies the exact 500th ranked iteration in 1,000 simulated runs. Integrates Poisson-distributed tool hops, Binomial-distributed retry counts, and truncated Normal cache hit rates to capture continuous risk variance.',
    budgetaryRole: 'The most statistically rigorous number for enterprise financial planning and monthly SAP AI Core quota provisioning.'
  },
  monte_carlo_p90: {
    title: 'Monte Carlo P90 (Budget Ceiling / High-Water Mark)',
    shortBadge: 'P90 Budget Ceiling',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    headerIcon: 'warning',
    parameters: [
      { label: 'Distribution Rank', value: '90th Percentile (Covers 90% of outcomes)', tooltip: '90% of simulation runs cost equal or less' },
      { label: 'Tool Hops Sampling', value: 'Poisson sampled (Upper 90% tail)', tooltip: 'Captures complex reasoning multi-hop loops' },
      { label: 'Retry Sampling', value: 'Binomial sampled (Multiple error loops)', tooltip: 'Captures transient tool error bursts' },
      { label: 'Cache Sampling', value: 'Normal distribution (Low cache affinity)', tooltip: 'Sampled near low end of cache hit distribution' }
    ],
    operationalContext: 'Captures heavy multi-turn conversational interactions where complex tasks require above-average tool reasoning loops and experience occasional transient API retry cascades.',
    mathematicalMechanics: 'The 900th ranked iteration out of 1,000 runs. Accurately prices the 90% confidence interval, ensuring only 1 out of 10 runs will ever cost more than this threshold.',
    budgetaryRole: 'Standard enterprise budget reservation ceiling. Setting cost guardrails at P90 provides 90% confidence that monthly invoices will remain under budget.'
  },
  monte_carlo_p99: {
    title: 'Monte Carlo P99 (Value-at-Risk / Black Swan Outlier)',
    shortBadge: 'P99 Value-at-Risk',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    headerIcon: 'warning',
    parameters: [
      { label: 'Distribution Rank', value: '99th Percentile (1 in 100 extreme runs)', tooltip: 'Tail-risk extreme black swan event' },
      { label: 'Tool Hops Sampling', value: 'Severe Poisson hop expansion', tooltip: 'Heavy iterative agent tool loops' },
      { label: 'Retry Sampling', value: 'Maximum Binomial retry saturation', tooltip: 'Saturated tool execution retries' },
      { label: 'Cache Sampling', value: 'Cold cache / zero cache hit', tooltip: 'Complete cache miss across all turns' }
    ],
    operationalContext: 'Extreme edge-case failure modes: multi-agent circular reasoning, prolonged tool error loops, repeated API timeout retries, and massive conversational context accumulation.',
    mathematicalMechanics: 'The 990th ranked iteration out of 1,000 runs. Measures the fat-tail risk exposure under extreme operational stress with zero cache relief and maximum hop expansion.',
    budgetaryRole: 'Value-at-Risk (VaR) audit figure. Informs finance and enterprise security teams of the maximum theoretical burst exposure during severe production anomalies.'
  }
};

function ScenarioDeepDiveBanner({ scenarioName }) {
  const profile = SCENARIO_PROFILES[scenarioName] || SCENARIO_PROFILES.median;
  const [showFullDetails, setShowFullDetails] = useState(false);

  return (
    <Box sx={{
      mt: 2,
      borderRadius: 2.5,
      bgcolor: profile.bgColor,
      border: `1px solid ${profile.borderColor}`,
      transition: 'all 0.25s ease-in-out',
      overflow: 'hidden'
    }}>
      {/* Clickable Header Bar */}
      <Box 
        onClick={() => setShowFullDetails(!showFullDetails)}
        sx={{ 
          p: 2,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap', 
          gap: 1.5,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: `${profile.color}0d`
          }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
          {profile.headerIcon === 'speed' && <SpeedIcon sx={{ color: profile.color, fontSize: 22 }} />}
          {profile.headerIcon === 'trending' && <TrendingUpIcon sx={{ color: profile.color, fontSize: 22 }} />}
          {profile.headerIcon === 'warning' && <WarningAmberIcon sx={{ color: profile.color, fontSize: 22 }} />}
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
            {profile.title}
          </Typography>
          <Chip 
            label={profile.shortBadge} 
            size="small" 
            sx={{ 
              bgcolor: '#ffffff', 
              color: profile.color, 
              border: `1px solid ${profile.borderColor}`,
              fontWeight: 700, 
              fontSize: '11px',
              height: 22 
            }} 
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: profile.color, display: { xs: 'none', sm: 'inline-block' } }}>
            {showFullDetails ? 'Hide Deep Dive' : 'Methodology, Math & Governance'}
          </Typography>
          <Button 
            size="small" 
            variant="outlined"
            endIcon={showFullDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            onClick={(e) => {
              e.stopPropagation();
              setShowFullDetails(!showFullDetails);
            }}
            sx={{ 
              textTransform: 'none', 
              fontWeight: 700, 
              fontSize: '12px', 
              borderColor: profile.borderColor,
              color: profile.color,
              bgcolor: '#ffffff',
              '&:hover': {
                bgcolor: '#ffffff',
                borderColor: profile.color
              }
            }}
          >
            {showFullDetails ? 'Collapse' : 'Expand Deep Dive'}
          </Button>
        </Box>
      </Box>

      {/* Expanded Content: Parameters + 3-Column Narrative */}
      {showFullDetails && (
        <Box sx={{ p: 2.5, pt: 0.5 }}>
          {/* Parameter Chips Grid */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            {profile.parameters.map((param, idx) => (
              <Grid item xs={12} sm={6} md={3} key={idx}>
                <Tooltip title={param.tooltip} arrow placement="top">
                  <Box sx={{ 
                    p: 1.25, 
                    borderRadius: 2, 
                    bgcolor: '#ffffff', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    height: '100%',
                    cursor: 'help'
                  }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.25, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>
                      {param.label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '12px' }}>
                      {param.value}
                    </Typography>
                  </Box>
                </Tooltip>
              </Grid>
            ))}
          </Grid>

          {/* 3-Column In-Depth Narrative */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: '#ffffff', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16, color: profile.color }} />
                  Real-World Operational Context
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', fontSize: '12.5px', lineHeight: 1.6 }}>
                  {profile.operationalContext}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: '#ffffff', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                  <CalculateOutlinedIcon sx={{ fontSize: 16, color: profile.color }} />
                  Mathematical Mechanics & Token Math
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', fontSize: '12.5px', lineHeight: 1.6 }}>
                  {profile.mathematicalMechanics}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={4}>
              <Box sx={{ 
                p: 2, 
                borderRadius: 2, 
                bgcolor: '#ffffff', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>
                  <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16, color: profile.color }} />
                  Executive Governance & Budget Role
                </Typography>
                <Typography variant="body2" sx={{ color: '#334155', fontSize: '12.5px', lineHeight: 1.6 }}>
                  {profile.budgetaryRole}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

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
              <strong className="tabular-nums" style={{ color: '#0f172a' }}>{formatCu(cuMonthlyCost)}</strong>
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
    const activeProfile = SCENARIO_PROFILES[scenarioName] || SCENARIO_PROFILES.median;

    return (
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 3, boxShadow: 'var(--shadow-md)', overflow: 'hidden', mt: 1 }}>
        <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon sx={{ color: activeProfile.color }} />
              Detailed Calculation Table — {displayTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 900, lineHeight: 1.5 }}>
              Per-cycle token breakdown, SAP AI Hub Capacity Unit (CU) conversion, and mathematical mechanics for {displayTitle}.
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
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalInputCu * volume, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalOutputCu * volume, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatNumber(totalCuFromCycles * volume, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 800, color: '#312e81' }}>{formatCurrency(capacityUnitCostEur, 4)}</TableCell>
                      <TableCell align="right" className="tabular-nums" sx={{ fontWeight: 900, color: '#312e81', fontSize: 15 }}>{formatCurrency(monthlyTco, 2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6, px: 1 }}>
                Each row reads left to right: estimated tokens → converted Capacity Units → CU unit price → total EUR cost for that cycle. The <strong>Total</strong> row is the cost per run; the <strong>Monthly</strong> row is that same total scaled by monthly volume ({volume.toLocaleString()} runs). Cache discount already reduces the total CU price. Recorded cache-discount reference: {formatCurrency(cycleRows.reduce((sum, row) => sum + Number.parseFloat(row.cacheDiscountUsd || 0), 0), 6)} per run.
              </Typography>

              {/* Extensive Scenario Mechanics & Governance Deep Dive (under table, collapsed by default) */}
              <ScenarioDeepDiveBanner scenarioName={scenarioName} />
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {estimation.workflowName ? `${estimation.workflowName}` : 'Estimation Results'}
              </Typography>
              {estimation.workflowVersion && (
                <Chip 
                  label={`v${estimation.workflowVersion}`} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                  sx={{ fontWeight: 700, fontSize: 11, height: 22 }} 
                />
              )}
            </Box>
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
