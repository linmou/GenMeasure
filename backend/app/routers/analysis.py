from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Dict, Optional
from enum import Enum
import numpy as np
import pandas as pd
from factor_analyzer import FactorAnalyzer
import rpy2.robjects as robjects
from rpy2.robjects import pandas2ri

class AnalysisType(str, Enum):
    EFA = "efa"
    NOHARM = "noharm"

class ModelType(str, Enum):
    RASCH = "rasch"
    TWO_PL = "2pl"
    THREE_PL = "3pl"

class DimensionalityResult(BaseModel):
    method: AnalysisType
    is_unidimensional: bool
    factor_loadings: Dict[str, float]
    problematic_items: List[str]
    fit_statistics: Dict[str, float]

class IRTModelFit(BaseModel):
    model_type: ModelType
    item_parameters: Dict[str, List[float]]
    model_fit_statistics: Dict[str, float]
    item_fit_statistics: Dict[str, Dict[str, float]]

class TestInformation(BaseModel):
    test_information_curve: Dict[str, List[float]]
    item_information_curves: Dict[str, Dict[str, List[float]]]
    reliability_coefficient: float
    measurement_precision: Dict[str, float]

router = APIRouter()

def perform_efa_analysis(data: pd.DataFrame) -> DimensionalityResult:
    """
    Perform Exploratory Factor Analysis to check dimensionality.
    """
    # Standardize the data
    fa = FactorAnalyzer(rotation=None, n_factors=1)
    fa.fit(data)
    
    # Get factor loadings
    loadings = fa.loadings_
    loadings_dict = {f"item_{i+1}": float(loading[0]) 
                    for i, loading in enumerate(loadings)}
    
    # Calculate fit statistics
    variance_explained = fa.get_factor_variance()[0][0]
    eigenvalues = fa.get_eigenvalues()[0]
    
    # Identify problematic items (loading < 0.3)
    problematic = [item for item, loading in loadings_dict.items() 
                  if abs(loading) < 0.3]
    
    # Check unidimensionality (using various criteria)
    is_unidimensional = (
        variance_explained >= 0.2 and  # At least 20% variance explained
        eigenvalues[0] / eigenvalues[1] >= 3  # Ratio criterion
    )
    
    return DimensionalityResult(
        method=AnalysisType.EFA,
        is_unidimensional=is_unidimensional,
        factor_loadings=loadings_dict,
        problematic_items=problematic,
        fit_statistics={
            "variance_explained": float(variance_explained),
            "eigenvalue_ratio": float(eigenvalues[0] / eigenvalues[1]),
            "kaiser_meyer_olkin": float(fa.kmo_)
        }
    )

def perform_noharm_analysis(data: pd.DataFrame) -> DimensionalityResult:
    """
    Perform NOHARM analysis using R through rpy2.
    """
    # Convert pandas DataFrame to R dataframe
    pandas2ri.activate()
    r_dataframe = pandas2ri.py2rpy(data)
    
    # Load and run NOHARM analysis through R
    robjects.r('''
        library(NOHARM)
        perform_noharm <- function(data) {
            model <- NOHARM(data, factors=1)
            list(
                loadings=model$loadings,
                fit=model$fit,
                rmsr=model$rmsr
            )
        }
    ''')
    
    # Get results from R
    r_results = robjects.r['perform_noharm'](r_dataframe)
    
    # Convert results back to Python
    loadings_dict = {f"item_{i+1}": float(loading) 
                    for i, loading in enumerate(r_results.rx2('loadings'))}
    
    # Identify problematic items
    problematic = [item for item, loading in loadings_dict.items() 
                  if abs(loading) < 0.3]
    
    return DimensionalityResult(
        method=AnalysisType.NOHARM,
        is_unidimensional=r_results.rx2('rmsr')[0] < 0.05,  # RMSR criterion
        factor_loadings=loadings_dict,
        problematic_items=problematic,
        fit_statistics={
            "rmsr": float(r_results.rx2('rmsr')[0]),
            "fit_index": float(r_results.rx2('fit')[0])
        }
    )

