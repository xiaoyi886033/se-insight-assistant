#!/usr/bin/env python3
"""
SE Insight Backend - Vercel适配版本
"""

import os
import sys
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 添加backend目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="SE Insight Backend API",
    description="Real-time SE terminology analysis backend",
    version="2.0.0-vercel"
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
        "message": "SE Insight Backend API - Vercel Version",
        "version": "2.0.0-vercel",
        "status": "running"
    }

@app.get("/api")
async def api_root():
    """API根端点"""
    return {
        "message": "SE Insight Backend API",
        "version": "2.0.0-vercel",
        "status": "running",
        "platform": "vercel"
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": "vercel",
        "message": "Vercel deployment successful"
    }

@app.get("/se-terms")
async def get_se_terms():
    """获取SE术语（简化版）"""
    return {
        "total_terms": 5,
        "terms": {
            "api": "Application Programming Interface",
            "microservices": "Architectural style with loosely coupled services",
            "database": "Organized collection of structured information",
            "algorithm": "Process for solving computational problems",
            "object oriented": "Programming paradigm based on objects"
        },
        "categories": ["architecture", "programming", "data"]
    }

# Vercel需要这个变量
handler = app