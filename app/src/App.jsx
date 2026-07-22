import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, AppBar, Toolbar, Typography, Tabs, Tab, Container, Button } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import HistoryIcon from '@mui/icons-material/History';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

import WorkflowBuilder from './components/WorkflowBuilder';
import HistoryComparison from './components/HistoryComparison';
import PricingAdmin from './components/PricingAdmin';
import ModelExplanation from './components/ModelExplanation';

// Custom theme mapping the Titanium Slate aesthetic
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4f46e5', // Indigo 600
      dark: '#4338ca', // Indigo 700
      light: '#eef2ff', // Indigo 50
    },
    secondary: {
      main: '#0f172a', // Slate 900
    },
    background: {
      default: '#f8fafc', // Slate 50
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a', // Slate 900
      secondary: '#475569', // Slate 600
    },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    h2: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"Outfit", "Inter", sans-serif',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          border: '1px solid #e2e8f0',
        },
      },
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState('history');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [selectedEstimation, setSelectedEstimation] = useState(null);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 'builder' && !selectedWorkflowId) {
      // Keep state
    }
  };

  const handleLoadWorkflow = (workflowId, estimation = null) => {
    setSelectedWorkflowId(workflowId);
    setSelectedEstimation(estimation);
    setActiveTab('builder');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar sx={{ justifyContent: 'space-between', px: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <AssessmentIcon sx={{ color: 'primary.main', fontSize: 32 }} />
              <Typography variant="h6" component="div" sx={{ color: 'secondary.main', fontWeight: 700, fontFamily: '"Outfit", sans-serif', letterSpacing: '-0.02em' }}>
                Agent Cost Estimator
              </Typography>
            </Box>

            <Tabs value={activeTab} onChange={handleTabChange} textColor="primary" indicatorColor="primary" aria-label="application navigation">
              <Tab value="history" label="History" icon={<HistoryIcon />} iconPosition="start" sx={{ minHeight: 64, fontWeight: 600 }} />
              <Tab value="builder" label="Estimate" icon={<CalculateIcon />} iconPosition="start" sx={{ minHeight: 64, fontWeight: 600 }} />
              <Tab value="explain" label="Explain Model" icon={<LightbulbIcon />} iconPosition="start" sx={{ minHeight: 64, fontWeight: 600 }} />
              <Tab value="admin" label="Pricing & settings" icon={<SettingsSuggestIcon />} iconPosition="start" sx={{ minHeight: 64, fontWeight: 600 }} />
            </Tabs>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'builder' && (
            <WorkflowBuilder 
              workflowId={selectedWorkflowId} 
              initialEstimation={selectedEstimation} 
              onLoadWorkflow={handleLoadWorkflow}
            />
          )}
          {activeTab === 'explain' && (
            <ModelExplanation />
          )}
          {activeTab === 'history' && (
            <HistoryComparison 
              onLoadWorkflow={handleLoadWorkflow}
            />
          )}
          {activeTab === 'admin' && (
            <PricingAdmin />
          )}
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
