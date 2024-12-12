import json
from pathlib import Path
import csv
from typing import Literal, Union, List
from openai import OpenAI
# from vllm import LLM, SamplingParams
import argparse
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm
import numpy as np

StudentType = Literal["primary", "middle", "undergraduate", "other"]

class LocalLLM:
    def __init__(self, model_path: str, batch_size: int = 32):
        self.llm = LLM(model=model_path)
        self.batch_size = batch_size
        self.sampling_params = SamplingParams(
            temperature=0,
            max_tokens=10,
            stop=None
        )

    def analyze_student_types_batch(self, personas: List[str]) -> List[StudentType]:
        prompts = [
            f"""Analyze the following persona description and determine if they are a primary school student, middle school student, undergraduate student, or other. 
            Only respond with one of these exact words: "primary", "middle", "undergraduate", "other".
            
            Persona: {persona}"""
            for persona in personas
        ]
        
        outputs = self.llm.generate(prompts, self.sampling_params)
        results = []
        for output in outputs:
            response = output.outputs[0].text.strip().lower()
            if response not in ["primary", "middle", "undergraduate", "other"]:
                print(f"Warning: Invalid response '{response}', defaulting to 'other'")
                response = "other"
            results.append(response)
        return results

    def process_all_personas(self, persona_ls: List[dict]) -> dict[StudentType, List[dict]]:
        categories: dict[StudentType, List[dict]] = {
            "primary": [], "middle": [], "undergraduate": [], "other": []
        }
        
        # Process in batches
        persona_batches = [
            persona_ls[i:i + self.batch_size] 
            for i in range(0, len(persona_ls), self.batch_size)
        ]
        
        with tqdm(total=len(persona_ls), desc="Processing personas (Local LLM)") as pbar:
            for batch in persona_batches:
                persona_texts = [p['persona'] for p in batch]
                results = self.analyze_student_types_batch(persona_texts)
                
                for persona, student_type in zip(batch, results):
                    categories[student_type].append(persona)
                pbar.update(len(batch))
        
        return categories

class DeepSeekLLM:
    def __init__(self, api_key: str, base_url: str, max_workers: int = 10):
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )
        self.max_workers = max_workers

    def analyze_student_type(self, persona: str) -> StudentType:
        prompt = """Analyze the following persona description and determine if they are a primary school student, middle school student, undergraduate student, or other. 
        Only respond with one of these exact words: "primary", "middle", "undergraduate", "other".
        
        Persona: {persona}"""
        
        try:
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=[{"role": "user", "content": prompt.format(persona=persona)}],
                temperature=0.2,
                max_tokens=10
            )
            response = response.choices[0].message.content.strip().lower()
            if response not in ["primary", "middle", "undergraduate", "other"]:
                raise ValueError(f"Invalid response: {response}")
            return response
        except ValueError as e:
            print(f"Error processing persona: {e}")
            self.analyze_student_type(persona)
            
        except Exception as e:
            print(f"Error processing persona: {e}")
            return "other"


    def process_all_personas(self, persona_ls: List[dict]) -> dict[StudentType, List[dict]]:
        categories: dict[StudentType, List[dict]] = {
            "primary": [], "middle": [], "undergraduate": [], "other": []
        }
        
        def process_single_persona(persona):
            student_type = self.analyze_student_type(persona['persona'])
            return persona, student_type
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(process_single_persona, persona) for persona in persona_ls]
            
            with tqdm(total=len(persona_ls), desc="Processing personas (DeepSeek)") as pbar:
                for future in futures:
                    persona, student_type = future.result()
                    categories[student_type].append(persona)
                    pbar.update(1)
        
        return categories

def save_categories(categories: dict[StudentType, List[dict]], output_dir: Path):
    for category, personas in categories.items():
        if not personas:  # Skip empty categories
            continue
            
        output_path = output_dir / f'{category}_students.csv'
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=personas[0].keys())
            writer.writeheader()
            writer.writerows(personas)
        
        print(f"Saved {len(personas)} {category} student personas to {output_path}")

def main():
    parser = argparse.ArgumentParser(description='Process personas using either DeepSeek or local Llama model')
    parser.add_argument('--use-local', action='store_true', help='Use local Llama model instead of DeepSeek')
    parser.add_argument('--model-path', type=str, default='meta-llama/Llama-3.1-8B-Instruct',
                        help='Path to local Llama model')
    parser.add_argument('--deepseek-api-key', type=str, help='DeepSeek API key')
    parser.add_argument('--deepseek-base-url', type=str, default='https://api.deepseek.com/v1',
                        help='DeepSeek API base URL')
    parser.add_argument('--batch-size', type=int, default=32, help='Batch size for local LLM processing')
    parser.add_argument('--max-workers', type=int, default=10, help='Max workers for DeepSeek API calls')
    args = parser.parse_args()

    # Load personas
    with open( '/data/home/jjl7137/PersonalHub/persona.jsonl', 'r', encoding='utf-8') as f:
        persona_ls = []
        for line in f.readlines():
            persona_ls.append(json.loads(line))
    
    persona_ls = persona_ls[:10000]
    
    # Initialize LLM
    if args.use_local:
        print(f"Using local Llama model: {args.model_path}")
        llm = LocalLLM(args.model_path, batch_size=args.batch_size)
    else:
        if not args.deepseek_api_key:
            raise ValueError("DeepSeek API key is required when not using local model")
        print("Using DeepSeek API")
        llm = DeepSeekLLM(args.deepseek_api_key, args.deepseek_base_url, max_workers=args.max_workers)
    
    # Process personas
    categories = llm.process_all_personas(persona_ls)
    
    # Save results
    save_categories(categories, Path(__file__).parent)

if __name__ == "__main__":
    main()
    
