import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
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

interface IRTResults {
  model_type: 'rasch' | '2pl' | '3pl';
  item_parameters: Record<string, number[]>;
  model_fit_statistics: Record<string, number>;
  item_fit_statistics: Record<string, Record<string, number>>;
  test_information: {
    test_information_curve: Record<string, number[]>;
    item_information_curves: Record<string, Record<string, number[]>>;
    reliability_coefficient: number;
    measurement_precision: Record<string, number>;
  };
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
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ResultsView: React.FC = () => {
  const { analysisId } = useParams<{ analysisId: string }>();
  const [tabValue, setTabValue] = React.useState(0);
  const [selectedModel, setSelectedModel] = React.useState<'rasch' | '2pl' | '3pl'>('rasch');

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['results', analysisId, selectedModel],
    queryFn: async () => {
      const response = await axios.get<IRTResults>(
        `${API_BASE_URL}/api/analysis/irt-fit/${analysisId}?model=${selectedModel}`
      );
      return response.data;
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
        Error loading results: {error.message}
      </Alert>
    );
  }

  if (!results) {
    return null;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleModelChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setSelectedModel(event.target.value as 'rasch' | '2pl' | '3pl');
  };

  const testInformationChart = {
    labels: Object.keys(results.test_information.test_information_curve),
    datasets: [
      {
        label: 'Test Information',
        data: Object.values(results.test_information.test_information_curve),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
    ],
  };

  const itemInformationChart = {
    labels: Object.keys(results.test_information.item_information_curves[Object.keys(results.test_information.item_information_curves)[0]]),
    datasets: Object.entries(results.test_information.item_information_curves).map(([item, curve], index) => ({
      label: `Item ${item}`,
      data: Object.values(curve),
      borderColor: `hsl(${(index * 360) / Object.keys(results.test_information.item_information_curves).length}, 70%, 50%)`,
      backgroundColor: `hsla(${(index * 360) / Object.keys(results.test_information.item_information_curves).length}, 70%, 50%, 0.5)`,
    })),
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        IRT Analysis Results
      </Typography>

      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>IRT Model</InputLabel>
          <Select value={selectedModel} onChange={handleModelChange} label="IRT Model">
            <MenuItem value="rasch">Rasch Model</MenuItem>
            <MenuItem value="2pl">2PL Model</MenuItem>
            <MenuItem value="3pl">3PL Model</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="results tabs">
          <Tab label="Model Fit" />
          <Tab label="Test Information" />
          <Tab label="Item Information" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Model Fit Statistics
                </Typography>
                {Object.entries(results.model_fit_statistics).map(([key, value]) => (
                  <Typography key={key}>
                    {key}: {value.toFixed(3)}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Item Parameters
                </Typography>
                {Object.entries(results.item_parameters).map(([item, params]) => (
                  <Typography key={item}>
                    Item {item}: {params.map(p => p.toFixed(3)).join(', ')}
                  </Typography>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Test Information Curve
          </Typography>
          <Line data={testInformationChart} options={chartOptions} />
          <Box sx={{ mt: 2 }}>
            <Typography>
              Reliability Coefficient: {results.test_information.reliability_coefficient.toFixed(3)}
            </Typography>
          </Box>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Item Information Curves
          </Typography>
          <Line data={itemInformationChart} options={chartOptions} />
        </Paper>
      </TabPanel>
    </Box>
  );
};

export default ResultsView; 