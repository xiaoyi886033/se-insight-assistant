#!/usr/bin/env python3
"""
SE Insight Backend - ASR Dependencies Installation Script
"""

import subprocess
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def install_package(package):
    """Install a package using pip"""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        logger.info(f"✓ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"✗ Failed to install {package}: {e}")
        return False

def check_package(package):
    """Check if a package is already installed"""
    try:
        __import__(package)
        logger.info(f"✓ {package} is already installed")
        return True
    except ImportError:
        return False

def main():
    """Install ASR dependencies with fallbacks"""
    logger.info("SE Insight Backend - Installing ASR Dependencies")
    logger.info("=" * 50)
    
    # Core dependencies (required)
    core_deps = [
        "numpy",
        "SpeechRecognition"
    ]
    
    # Optional ASR dependencies
    optional_deps = [
        ("openai-whisper", "Advanced Whisper ASR"),
        ("torch", "PyTorch for Whisper"),
        ("keybert", "SE terminology extraction"),
        ("sentence-transformers", "Sentence embeddings for KeyBERT")
    ]
    
    # Install core dependencies
    logger.info("Installing core dependencies...")
    for dep in core_deps:
        if not check_package(dep.replace("-", "_")):
            install_package(dep)
    
    # Install optional dependencies
    logger.info("\nInstalling optional ASR dependencies...")
    for dep, description in optional_deps:
        logger.info(f"\nInstalling {dep} ({description})...")
        if not check_package(dep.replace("-", "_")):
            success = install_package(dep)
            if not success:
                logger.warning(f"Failed to install {dep} - continuing without it")
    
    # Test installations
    logger.info("\n" + "=" * 50)
    logger.info("Testing installations...")
    
    # Test core functionality
    try:
        import numpy
        logger.info("✓ NumPy is working")
    except ImportError:
        logger.error("✗ NumPy failed to import")
    
    try:
        import speech_recognition
        logger.info("✓ SpeechRecognition is working")
    except ImportError:
        logger.error("✗ SpeechRecognition failed to import")
    
    # Test optional functionality
    try:
        import whisper
        logger.info("✓ Whisper is available for advanced ASR")
    except ImportError:
        logger.warning("⚠ Whisper not available - will use basic ASR")
    
    try:
        from keybert import KeyBERT
        logger.info("✓ KeyBERT is available for SE terminology extraction")
    except ImportError:
        logger.warning("⚠ KeyBERT not available - will use simple keyword matching")
    
    logger.info("\n" + "=" * 50)
    logger.info("Installation complete!")
    logger.info("You can now run the SE Insight backend with: python main.py")

if __name__ == "__main__":
    main()