def fit_rasch_model(data: pd.DataFrame) -> IRTModelFit:
    """
    Fit Rasch model using R's ltm package.
    """
    pandas2ri.activate()
    r_dataframe = pandas2ri.py2rpy(data)
    
    # Load and run Rasch analysis through R
    robjects.r('''
        library(ltm)
        fit_rasch <- function(data) {
            model <- rasch(data)
            list(
                coef=coef(model),
                aic=AIC(model),
                bic=BIC(model),
                item_fit=itemfit(model)
            )
        }
    ''')
    
    r_results = robjects.r['fit_rasch'](r_dataframe)
    
    # Convert parameters to Python dictionary
    item_parameters = {
        f"item_{i+1}": [float(diff)]  # Only difficulty parameter for Rasch
        for i, diff in enumerate(r_results.rx2('coef'))
    }
    
    return IRTModelFit(
        model_type=ModelType.RASCH,
        item_parameters=item_parameters,
        model_fit_statistics={
            "aic": float(r_results.rx2('aic')[0]),
            "bic": float(r_results.rx2('bic')[0])
        },
        item_fit_statistics={
            f"item_{i+1}": {
                "chi_square": float(fit[0]),
                "p_value": float(fit[1])
            }
            for i, fit in enumerate(r_results.rx2('item_fit'))
        }
    )

def fit_2pl_model(data: pd.DataFrame) -> IRTModelFit:
    """
    Fit 2PL model using R's ltm package.
    """
    pandas2ri.activate()
    r_dataframe = pandas2ri.py2rpy(data)
    
    robjects.r('''
        library(ltm)
        fit_2pl <- function(data) {
            model <- ltm(data ~ z1)
            list(
                coef=coef(model),
                aic=AIC(model),
                bic=BIC(model),
                item_fit=itemfit(model)
            )
        }
    ''')
    
    r_results = robjects.r['fit_2pl'](r_dataframe)
    
    # Extract discrimination and difficulty parameters
    coef_matrix = np.array(r_results.rx2('coef'))
    item_parameters = {
        f"item_{i+1}": [float(coef_matrix[i,0]), float(coef_matrix[i,1])]  # [discrimination, difficulty]
        for i in range(coef_matrix.shape[0])
    }
    
    return IRTModelFit(
        model_type=ModelType.TWO_PL,
        item_parameters=item_parameters,
        model_fit_statistics={
            "aic": float(r_results.rx2('aic')[0]),
            "bic": float(r_results.rx2('bic')[0])
        },
        item_fit_statistics={
            f"item_{i+1}": {
                "chi_square": float(fit[0]),
                "p_value": float(fit[1])
            }
            for i, fit in enumerate(r_results.rx2('item_fit'))
        }
    )

@router.post("/dimensionality", response_model=DimensionalityResult)
async def check_dimensionality(
    simulation_id: str,
    analysis_type: AnalysisType
):
    """
    Check unidimensionality of test items using EFA or NOHARM.
    """
    try:
        # Load response data for the simulation
        # Note: You'll need to implement data loading from your database
        data = pd.DataFrame()  # Replace with actual data loading
        
        if analysis_type == AnalysisType.EFA:
            return perform_efa_analysis(data)
        else:  # NOHARM
            return perform_noharm_analysis(data)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/irt-fit", response_model=IRTModelFit)
async def fit_irt_model(
    simulation_id: str,
    model_type: ModelType
):
    """
    Fit IRT model and analyze item characteristics.
    """
    try:
        # Load response data for the simulation
        # Note: You'll need to implement data loading from your database
        data = pd.DataFrame()  # Replace with actual data loading
        
        if model_type == ModelType.RASCH:
            return fit_rasch_model(data)
        elif model_type == ModelType.TWO_PL:
            return fit_2pl_model(data)
        else:  # THREE_PL
            # Implement 3PL model if needed
            raise NotImplementedError("3PL model not implemented yet")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-information/{simulation_id}", response_model=TestInformation)
async def get_test_information(simulation_id: str):
    """
    Get test information and item information curves.
    """
    try:
        # TODO: Implement test information calculation
        # This will be implemented in the next step
        raise NotImplementedError("Test information calculation not implemented yet")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/refine-items")
async def refine_problematic_items(
    simulation_id: str,
    problematic_items: List[str]
):
    """
    Refine or suggest removal of problematic items.
    """
    try:
        # TODO: Implement item refinement logic
        # This will be implemented in the next step
        raise NotImplementedError("Item refinement not implemented yet")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 