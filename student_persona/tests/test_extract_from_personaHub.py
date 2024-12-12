import pytest
from pathlib import Path
from extract_from_personaHub import LocalLLM, DeepSeekLLM, save_categories
from unittest.mock import Mock, patch, mock_open
import json

# Test data
MOCK_PERSONAS = [
    {"id": "1", "persona": "I am a 7-year-old who loves math and science."},
    {"id": "2", "persona": "I'm a high school student preparing for college."},
    {"id": "3", "persona": "As a computer science major in university..."},
    {"id": "4", "persona": "I'm a working professional learning programming..."}
]

@pytest.fixture
def mock_local_llm():
    with patch('vllm.LLM') as mock_llm:
        # Configure the mock to return predetermined responses
        mock_instance = mock_llm.return_value
        mock_instance.generate.return_value = [
            Mock(outputs=[Mock(text="primary")]),
            Mock(outputs=[Mock(text="middle")]),
            Mock(outputs=[Mock(text="undergraduate")]),
            Mock(outputs=[Mock(text="other")])
        ]
        yield LocalLLM("mock_model_path")

@pytest.fixture
def mock_deepseek_llm():
    with patch('openai.OpenAI') as mock_client:
        # Configure the mock to return predetermined responses
        mock_instance = mock_client.return_value
        mock_instance.chat.completions.create.side_effect = [
            Mock(choices=[Mock(message=Mock(content="primary"))]),
            Mock(choices=[Mock(message=Mock(content="middle"))]),
            Mock(choices=[Mock(message=Mock(content="undergraduate"))]),
            Mock(choices=[Mock(message=Mock(content="other"))])
        ]
        yield DeepSeekLLM("mock_api_key", "mock_base_url")

def test_local_llm_batch_processing(mock_local_llm):
    """Test that LocalLLM correctly processes a batch of personas"""
    result = mock_local_llm.analyze_student_types_batch([p['persona'] for p in MOCK_PERSONAS])
    assert result == ["primary", "middle", "undergraduate", "other"]

def test_local_llm_process_all_personas(mock_local_llm):
    """Test that LocalLLM correctly categorizes all personas"""
    categories = mock_local_llm.process_all_personas(MOCK_PERSONAS)
    
    assert len(categories["primary"]) == 1
    assert len(categories["middle"]) == 1
    assert len(categories["undergraduate"]) == 1
    assert len(categories["other"]) == 1
    
    assert categories["primary"][0]["id"] == "1"
    assert categories["middle"][0]["id"] == "2"
    assert categories["undergraduate"][0]["id"] == "3"
    assert categories["other"][0]["id"] == "4"

def test_deepseek_llm_single_analysis(mock_deepseek_llm):
    """Test that DeepSeekLLM correctly analyzes a single persona"""
    result = mock_deepseek_llm.analyze_student_type(MOCK_PERSONAS[0]['persona'])
    assert result == "primary"

def test_deepseek_llm_process_all_personas(mock_deepseek_llm):
    """Test that DeepSeekLLM correctly processes all personas"""
    categories = mock_deepseek_llm.process_all_personas(MOCK_PERSONAS)
    
    assert len(categories["primary"]) == 1
    assert len(categories["middle"]) == 1
    assert len(categories["undergraduate"]) == 1
    assert len(categories["other"]) == 1

def test_save_categories(tmp_path):
    """Test that categories are correctly saved to CSV files"""
    categories = {
        "primary": [{"id": "1", "persona": "Primary school student"}],
        "middle": [{"id": "2", "persona": "Middle school student"}],
        "undergraduate": [{"id": "3", "persona": "Undergraduate student"}],
        "other": [{"id": "4", "persona": "Other"}]
    }
    
    save_categories(categories, tmp_path)
    
    # Verify files were created
    assert (tmp_path / "primary_students.csv").exists()
    assert (tmp_path / "middle_students.csv").exists()
    assert (tmp_path / "undergraduate_students.csv").exists()
    assert (tmp_path / "other_students.csv").exists()
    
    # Verify content of one file
    with open(tmp_path / "primary_students.csv", "r", encoding="utf-8") as f:
        content = f.read()
        assert "id,persona" in content
        assert "1,Primary school student" in content.replace("\r", "")

def test_invalid_llm_response(mock_local_llm):
    """Test handling of invalid LLM responses"""
    with patch('vllm.LLM') as mock_llm:
        mock_instance = mock_llm.return_value
        mock_instance.generate.return_value = [Mock(outputs=[Mock(text="invalid_response")])]
        
        local_llm = LocalLLM("mock_model_path")
        result = local_llm.analyze_student_types_batch(["test persona"])
        assert result == ["other"]  # Should default to "other" for invalid responses

def test_deepseek_api_error(mock_deepseek_llm):
    """Test handling of API errors in DeepSeekLLM"""
    with patch('openai.OpenAI') as mock_client:
        mock_instance = mock_client.return_value
        mock_instance.chat.completions.create.side_effect = Exception("API Error")
        
        deepseek_llm = DeepSeekLLM("mock_api_key", "mock_base_url")
        result = deepseek_llm.analyze_student_type("test persona")
        assert result == "other"  # Should default to "other" on API errors

if __name__ == "__main__":
    pytest.main([__file__]) 