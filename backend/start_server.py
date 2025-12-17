#!/usr/bin/env python3
"""
SE Insight Backend Startup Script
"""

import subprocess
import sys
import os

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        print("✓ FastAPI and Uvicorn are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependencies: {e}")
        print("Please install dependencies with: pip install -r requirements.txt")
        return False

def start_server():
    """Start the FastAPI server"""
    if not check_dependencies():
        return False
    
    print("Starting SE Insight Backend Server...")
    print("Server will be available at: http://localhost:8000")
    print("WebSocket endpoint: ws://localhost:8000/ws/audio")
    print("Press Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        # Start the server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--host", "localhost", 
            "--port", "8000", 
            "--reload",
            "--log-level", "info"
        ], cwd=os.path.dirname(__file__))
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Error starting server: {e}")
        return False
    
    return True

if __name__ == "__main__":
    start_server()