from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load models, establish connections
    yield
    # Shutdown: Clean up resources

app = FastAPI(lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from routers import quiz, simulation, analysis

# Include routers
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])

@app.get("/")
async def root():
    return {"message": "Math Quiz Generation System API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 