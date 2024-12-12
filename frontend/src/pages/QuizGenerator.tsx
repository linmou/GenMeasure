import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

interface QuizGenerationRequest {
  knowledge_point: string;
  school_level: 'primary' | 'middle' | 'undergraduate';
  item_type: 'dichotomous' | 'polynomous';
  num_items: number;
}

const QuizGenerator: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = React.useState<QuizGenerationRequest>({
    knowledge_point: '',
    school_level: 'primary',
    item_type: 'dichotomous',
    num_items: 5,
  });

  const generateQuizMutation = useMutation({
    mutationFn: async (data: QuizGenerationRequest) => {
      const response = await axios.post(`${API_BASE_URL}/api/quiz/generate`, data);
      return response.data;
    },
    onSuccess: (data) => {
      navigate(`/simulation/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateQuizMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name as string]: value,
    }));
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom align="center">
        Generate Math Quiz
      </Typography>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Knowledge Point"
              name="knowledge_point"
              value={formData.knowledge_point}
              onChange={handleChange}
              margin="normal"
              required
              helperText="Enter the specific math concept to test"
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>School Level</InputLabel>
              <Select
                name="school_level"
                value={formData.school_level}
                onChange={handleChange}
                required
              >
                <MenuItem value="primary">Primary School</MenuItem>
                <MenuItem value="middle">Middle School</MenuItem>
                <MenuItem value="undergraduate">Undergraduate</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>Item Type</InputLabel>
              <Select
                name="item_type"
                value={formData.item_type}
                onChange={handleChange}
                required
              >
                <MenuItem value="dichotomous">Dichotomous (True/False)</MenuItem>
                <MenuItem value="polynomous">Polynomous (Multiple Choice)</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Number of Items"
              name="num_items"
              type="number"
              value={formData.num_items}
              onChange={handleChange}
              margin="normal"
              required
              inputProps={{ min: 1, max: 50 }}
              helperText="Enter the number of questions (1-50)"
            />

            {generateQuizMutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Error generating quiz: {generateQuizMutation.error.message}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              sx={{ mt: 3 }}
              disabled={generateQuizMutation.isPending}
            >
              {generateQuizMutation.isPending ? 'Generating...' : 'Generate Quiz'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QuizGenerator; 