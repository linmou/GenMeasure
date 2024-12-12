import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import theme from './theme';

// Pages
import QuizGenerator from './pages/QuizGenerator';
import SimulationView from './pages/SimulationView';
import AnalysisView from './pages/AnalysisView';
import ResultsView from './pages/ResultsView';

// Components
import Layout from './components/Layout';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<QuizGenerator />} />
              <Route path="/simulation/:quizId" element={<SimulationView />} />
              <Route path="/analysis/:simulationId" element={<AnalysisView />} />
              <Route path="/results/:analysisId" element={<ResultsView />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App; 