#!/usr/bin/env python3
"""
SE Insight Backend - Configuration Settings
"""

import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class ServerConfig:
    """Server configuration settings"""
    host: str = "localhost"
    port: int = 8000
    reload: bool = True
    log_level: str = "info"
    workers: int = 1

@dataclass
class AudioConfig:
    """Audio processing configuration"""
    sample_rate: int = 16000
    channels: int = 1
    bit_depth: int = 16
    chunk_size: int = 4096
    buffer_duration: float = 2.0  # seconds
    max_buffer_size: int = 160000  # samples (10 seconds at 16kHz)

@dataclass
class ASRConfig:
    """ASR engine configuration"""
    preferred_engine: str = "whisper"  # whisper, speech_recognition, mock
    whisper_model: str = "base"  # tiny, base, small, medium, large
    language: str = "en"
    confidence_threshold: float = 0.5
    max_processing_time: float = 5.0  # seconds

@dataclass
class KeywordConfig:
    """Keyword extraction configuration"""
    use_keybert: bool = True
    max_keywords: int = 10
    min_confidence: float = 0.3
    ngram_range: tuple = (1, 3)
    stop_words: str = "english"

@dataclass
class ConnectionConfig:
    """WebSocket connection configuration"""
    max_connections: int = 100
    connection_timeout: int = 300  # seconds
    heartbeat_interval: int = 30  # seconds
    max_message_size: int = 1024 * 1024  # 1MB

@dataclass
class RAGConfig:
    """RAG (Retrieval-Augmented Generation) configuration"""
    enable_context_search: bool = True
    max_context_length: int = 2000  # characters
    similarity_threshold: float = 0.7
    max_related_terms: int = 5
    explanation_max_length: int = 300  # characters
    use_semantic_search: bool = True
    context_window_size: int = 3  # sentences before/after
    enable_cross_references: bool = True

# Environment-based configuration
def get_config():
    """Get configuration from environment variables"""
    return {
        "server": ServerConfig(
            host=os.getenv("SE_INSIGHT_HOST", "localhost"),
            port=int(os.getenv("SE_INSIGHT_PORT", "8000")),
            reload=os.getenv("SE_INSIGHT_RELOAD", "true").lower() == "true",
            log_level=os.getenv("SE_INSIGHT_LOG_LEVEL", "info"),
            workers=int(os.getenv("SE_INSIGHT_WORKERS", "1"))
        ),
        "audio": AudioConfig(
            sample_rate=int(os.getenv("SE_INSIGHT_SAMPLE_RATE", "16000")),
            channels=int(os.getenv("SE_INSIGHT_CHANNELS", "1")),
            buffer_duration=float(os.getenv("SE_INSIGHT_BUFFER_DURATION", "2.0"))
        ),
        "asr": ASRConfig(
            preferred_engine=os.getenv("SE_INSIGHT_ASR_ENGINE", "whisper"),
            whisper_model=os.getenv("SE_INSIGHT_WHISPER_MODEL", "base"),
            language=os.getenv("SE_INSIGHT_LANGUAGE", "en"),
            confidence_threshold=float(os.getenv("SE_INSIGHT_CONFIDENCE_THRESHOLD", "0.5"))
        ),
        "keywords": KeywordConfig(
            use_keybert=os.getenv("SE_INSIGHT_USE_KEYBERT", "true").lower() == "true",
            max_keywords=int(os.getenv("SE_INSIGHT_MAX_KEYWORDS", "10")),
            min_confidence=float(os.getenv("SE_INSIGHT_MIN_KEYWORD_CONFIDENCE", "0.3"))
        ),
        "connections": ConnectionConfig(
            max_connections=int(os.getenv("SE_INSIGHT_MAX_CONNECTIONS", "100")),
            connection_timeout=int(os.getenv("SE_INSIGHT_CONNECTION_TIMEOUT", "300"))
        ),
        "rag": RAGConfig(
            enable_context_search=os.getenv("SE_INSIGHT_ENABLE_CONTEXT", "true").lower() == "true",
            similarity_threshold=float(os.getenv("SE_INSIGHT_SIMILARITY_THRESHOLD", "0.7")),
            max_related_terms=int(os.getenv("SE_INSIGHT_MAX_RELATED_TERMS", "5")),
            explanation_max_length=int(os.getenv("SE_INSIGHT_EXPLANATION_MAX_LENGTH", "300"))
        )
    }

# Default configuration
DEFAULT_CONFIG = get_config()