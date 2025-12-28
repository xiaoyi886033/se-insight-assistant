#!/usr/bin/env python3
"""
SE Insight Backend - Railway部署版本
"""

import os
import sys
import logging
import asyncio
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="SE Insight Backend API",
    description="Real-time SE terminology analysis backend",
    version="2.0.0-railway"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SE术语数据库
SE_TERMS = {
    "api": "Application Programming Interface - a set of protocols and tools for building software applications.",
    "microservices": "An architectural style that structures an application as a collection of loosely coupled services.",
    "database": "An organized collection of structured information, or data, typically stored electronically.",
    "algorithm": "A process or set of rules to be followed in calculations or other problem-solving operations.",
    "object oriented": "A programming paradigm based on the concept of objects, which contain data and code.",
    "design pattern": "A general, reusable solution to a commonly occurring problem within a given context in software design.",
    "rest": "Representational State Transfer - an architectural style for designing networked applications.",
    "software architecture": "The fundamental structures of a software system and the discipline of creating such structures.",
    "functional programming": "A programming paradigm that treats computation as the evaluation of mathematical functions.",
    "data structure": "A data organization, management, and storage format that enables efficient access and modification."
}

# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_info: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_info[client_id] = {
            "connected_at": asyncio.get_event_loop().time(),
            "audio_packets_received": 0
        }
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, client_id: str):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if client_id in self.connection_info:
            del self.connection_info[client_id]
        logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

@app.get("/")
async def root():
    """根端点"""
    return {
        "message": "SE Insight Backend API - Railway Version",
        "version": "2.0.0-railway",
        "status": "running",
        "active_connections": len(manager.active_connections)
    }

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "version": "railway",
        "message": "Railway deployment successful",
        "active_connections": len(manager.active_connections),
        "capabilities": {
            "websocket": True,
            "se_terms": True,
            "basic_asr": True
        }
    }

@app.get("/se-terms")
async def get_se_terms():
    """获取SE术语数据库"""
    return {
        "total_terms": len(SE_TERMS),
        "terms": SE_TERMS,
        "categories": {
            "architecture": ["software architecture", "microservices", "design pattern"],
            "programming": ["object oriented", "functional programming", "algorithm"],
            "data": ["database", "data structure"],
            "web": ["api", "rest"]
        }
    }

@app.get("/stats")
async def get_stats():
    """获取系统统计信息"""
    return {
        "total_connections": len(manager.connection_info),
        "current_connections": len(manager.active_connections),
        "se_terms_available": len(SE_TERMS),
        "system_status": "healthy"
    }

def extract_se_terms(text: str) -> List[str]:
    """简单的SE术语提取"""
    text_lower = text.lower()
    found_terms = []
    
    for term in SE_TERMS.keys():
        if term in text_lower:
            found_terms.append(term)
    
    return found_terms

def generate_explanations(terms: List[str]) -> Dict[str, str]:
    """生成术语解释"""
    explanations = {}
    for term in terms:
        if term.lower() in SE_TERMS:
            explanations[term] = SE_TERMS[term.lower()]
    return explanations

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket音频处理端点"""
    client_id = f"client_{len(manager.active_connections)}"
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            logger.info(f"Received from {client_id}: {data[:100]}...")
            
            # 处理连接消息
            if "connection" in data.lower():
                await manager.send_personal_message(
                    '{"type": "connection", "status": "connected", "message": "WebSocket connection established"}',
                    websocket
                )
                continue
            
            # 模拟音频处理
            if client_id in manager.connection_info:
                manager.connection_info[client_id]["audio_packets_received"] += 1
                packet_count = manager.connection_info[client_id]["audio_packets_received"]
                
                # 每10个包发送一次模拟转录
                if packet_count % 10 == 0:
                    mock_responses = [
                        "Software architecture is the fundamental design of a system.",
                        "We need to implement a REST API for our microservices.",
                        "The database design pattern should follow normalization rules.",
                        "Object oriented programming uses classes and inheritance.",
                        "Functional programming emphasizes immutable data structures."
                    ]
                    
                    text = mock_responses[packet_count // 10 % len(mock_responses)]
                    terms = extract_se_terms(text)
                    explanations = generate_explanations(terms)
                    
                    response = {
                        "type": "transcription",
                        "text": text,
                        "terms": terms,
                        "explanations": explanations,
                        "timestamp": asyncio.get_event_loop().time()
                    }
                    
                    await manager.send_personal_message(str(response).replace("'", '"'), websocket)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        manager.disconnect(websocket, client_id)

if __name__ == "__main__":
    # Railway环境配置
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info("🚀 Starting SE Insight Backend - Railway Version")
    logger.info(f"📡 Server: {host}:{port}")
    logger.info(f"🐍 Python Version: {os.sys.version}")
    logger.info(f"🌍 Environment: Railway")
    
    try:
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level="info",
            reload=False,
            access_log=True
        )
    except Exception as e:
        logger.error(f"❌ Failed to start server: {e}")
        raise