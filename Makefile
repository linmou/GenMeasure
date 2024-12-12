.PHONY: install install-dev format lint test run clean build-frontend

# Python/Poetry commands
install:
	poetry install

install-dev:
	poetry install --with dev

format:
	poetry run black .
	poetry run isort .

lint:
	poetry run flake8 .
	poetry run mypy .

test:
	poetry run pytest

# Frontend commands
install-frontend:
	cd frontend && npm install

build-frontend:
	cd frontend && npm run build

dev-frontend:
	cd frontend && npm start

# Backend commands
run-backend:
	poetry run uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Combined commands
run: run-backend

dev:
	make -j2 run-backend dev-frontend

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name "*.egg" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name "node_modules" -exec rm -rf {} +
	find . -type d -name "build" -exec rm -rf {} +
	find . -type d -name "dist" -exec rm -rf {} +

setup: install install-dev install-frontend
	@echo "Project setup complete!"

# Help command
help:
	@echo "Available commands:"
	@echo "  make install         - Install Python dependencies"
	@echo "  make install-dev     - Install Python development dependencies"
	@echo "  make format         - Format Python code"
	@echo "  make lint           - Run linters"
	@echo "  make test           - Run tests"
	@echo "  make install-frontend - Install frontend dependencies"
	@echo "  make build-frontend  - Build frontend for production"
	@echo "  make dev-frontend    - Start frontend development server"
	@echo "  make run-backend     - Start backend development server"
	@echo "  make run            - Run the application"
	@echo "  make dev            - Run both frontend and backend in development mode"
	@echo "  make clean          - Clean up generated files"
	@echo "  make setup          - Complete project setup" 