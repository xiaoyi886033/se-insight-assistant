#!/usr/bin/env python3
"""
SE Insight Backend - Advanced FastAPI WebSocket Server for Real-time Audio Processing and ASR
"""

import asyncio
import json
import logging
import time
import io
import wave
import threading
from typing import Dict, List, Optional, Union
from dataclasses import dataclass, asdict
from contextlib import asynccontextmanager
import numpy as np

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ASR and ML imports (with fallbacks for development)
try:
    import speech_recognition as sr
    ASR_AVAILABLE = True
except ImportError:
    ASR_AVAILABLE = False
    logging.warning("speech_recognition not available - using mock ASR")

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logging.warning("whisper not available - using alternative ASR")

try:
    from keybert import KeyBERT
    KEYBERT_AVAILABLE = True
except ImportError:
    KEYBERT_AVAILABLE = False
    logging.warning("KeyBERT not available - using simple keyword extraction")

# Configure enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global ASR and ML models
asr_engine = None
keybert_model = None
whisper_model = None

# Import configuration
from config import DEFAULT_CONFIG, AudioConfig

@dataclass
class TranscriptionResult:
    text: str
    confidence: float
    keywords: List[str]
    explanations: Dict[str, str]
    timestamp: float
    processing_time: float

# Initialize models on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing SE Insight Backend...")
    await initialize_models()
    yield
    # Shutdown
    logger.info("Shutting down SE Insight Backend...")
    await cleanup_models()

