#!/usr/bin/env python3
"""
Simple test server to verify basic functionality
"""

from fastapi import FastAPI
import uvicorn

app = FastAPI(title="SE Insight Test Server")

@app.get("/")
async def root():
    return {"message": "SE Insight Test Server", "status": "working"}

@app.get("/health")
async def health():
    return {"status": "healthy", "test": True}

if __name__ == "__main__":
    print("Starting simple test server...")
    uvicorn.run(app, host="localhost", port=8001, log_level="info")