#!/usr/bin/env python3
"""
SE Insight Backend - 最小化版本 (快速部署测试)
"""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="SE Insight Backend API",
    description="Real-time SE terminology analysis backend",
    version="2.0.0-minimal"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """根端点"""
    return {
        "message": "SE Insight Backend API - Minimal Version",
        "version": "2.0.0-minimal",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": "minimal",
        "message": "Basic deployment successful"
    }

if __name__ == "__main__":
    # 使用环境变量
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    logger.info("Starting SE Insight Backend - Minimal Version")
    logger.info(f"Server: {host}:{port}")
    
    uvicorn.run(
        "main-minimal:app",
        host=host,
        port=port,
        log_level="info",
        reload=False
    )