app = FastAPI(
    title="SE Insight Backend",
    description="Advanced real-time audio processing and SE terminology analysis with ASR integration",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize models
async def initialize_models():
    """Initialize ASR and ML models"""
    global asr_engine, keybert_model, whisper_model
    
    logger.info("Loading ASR and ML models...")
    
    # Initialize speech recognition
    if ASR_AVAILABLE:
        asr_engine = sr.Recognizer()
        # Optimize for real-time processing
        asr_engine.energy_threshold = 300
        asr_engine.dynamic_energy_threshold = True
        asr_engine.pause_threshold = 0.8
        asr_engine.phrase_threshold = 0.3
        logger.info("Speech Recognition engine initialized")
    
    # Initialize Whisper (if available)
    if WHISPER_AVAILABLE:
        try:
            whisper_model = whisper.load_model("base")  # Use base model for speed
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load Whisper model: {e}")
            whisper_model = None
    
    # Initialize KeyBERT (non-blocking)
    if KEYBERT_AVAILABLE:
        try:
            # Initialize KeyBERT in background to avoid blocking startup
            import threading
            def init_keybert():
                global keybert_model
                try:
                    keybert_model = KeyBERT()
                    logger.info("KeyBERT model initialized successfully")
                except Exception as e:
                    logger.warning(f"Failed to initialize KeyBERT: {e}")
                    keybert_model = None
            
            threading.Thread(target=init_keybert, daemon=True).start()
            logger.info("KeyBERT initialization started in background")
        except Exception as e:
            logger.warning(f"Failed to start KeyBERT initialization: {e}")
            keybert_model = None
    
    logger.info("Model initialization complete")

async def cleanup_models():
    """Cleanup models on shutdown"""
    global asr_engine, keybert_model, whisper_model
    
    # Cleanup would go here if needed
    logger.info("Models cleaned up")

# Audio processing utilities
class AudioProcessor:
    def __init__(self, config: AudioConfig):
        self.config = config
        self.audio_buffer = []
        self.buffer_lock = threading.Lock()
    
    def add_audio_data(self, audio_data: bytes) -> bool:
        """Add audio data to buffer"""
        try:
            # Convert bytes to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.int16)
            
            with self.buffer_lock:
                self.audio_buffer.extend(audio_array)
                
                # Check if we have enough data for processing
                required_samples = int(self.config.sample_rate * self.config.buffer_duration)
                return len(self.audio_buffer) >= required_samples
                
        except Exception as e:
            logger.error(f"Error adding audio data: {e}")
            return False
    
    def get_audio_chunk(self) -> Optional[np.ndarray]:
        """Get audio chunk for processing"""
        try:
            with self.buffer_lock:
                if len(self.audio_buffer) == 0:
                    return None
                
                # Get chunk of audio data
                chunk_samples = int(self.config.sample_rate * self.config.buffer_duration)
                chunk = np.array(self.audio_buffer[:chunk_samples], dtype=np.int16)
                
                # Remove processed data from buffer (keep some overlap)
                overlap_samples = chunk_samples // 4
                self.audio_buffer = self.audio_buffer[chunk_samples - overlap_samples:]
                
                return chunk
                
        except Exception as e:
            logger.error(f"Error getting audio chunk: {e}")
            return None
    
    def audio_to_wav_bytes(self, audio_data: np.ndarray) -> bytes:
        """Convert audio array to WAV bytes"""
        try:
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wav_file:
                wav_file.setnchannels(self.config.channels)
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(self.config.sample_rate)
                wav_file.writeframes(audio_data.tobytes())
            
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error converting audio to WAV: {e}")
            return b""

# ASR Processing
class ASRProcessor:
    def __init__(self):
        self.processing_stats = {
            "total_requests": 0,
            "successful_transcriptions": 0,
            "failed_transcriptions": 0,
            "avg_processing_time": 0.0
        }
    
    async def transcribe_audio(self, audio_data: np.ndarray, config: AudioConfig) -> Optional[TranscriptionResult]:
        """Transcribe audio using available ASR engines"""
        start_time = time.time()
        self.processing_stats["total_requests"] += 1
        
        try:
            # Try Whisper first (if available)
            if whisper_model is not None:
                result = await self._transcribe_with_whisper(audio_data, config)
                if result:
                    self.processing_stats["successful_transcriptions"] += 1
                    result.processing_time = time.time() - start_time
                    self._update_avg_processing_time(result.processing_time)
                    return result
            
            # Fallback to speech_recognition
            if asr_engine is not None:
                result = await self._transcribe_with_sr(audio_data, config)
                if result:
                    self.processing_stats["successful_transcriptions"] += 1
                    result.processing_time = time.time() - start_time
                    self._update_avg_processing_time(result.processing_time)
                    return result
            
            # Final fallback to mock transcription
            result = await self._mock_transcription()
            if result:
                result.processing_time = time.time() - start_time
                return result
            
        except Exception as e:
            logger.error(f"ASR processing error: {e}")
            self.processing_stats["failed_transcriptions"] += 1
        
        return None
    
    async def _transcribe_with_whisper(self, audio_data: np.ndarray, config: AudioConfig) -> Optional[TranscriptionResult]:
        """Transcribe using Whisper"""
        try:
            # Convert to float32 and normalize
            audio_float = audio_data.astype(np.float32) / 32768.0
            
            # Run Whisper transcription in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                lambda: whisper_model.transcribe(audio_float, language="en")
            )
            
            text = result["text"].strip()
            if not text:
                return None
            
            # Extract SE terminology
            keywords = await self._extract_keywords(text)
            explanations = self._generate_explanations(keywords)
            
            return TranscriptionResult(
                text=text,
                confidence=0.9,  # Whisper doesn't provide confidence scores
                keywords=keywords,
                explanations=explanations,
                timestamp=time.time(),
                processing_time=0.0  # Will be set by caller
            )
            
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return None
    
    async def _transcribe_with_sr(self, audio_data: np.ndarray, config: AudioConfig) -> Optional[TranscriptionResult]:
        """Transcribe using speech_recognition library"""
        try:
            # Convert to WAV format
            processor = AudioProcessor(config)
            wav_data = processor.audio_to_wav_bytes(audio_data)
            
            # Create AudioData object
            audio_source = sr.AudioData(wav_data, config.sample_rate, 2)
            
            # Run transcription in thread pool
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(
                None,
                lambda: asr_engine.recognize_google(audio_source, language="en-US")
            )
            
            if not text:
                return None
            
            # Extract SE terminology
            keywords = await self._extract_keywords(text)
            explanations = self._generate_explanations(keywords)
            
            return TranscriptionResult(
                text=text,
                confidence=0.8,  # Google Speech API doesn't provide confidence
                keywords=keywords,
                explanations=explanations,
                timestamp=time.time(),
                processing_time=0.0
            )
            
        except sr.UnknownValueError:
            logger.debug("Speech recognition could not understand audio")
            return None
        except sr.RequestError as e:
            logger.error(f"Speech recognition service error: {e}")
            return None
        except Exception as e:
            logger.error(f"Speech recognition error: {e}")
            return None
    
    async def _mock_transcription(self) -> Optional[TranscriptionResult]:
        """Fallback mock transcription"""
        mock_responses = [
            "Software architecture defines the fundamental structures of a system.",
            "We need to implement a REST API for our microservices architecture.",
            "The database design pattern should follow normalization principles.",
            "Object oriented programming uses classes and inheritance mechanisms.",
            "Functional programming emphasizes immutable data structures and pure functions.",
            "Algorithm complexity analysis helps optimize system performance.",
            "Design patterns provide reusable solutions to common programming problems."
        ]
        
        text = mock_responses[int(time.time()) % len(mock_responses)]
        keywords = await self._extract_keywords(text)
        explanations = self._generate_explanations(keywords)
        
        return TranscriptionResult(
            text=text,
            confidence=0.7,
            keywords=keywords,
            explanations=explanations,
            timestamp=time.time(),
            processing_time=0.0
        )
    
    async def _extract_keywords(self, text: str) -> List[str]:
        """Extract SE keywords from text"""
        try:
            if keybert_model is not None:
                # Use KeyBERT for advanced keyword extraction
                loop = asyncio.get_event_loop()
                keywords = await loop.run_in_executor(
                    None,
                    lambda: keybert_model.extract_keywords(
                        text, 
                        keyphrase_ngram_range=(1, 3),
                        stop_words='english',
                        top_n=10
                    )
                )
                return [kw[0] for kw in keywords if kw[1] > 0.3]  # Filter by confidence
            else:
                # Fallback to simple keyword matching
                return self._simple_keyword_extraction(text)
                
        except Exception as e:
            logger.error(f"Keyword extraction error: {e}")
            return self._simple_keyword_extraction(text)
    
    def _simple_keyword_extraction(self, text: str) -> List[str]:
        """Simple SE keyword extraction"""
        text_lower = text.lower()
        found_terms = []
        
        for term in SE_TERMS.keys():
            if term in text_lower:
                found_terms.append(term)
        
        return found_terms
    
    def _generate_explanations(self, keywords: List[str]) -> Dict[str, str]:
        """Generate explanations for keywords"""
        explanations = {}
        for keyword in keywords:
            if keyword.lower() in SE_TERMS:
                explanations[keyword] = SE_TERMS[keyword.lower()]
        return explanations
    
    def _update_avg_processing_time(self, processing_time: float):
        """Update average processing time"""
        total_successful = self.processing_stats["successful_transcriptions"]
        current_avg = self.processing_stats["avg_processing_time"]
        
        # Calculate new average
        new_avg = ((current_avg * (total_successful - 1)) + processing_time) / total_successful
        self.processing_stats["avg_processing_time"] = new_avg
    
    def get_stats(self) -> Dict:
        """Get processing statistics"""
        return self.processing_stats.copy()

