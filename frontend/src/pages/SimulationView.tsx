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
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

interface SimulationResponse {
  quiz_id: string;
  responses: Array<{
    student_id: string;
    responses: Record<string, string>;
    score: number;
  }>;
  summary_statistics: {
    mean: number;
    std_dev: number;
    min: number;
    max: number;
  };
}

const SimulationView: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const { data: simulation, isLoading, error } = useQuery({
    queryKey: ['simulation', quizId],
    queryFn: async () => {
      const response = await axios.get<SimulationResponse>(
        `${API_BASE_URL}/api/simulation/${quizId}`
      );
      return response.data;
    },
  });

  const startAnalysisMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_BASE_URL}/api/analysis/dimensionality`,
        { simulation_id: quizId }
      );
      return response.data;
    },
    onSuccess: (data) => {
      navigate(`/analysis/${data.id}`);
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
        Error loading simulation: {error.message}
      </Alert>
    );
  }

  if (!simulation) {
    return null;
  }

  const chartData = {
    labels: ['0-20%', '21-40%', '41-60%', '61-80%', '81-100%'],
    datasets: [
      {
        label: 'Score Distribution',
        data: calculateScoreDistribution(simulation.responses),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
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
        text: 'Student Score Distribution',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Students',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Score Range',
        },
      },
    },
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Simulation Results
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Summary Statistics
              </Typography>
              <Typography>Mean Score: {simulation.summary_statistics.mean.toFixed(2)}</Typography>
              <Typography>
                Standard Deviation: {simulation.summary_statistics.std_dev.toFixed(2)}
              </Typography>
              <Typography>Minimum Score: {simulation.summary_statistics.min.toFixed(2)}</Typography>
              <Typography>Maximum Score: {simulation.summary_statistics.max.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Bar data={chartData} options={chartOptions} />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => startAnalysisMutation.mutate()}
              disabled={startAnalysisMutation.isPending}
            >
              {startAnalysisMutation.isPending
                ? 'Starting Analysis...'
                : 'Start Dimensionality Analysis'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

function calculateScoreDistribution(
  responses: SimulationResponse['responses']
): number[] {
  const distribution = new Array(5).fill(0);
  responses.forEach((response) => {
    const scorePercentage = response.score * 100;
    const index = Math.min(Math.floor(scorePercentage / 20), 4);
    distribution[index]++;
  });
  return distribution;
}

export default SimulationView; 