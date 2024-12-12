import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

interface DimensionalityResult {
  method: 'efa' | 'noharm';
  is_unidimensional: boolean;
  factor_loadings: Record<string, number>;
  problematic_items: string[];
  fit_statistics: Record<string, number>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analysis-tabpanel-${index}`}
      aria-labelledby={`analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AnalysisView: React.FC = () => {
  const { simulationId } = useParams<{ simulationId: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = React.useState(0);

  const { data: analysis, isLoading, error } = useQuery({
    queryKey: ['analysis', simulationId],
    queryFn: async () => {
      const response = await axios.get<DimensionalityResult>(
        `${API_BASE_URL}/api/analysis/dimensionality/${simulationId}`
      );
      return response.data;
    },
  });

  const refineMutation = useMutation({
    mutationFn: async (itemsToRefine: string[]) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/analysis/refine-items`,
        {
          simulation_id: simulationId,
          problematic_items: itemsToRefine,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      // Refetch the analysis after refinement
      window.location.reload();
    },
  });

  const proceedToIRTMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_BASE_URL}/api/analysis/irt-fit`,
        {
          simulation_id: simulationId,
          model_type: 'rasch', // Default to Rasch model
        }
      );
      return response.data;
    },
    onSuccess: (data) => {
      navigate(`/results/${data.id}`);
    },
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading analysis: {error.message}
      </Alert>
    );
  }

  if (!analysis) {
    return null;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const factorLoadingsChart = {
    labels: Object.keys(analysis.factor_loadings),
    datasets: [
      {
        label: 'Factor Loadings',
        data: Object.values(analysis.factor_loadings),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Item Factor Loadings',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Loading Value',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Item Number',
        },
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Dimensionality Analysis
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="analysis tabs">
          <Tab label="Overview" />
          <Tab label="Factor Loadings" />
          <Tab label="Problematic Items" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Analysis Summary
                </Typography>
                <Typography color={analysis.is_unidimensional ? 'success.main' : 'error.main'}>
                  Unidimensionality: {analysis.is_unidimensional ? 'Confirmed' : 'Not Confirmed'}
                </Typography>
                <Typography>Method: {analysis.method.toUpperCase()}</Typography>
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Fit Statistics
                </Typography>
                {Object.entries(analysis.fit_statistics).map(([key, value]) => (
                  <Typography key={key}>
                    {key}: {value.toFixed(3)}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 2 }}>
          <Line data={factorLoadingsChart} options={chartOptions} />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Problematic Items
            </Typography>
            {analysis.problematic_items.length > 0 ? (
              <List>
                {analysis.problematic_items.map((item, index) => (
                  <React.Fragment key={item}>
                    <ListItem>
                      <ListItemText primary={item} />
                    </ListItem>
                    {index < analysis.problematic_items.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Typography>No problematic items identified</Typography>
            )}
          </CardContent>
        </Card>
      </TabPanel>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        {!analysis.is_unidimensional && (
          <Button
            variant="contained"
            color="warning"
            onClick={() => refineMutation.mutate(analysis.problematic_items)}
            disabled={refineMutation.isPending}
          >
            {refineMutation.isPending ? 'Refining...' : 'Refine Problematic Items'}
          </Button>
        )}
        {analysis.is_unidimensional && (
          <Button
            variant="contained"
            color="primary"
            onClick={() => proceedToIRTMutation.mutate()}
            disabled={proceedToIRTMutation.isPending}
          >
            {proceedToIRTMutation.isPending ? 'Processing...' : 'Proceed to IRT Analysis'}
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default AnalysisView; 