# Global ASR processor
asr_processor = ASRProcessor()

# Enhanced connection management
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_info: Dict[str, dict] = {}
        self.audio_processors: Dict[str, AudioProcessor] = {}
        self.connection_stats = {
            "total_connections": 0,
            "current_connections": 0,
            "total_audio_packets": 0,
            "total_transcriptions": 0
        }
    
    async def connect(self, websocket: WebSocket, client_id: str, tab_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.audio_processors[client_id] = AudioProcessor(AudioConfig())
        
        self.connection_info[client_id] = {
            "tab_id": tab_id,
            "connected_at": time.time(),
            "audio_packets_received": 0,
            "transcriptions_sent": 0,
            "last_activity": time.time(),
            "audio_format": None
        }
        
        self.connection_stats["total_connections"] += 1
        self.connection_stats["current_connections"] += 1
        
        logger.info(f"Client {client_id} connected (tab: {tab_id})")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        if client_id in self.audio_processors:
            del self.audio_processors[client_id]
        
        if client_id in self.connection_info:
            info = self.connection_info[client_id]
            duration = time.time() - info["connected_at"]
            logger.info(
                f"Client {client_id} disconnected. "
                f"Duration: {duration:.1f}s, "
                f"Packets: {info['audio_packets_received']}, "
                f"Transcriptions: {info['transcriptions_sent']}"
            )
            del self.connection_info[client_id]
        
        self.connection_stats["current_connections"] -= 1
    
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
                
                # Update stats
                if message.get("type") == "transcription":
                    self.connection_info[client_id]["transcriptions_sent"] += 1
                    self.connection_stats["total_transcriptions"] += 1
                    
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                self.disconnect(client_id)
    
    def update_audio_packet_count(self, client_id: str):
        """Update audio packet statistics"""
        if client_id in self.connection_info:
            self.connection_info[client_id]["audio_packets_received"] += 1
            self.connection_info[client_id]["last_activity"] = time.time()
            self.connection_stats["total_audio_packets"] += 1
    
    def get_audio_processor(self, client_id: str) -> Optional[AudioProcessor]:
        """Get audio processor for client"""
        return self.audio_processors.get(client_id)
    
    def get_connection_count(self) -> int:
        return len(self.active_connections)
    
    def get_connection_stats(self) -> Dict:
        """Get detailed connection statistics"""
        return {
            **self.connection_stats,
            "active_clients": list(self.connection_info.keys()),
            "asr_stats": asr_processor.get_stats()
        }
    
    async def cleanup_inactive_connections(self):
        """Clean up inactive connections"""
        current_time = time.time()
        inactive_clients = []
        
        for client_id, info in self.connection_info.items():
            if current_time - info["last_activity"] > 300:  # 5 minutes
                inactive_clients.append(client_id)
        
        for client_id in inactive_clients:
            logger.info(f"Cleaning up inactive client: {client_id}")
            self.disconnect(client_id)

manager = ConnectionManager()

# Enhanced RAG Engine for SE Terminology
class AdvancedRAGEngine:
    """Advanced Retrieval-Augmented Generation Engine for SE terminology"""
    
    def __init__(self):
        from config import DEFAULT_CONFIG
        self.config = DEFAULT_CONFIG["rag"]
        self.context_cache = {}
        self.term_relationships = {}
        self.usage_patterns = {}
        
    def build_term_relationships(self, terms_db: dict):
        """Build semantic relationships between terms"""
        relationships = {}
        
        # Define semantic relationships
        architecture_terms = ["software architecture", "microservices", "design pattern", "api", "rest"]
        programming_terms = ["object oriented", "functional programming", "algorithm", "data structure"]
        data_terms = ["database", "data structure", "algorithm"]
        
        for term in terms_db.keys():
            relationships[term] = {
                "related": [],
                "category": self._categorize_term(term),
                "complexity": self._assess_complexity(term),
                "prerequisites": self._get_prerequisites(term)
            }
            
            # Add related terms based on categories
            if term in architecture_terms:
                relationships[term]["related"] = [t for t in architecture_terms if t != term]
            elif term in programming_terms:
                relationships[term]["related"] = [t for t in programming_terms if t != term]
            elif term in data_terms:
                relationships[term]["related"] = [t for t in data_terms if t != term]
                
        return relationships
    
    def _categorize_term(self, term: str) -> str:
        """Categorize SE term by domain"""
        categories = {
            "architecture": ["software architecture", "microservices", "design pattern", "api", "rest"],
            "programming": ["object oriented", "functional programming", "algorithm"],
            "data": ["database", "data structure"],
            "web": ["api", "rest"]
        }
        
        for category, terms in categories.items():
            if term in terms:
                return category
        return "general"
    
    def _assess_complexity(self, term: str) -> str:
        """Assess learning complexity of term"""
        beginner_terms = ["api", "database", "algorithm"]
        intermediate_terms = ["object oriented", "design pattern", "rest"]
        advanced_terms = ["software architecture", "microservices", "functional programming"]
        
        if term in beginner_terms:
            return "beginner"
        elif term in intermediate_terms:
            return "intermediate"
        elif term in advanced_terms:
            return "advanced"
        return "intermediate"
    
    def _get_prerequisites(self, term: str) -> List[str]:
        """Get prerequisite terms for understanding"""
        prerequisites = {
            "microservices": ["software architecture", "api"],
            "design pattern": ["object oriented"],
            "functional programming": ["algorithm"],
            "rest": ["api"],
            "data structure": ["algorithm"]
        }
        return prerequisites.get(term, [])
    
    def generate_enhanced_explanation(self, term: str, context: str = "", user_level: str = "intermediate") -> dict:
        """Generate context-aware explanation with learning path"""
        base_explanation = SE_TERMS.get(term.lower(), f"No definition available for '{term}'")
        
        if term.lower() not in SE_TERMS:
            return {"explanation": base_explanation, "enhanced": False}
        
        # Get term metadata
        relationships = self.term_relationships.get(term, {})
        category = relationships.get("category", "general")
        complexity = relationships.get("complexity", "intermediate")
        prerequisites = relationships.get("prerequisites", [])
        related_terms = relationships.get("related", [])
        
        # Build enhanced explanation
        enhanced = {
            "term": term,
            "definition": base_explanation,
            "category": category,
            "complexity": complexity,
            "context_aware": True,
            "learning_path": {
                "prerequisites": prerequisites[:3],  # Top 3 prerequisites
                "related_concepts": related_terms[:3],  # Top 3 related
                "next_steps": self._get_next_steps(term, user_level)
            },
            "practical_example": self._get_practical_example(term, context),
            "common_misconceptions": self._get_misconceptions(term),
            "real_world_usage": self._get_usage_context(term)
        }
        
        return enhanced
    
    def _get_next_steps(self, term: str, user_level: str) -> List[str]:
        """Suggest next learning steps"""
        next_steps = {
            "api": ["rest", "microservices"],
            "object oriented": ["design pattern", "software architecture"],
            "algorithm": ["data structure", "functional programming"],
            "database": ["data structure", "software architecture"],
            "design pattern": ["software architecture", "microservices"]
        }
        return next_steps.get(term, [])
    
    def _get_practical_example(self, term: str, context: str) -> str:
        """Generate practical example based on context"""
        examples = {
            "api": "Like a restaurant menu - it shows what's available and how to order, but you don't see the kitchen.",
            "microservices": "Like a food delivery app: separate services for user accounts, restaurants, payments, and delivery tracking.",
            "object oriented": "Like a car blueprint: Car class with properties (color, model) and methods (start, stop, accelerate).",
            "database": "Like a digital filing cabinet with organized folders, labels, and quick search capabilities.",
            "algorithm": "Like a recipe: step-by-step instructions to solve a problem or complete a task.",
            "design pattern": "Like architectural blueprints: proven solutions for common building challenges.",
            "rest": "Like a standardized postal system: consistent rules for addressing, sending, and receiving messages.",
            "functional programming": "Like mathematical functions: given the same input, always produces the same output.",
            "software architecture": "Like city planning: organizing components, infrastructure, and connections for scalability.",
            "data structure": "Like organizing a library: different ways to arrange books for efficient finding and access."
        }
        return examples.get(term, f"A fundamental concept in software engineering related to {term}.")
    
    def _get_misconceptions(self, term: str) -> List[str]:
        """Common misconceptions about the term"""
        misconceptions = {
            "api": ["APIs are only for web development", "APIs are the same as databases"],
            "microservices": ["Microservices are always better than monoliths", "More services = better architecture"],
            "object oriented": ["OOP is the only good programming paradigm", "More classes = better design"],
            "database": ["All databases are the same", "Bigger databases are always slower"],
            "algorithm": ["Algorithms are only for competitive programming", "Complex algorithms are always better"]
        }
        return misconceptions.get(term, [])
    
    def _get_usage_context(self, term: str) -> str:
        """Real-world usage context"""
        contexts = {
            "api": "Used in web development, mobile apps, cloud services, and system integration.",
            "microservices": "Popular in large-scale applications like Netflix, Amazon, and Uber.",
            "object oriented": "Foundation of languages like Java, C#, Python, and modern software design.",
            "database": "Essential for any application storing data: websites, mobile apps, enterprise systems.",
            "algorithm": "Core of search engines, recommendation systems, and optimization problems."
        }
        return contexts.get(term, f"Widely used in modern software development and engineering practices.")

# Initialize RAG engine
rag_engine = AdvancedRAGEngine()

# Mock SE terminology database
SE_TERMS = {
    "software architecture": "The fundamental structures of a software system and the discipline of creating such structures and systems.",
    "design pattern": "A general, reusable solution to a commonly occurring problem within a given context in software design.",
    "microservices": "An architectural style that structures an application as a collection of loosely coupled services.",
    "api": "Application Programming Interface - a set of protocols and tools for building software applications.",
    "rest": "Representational State Transfer - an architectural style for designing networked applications.",
    "database": "An organized collection of structured information, or data, typically stored electronically.",
    "algorithm": "A process or set of rules to be followed in calculations or other problem-solving operations.",
    "data structure": "A data organization, management, and storage format that enables efficient access and modification.",
    "object oriented": "A programming paradigm based on the concept of objects, which contain data and code.",
    "functional programming": "A programming paradigm that treats computation as the evaluation of mathematical functions."
}

def extract_se_terms(text: str) -> List[str]:
    """Simple SE term extraction (mock implementation)"""
    text_lower = text.lower()
    found_terms = []
    
    for term in SE_TERMS.keys():
        if term in text_lower:
            found_terms.append(term)
    
    return found_terms

def generate_explanations(terms: List[str], context: str = "", enhanced: bool = True) -> Dict[str, Union[str, dict]]:
    """Generate enhanced explanations for identified terms using RAG engine"""
    explanations = {}
    
    for term in terms:
        if term.lower() in SE_TERMS:
            if enhanced:
                # Use RAG engine for enhanced explanations
                explanations[term] = rag_engine.generate_enhanced_explanation(term, context)
            else:
                # Simple explanation
                explanations[term] = SE_TERMS[term.lower()]
    
    return explanations

# Mock transcription function
async def mock_transcription(audio_data: bytes, client_id: str) -> Optional[dict]:
    """Mock transcription for development/testing"""
    
    # Update packet count
    if client_id in manager.connection_info:
        manager.connection_info[client_id]["audio_packets_received"] += 1
    
    # Mock transcription responses (rotate through different examples)
    packet_count = manager.connection_info.get(client_id, {}).get("audio_packets_received", 0)
    
    mock_responses = [
        "Software architecture is the fundamental design of a system.",
        "We need to implement a REST API for our microservices.",
        "The database design pattern should follow normalization rules.",
        "Object oriented programming uses classes and inheritance.",
        "Functional programming emphasizes immutable data structures.",
        "Algorithm complexity analysis helps optimize performance.",
        "Design patterns provide reusable solutions to common problems."
    ]
    
    # Send a mock response every few packets
    if packet_count % 50 == 0 and packet_count > 0:  # Every ~2 seconds at 4096 samples/packet
        text = mock_responses[packet_count // 50 % len(mock_responses)]
        terms = extract_se_terms(text)
        explanations = generate_explanations(terms, context=text, enhanced=True)
        
        return {
            "type": "transcription",
            "text": text,
            "keywords": terms,
            "explanations": explanations,
            "confidence": 0.85,
            "timestamp": time.time()
        }
    
    return None

@app.websocket("/ws/audio")
async def websocket_endpoint(websocket: WebSocket):
    client_id = f"client_{int(time.time() * 1000)}"
    tab_id = None
    
    try:
        await manager.connect(websocket, client_id)
        logger.info(f"Enhanced WebSocket connection established: {client_id}")
        
        # Send welcome message with capabilities
        await manager.send_personal_message({
            "type": "connection",
            "status": "connected",
            "client_id": client_id,
            "message": "SE Insight backend connected successfully",
            "capabilities": {
                "asr_engines": {
                    "whisper": WHISPER_AVAILABLE,
                    "speech_recognition": ASR_AVAILABLE,
                    "keybert": KEYBERT_AVAILABLE
                },
                "audio_config": asdict(AudioConfig())
            }
        }, client_id)
        
        while True:
            try:
                data = await websocket.receive()
                
                if "text" in data:
                    # Handle control messages
                    should_continue = await handle_control_message(data["text"], client_id, manager)
                    if not should_continue:
                        break
                    
                elif "bytes" in data:
                    # Handle binary audio data with enhanced processing
                    await handle_audio_data(data["bytes"], client_id, manager)
                
            except Exception as e:
                logger.error(f"Error processing data from {client_id}: {e}")
                await manager.send_personal_message({
                    "type": "error",
                    "error": f"Processing error: {str(e)}",
                    "timestamp": time.time()
                }, client_id)
                
    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
    finally:
        manager.disconnect(client_id)

async def handle_control_message(message_text: str, client_id: str, manager: ConnectionManager):
    """Handle control messages from client"""
    try:
        message = json.loads(message_text)
        message_type = message.get("type", "unknown")
        
        logger.debug(f"Control message from {client_id}: {message_type}")
        
        if message_type == "connection":
            # Update connection info
            tab_id = message.get("tabId")
            audio_format = message.get("audioFormat", {})
            
            if client_id in manager.connection_info:
                manager.connection_info[client_id]["tab_id"] = tab_id
                manager.connection_info[client_id]["audio_format"] = audio_format
            
            await manager.send_personal_message({
                "type": "connection",
                "status": "acknowledged",
                "tab_id": tab_id,
                "server_time": time.time()
            }, client_id)
            
        elif message_type == "disconnect":
            logger.info(f"Client {client_id} requested disconnect")
            await manager.send_personal_message({
                "type": "disconnect",
                "status": "acknowledged",
                "timestamp": time.time()
            }, client_id)
            return False  # Signal to break the loop
            
        elif message_type == "ping":
            # Health check
            await manager.send_personal_message({
                "type": "pong",
                "timestamp": time.time()
            }, client_id)
            
        elif message_type == "get_stats":
            # Send processing statistics
            await manager.send_personal_message({
                "type": "stats",
                "connection_stats": manager.get_connection_stats(),
                "timestamp": time.time()
            }, client_id)
            
        else:
            logger.warning(f"Unknown control message type: {message_type}")
            
    except json.JSONDecodeError:
        logger.warning(f"Invalid JSON from {client_id}: {message_text}")
    except Exception as e:
        logger.error(f"Error handling control message: {e}")
    
    return True

async def handle_audio_data(audio_data: bytes, client_id: str, manager: ConnectionManager):
    """Handle binary audio data with real ASR processing"""
    try:
        # Update packet statistics
        manager.update_audio_packet_count(client_id)
        
        # Get audio processor for this client
        processor = manager.get_audio_processor(client_id)
        if not processor:
            logger.error(f"No audio processor found for client {client_id}")
            return
        
        # Add audio data to buffer
        ready_for_processing = processor.add_audio_data(audio_data)
        
        if ready_for_processing:
            # Get audio chunk for processing
            audio_chunk = processor.get_audio_chunk()
            if audio_chunk is not None:
                # Process with ASR
                result = await asr_processor.transcribe_audio(audio_chunk, AudioConfig())
                
                if result:
                    # Send transcription result
                    await manager.send_personal_message({
                        "type": "transcription",
                        "text": result.text,
                        "keywords": result.keywords,
                        "explanations": result.explanations,
                        "confidence": result.confidence,
                        "timestamp": result.timestamp,
                        "processing_time": result.processing_time
                    }, client_id)
                    
                    logger.info(f"Transcription sent to {client_id}: {result.text[:50]}... (confidence: {result.confidence:.2f})")
        
    except Exception as e:
        logger.error(f"Error handling audio data from {client_id}: {e}")
        await manager.send_personal_message({
            "type": "error",
            "error": f"Audio processing error: {str(e)}",
            "timestamp": time.time()
        }, client_id)

@app.get("/")
async def root():
    return {
        "message": "SE Insight Backend API",
        "version": "2.0.0",
        "description": "Advanced real-time audio processing and SE terminology analysis",
        "active_connections": manager.get_connection_count(),
        "capabilities": {
            "asr_engines": {
                "whisper": WHISPER_AVAILABLE,
                "speech_recognition": ASR_AVAILABLE,
                "keybert": KEYBERT_AVAILABLE
            },
            "audio_config": asdict(AudioConfig())
        },
        "endpoints": {
            "websocket": "/ws/audio",
            "health": "/health",
            "stats": "/stats",
            "se_terms": "/se-terms"
        }
    }

@app.get("/health")
async def health_check():
    """Enhanced health check with detailed status"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "uptime": time.time() - app.state.start_time if hasattr(app.state, 'start_time') else 0,
        "connections": {
            "active": manager.get_connection_count(),
            "total": manager.connection_stats["total_connections"]
        },
        "models": {
            "whisper": "loaded" if whisper_model else "not available",
            "speech_recognition": "available" if ASR_AVAILABLE else "not available",
            "keybert": "loaded" if keybert_model else "not available"
        },
        "processing": asr_processor.get_stats()
    }

@app.get("/stats")
async def get_stats():
    """Get detailed system statistics"""
    return {
        "timestamp": time.time(),
        "connections": manager.get_connection_stats(),
        "asr_processing": asr_processor.get_stats(),
        "system": {
            "whisper_available": WHISPER_AVAILABLE,
            "speech_recognition_available": ASR_AVAILABLE,
            "keybert_available": KEYBERT_AVAILABLE
        }
    }

@app.get("/se-terms")
async def get_se_terms():
    """Get available SE terminology database"""
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

@app.get("/se-terms/{term}/enhanced")
async def get_enhanced_explanation(term: str, context: str = "", user_level: str = "intermediate"):
    """Get enhanced RAG-powered explanation for a specific term"""
    if term.lower() not in SE_TERMS:
        raise HTTPException(status_code=404, detail="Term not found")
    
    enhanced_explanation = rag_engine.generate_enhanced_explanation(term, context, user_level)
    
    return {
        "term": term,
        "enhanced_explanation": enhanced_explanation,
        "rag_powered": True,
        "timestamp": time.time()
    }

@app.post("/se-terms")
async def add_se_term(term: str, definition: str):
    """Add new SE term to database"""
    if not term or not definition:
        raise HTTPException(status_code=400, detail="Term and definition are required")
    
    SE_TERMS[term.lower()] = definition
    logger.info(f"Added new SE term: {term}")
    
    return {
        "message": "Term added successfully",
        "term": term,
        "definition": definition,
        "total_terms": len(SE_TERMS)
    }

@app.delete("/se-terms/{term}")
async def delete_se_term(term: str):
    """Delete SE term from database"""
    term_lower = term.lower()
    if term_lower not in SE_TERMS:
        raise HTTPException(status_code=404, detail="Term not found")
    
    del SE_TERMS[term_lower]
    logger.info(f"Deleted SE term: {term}")
    
    return {
        "message": "Term deleted successfully",
        "term": term,
        "total_terms": len(SE_TERMS)
    }

# Background task for cleanup
async def periodic_cleanup():
    """Periodic cleanup of inactive connections"""
    while True:
        try:
            await manager.cleanup_inactive_connections()
            await asyncio.sleep(60)  # Run every minute
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {e}")
            await asyncio.sleep(60)

# Start background tasks
@app.on_event("startup")
async def startup_event():
    app.state.start_time = time.time()
    
    # Initialize RAG engine with term relationships
    rag_engine.term_relationships = rag_engine.build_term_relationships(SE_TERMS)
    logger.info("RAG engine initialized with term relationships")
    
    # Start cleanup task
    asyncio.create_task(periodic_cleanup())
    logger.info("SE Insight Backend started successfully with enhanced RAG engine")

if __name__ == "__main__":
    import os
    from config import DEFAULT_CONFIG
    
    server_config = DEFAULT_CONFIG["server"]
    
    # Use environment variables for production deployment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    logger.info("Starting SE Insight Backend Server...")
    logger.info(f"Server: {host}:{port}")
    logger.info(f"ASR Engine: {DEFAULT_CONFIG['asr'].preferred_engine}")
    logger.info(f"Whisper Available: {WHISPER_AVAILABLE}")
    logger.info(f"KeyBERT Available: {KEYBERT_AVAILABLE}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        log_level="info",
        reload=False,  # Disable reload in production
        workers=1
    )