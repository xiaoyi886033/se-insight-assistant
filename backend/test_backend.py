#!/usr/bin/env python3
"""
SE Insight Backend - Test Script
"""

import asyncio
import json
import websockets
import numpy as np
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_websocket_connection():
    """Test WebSocket connection and basic functionality"""
    uri = "ws://localhost:8000/ws/audio"
    
    try:
        async with websockets.connect(uri) as websocket:
            logger.info("✓ Connected to SE Insight backend")
            
            # Send connection message
            connection_msg = {
                "type": "connection",
                "tabId": "test_tab_123",
                "audioFormat": {
                    "sampleRate": 16000,
                    "channels": 1,
                    "bitDepth": 16
                }
            }
            
            await websocket.send(json.dumps(connection_msg))
            logger.info("✓ Sent connection message")
            
            # Wait for acknowledgment
            response = await websocket.recv()
            data = json.loads(response)
            logger.info(f"✓ Received response: {data['type']}")
            
            # Send test audio data
            logger.info("Sending test audio data...")
            for i in range(5):
                # Generate test audio (sine wave)
                duration = 0.5  # seconds
                sample_rate = 16000
                frequency = 440  # Hz
                
                t = np.linspace(0, duration, int(sample_rate * duration))
                audio_data = (np.sin(2 * np.pi * frequency * t) * 32767).astype(np.int16)
                
                await websocket.send(audio_data.tobytes())
                logger.info(f"✓ Sent audio chunk {i+1}/5")
                
                # Wait for potential transcription
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                    data = json.loads(response)
                    if data.get("type") == "transcription":
                        logger.info(f"✓ Received transcription: {data['text']}")
                except asyncio.TimeoutError:
                    logger.info("No transcription received (expected for test audio)")
                
                await asyncio.sleep(0.5)
            
            # Send disconnect message
            disconnect_msg = {"type": "disconnect"}
            await websocket.send(json.dumps(disconnect_msg))
            logger.info("✓ Sent disconnect message")
            
    except Exception as e:
        logger.error(f"✗ WebSocket test failed: {e}")
        return False
    
    return True

async def test_http_endpoints():
    """Test HTTP endpoints"""
    import aiohttp
    
    base_url = "http://localhost:8000"
    
    try:
        async with aiohttp.ClientSession() as session:
            # Test root endpoint
            async with session.get(f"{base_url}/") as response:
                data = await response.json()
                logger.info(f"✓ Root endpoint: {data['message']}")
            
            # Test health endpoint
            async with session.get(f"{base_url}/health") as response:
                data = await response.json()
                logger.info(f"✓ Health check: {data['status']}")
            
            # Test stats endpoint
            async with session.get(f"{base_url}/stats") as response:
                data = await response.json()
                logger.info(f"✓ Stats endpoint: {len(data)} fields")
            
            # Test SE terms endpoint
            async with session.get(f"{base_url}/se-terms") as response:
                data = await response.json()
                logger.info(f"✓ SE terms: {data['total_terms']} terms available")
            
    except Exception as e:
        logger.error(f"✗ HTTP test failed: {e}")
        return False
    
    return True

async def main():
    """Run all tests"""
    logger.info("SE Insight Backend Test Suite")
    logger.info("=" * 40)
    
    # Test HTTP endpoints
    logger.info("Testing HTTP endpoints...")
    http_success = await test_http_endpoints()
    
    # Test WebSocket connection
    logger.info("\nTesting WebSocket connection...")
    ws_success = await test_websocket_connection()
    
    # Summary
    logger.info("\n" + "=" * 40)
    logger.info("Test Results:")
    logger.info(f"HTTP Endpoints: {'✓ PASS' if http_success else '✗ FAIL'}")
    logger.info(f"WebSocket: {'✓ PASS' if ws_success else '✗ FAIL'}")
    
    if http_success and ws_success:
        logger.info("🎉 All tests passed! Backend is working correctly.")
    else:
        logger.error("❌ Some tests failed. Check the backend configuration.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Test suite failed: {e}")