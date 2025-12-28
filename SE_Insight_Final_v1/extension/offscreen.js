/**
 * SE Insight Railway Offscreen Audio Processor - Optimized Version
 * Memory-efficient 16kHz downsampling with YouTube performance optimization
 * 
 * Key optimizations:
 * 1. Efficient resampling algorithm to prevent browser lag
 * 2. Memory pooling for Int16 arrays
 * 3. Throttled WebSocket sending to prevent backpressure
 * 4. Proper cleanup to prevent memory leaks
 */

class RailwayAudioProcessor {
    constructor() {
        this.mediaRecorder = null;
        this.audioContext = null;
        this.websocket = null;
        this.isRecording = false;
        this.config = new SEInsightConfig();
        this.railwayUrl = 'http://localhost:8006'; // Will be updated by config
        
        // Audio configuration optimized for performance
        this.audioConfig = {
            sampleRate: 16000,    // Target 16kHz
            channels: 1,          // Mono
            bitDepth: 16,         // Int16
            chunkDuration: 100    // 100ms chunks
        };
        
        // Performance optimization variables
        this.resampleBuffer = null;
        this.resampleBufferIndex = 0;
        this.lastSampleTime = 0;
        this.int16Pool = [];  // Memory pool for Int16 arrays
        this.maxPoolSize = 10;
        this.sendQueue = [];
        this.isSending = false;
        
        // Resampling state for efficient downsampling
        this.resampleState = {
            inputSampleRate: 48000,  // YouTube typical sample rate
            outputSampleRate: 16000,
            ratio: 0,
            lastInputSample: 0,
            accumulator: 0,
            sampleCounter: 0
        };
        
        // Audio level monitoring
        this.currentAudioLevel = 0;
        this.audioLevelSamples = [];
        this.maxAudioLevelSamples = 10;
        
        this.setupMessageListener();
        this.updateStatus('🎵 SE Insight Railway Audio Processor initialized (Optimized)');
        console.log('🎵 SE Insight Railway Audio Processor initialized (Optimized)');
        console.log('📋 Audio Config:', this.audioConfig);
    }
    
    updateStatus(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('📨 Offscreen received message:', message);
            
            switch (message.type) {
                case 'START_AUDIO_CAPTURE':
                    // Update Railway URL from config or message
                    if (message.railwayUrl) {
                        this.railwayUrl = message.railwayUrl;
                        this.startAudioCapture(message.tabId)
                            .then(() => sendResponse({ success: true }))
                            .catch(error => sendResponse({ success: false, error: error.message }));
                    } else {
                        this.config.getBackendUrl().then(url => {
                            this.railwayUrl = url;
                            this.startAudioCapture(message.tabId)
                                .then(() => sendResponse({ success: true }))
                                .catch(error => sendResponse({ success: false, error: error.message }));
                        });
                    }
                    return true;
                    
                case 'STOP_AUDIO_CAPTURE':
                    this.stopAudioCapture();
                    sendResponse({ success: true });
                    break;
                    
                case 'GET_STATUS':
                    sendResponse({ 
                        isRecording: this.isRecording,
                        websocketConnected: this.websocket?.readyState === WebSocket.OPEN,
                        railwayUrl: this.railwayUrl,
                        audioConfig: this.audioConfig,
                        performance: {
                            poolSize: this.int16Pool.length,
                            queueSize: this.sendQueue.length,
                            resampleRatio: this.resampleState.ratio
                        }
                    });
                    break;
                    
                case 'GET_AUDIO_LEVEL':
                    sendResponse({
                        audioLevel: this.currentAudioLevel,
                        isRecording: this.isRecording
                    });
                    break;
            }
        });
    }
    
    async startAudioCapture(tabId) {
        try {
            console.log('🎬 Starting optimized SE Insight audio capture for tab:', tabId);
            this.updateStatus('🎬 Starting audio capture...');
            
            // Get tab audio stream
            const stream = await chrome.tabCapture.capture({
                audio: true,
                video: false
            });
            
            if (!stream) {
                throw new Error('Failed to capture tab audio - check permissions');
            }
            
            // Detect actual sample rate from the stream
            const audioTrack = stream.getAudioTracks()[0];
            const settings = audioTrack.getSettings();
            this.resampleState.inputSampleRate = settings.sampleRate || 48000;
            this.resampleState.ratio = this.resampleState.inputSampleRate / this.resampleState.outputSampleRate;
            
            console.log(`🔧 Detected input sample rate: ${this.resampleState.inputSampleRate}Hz`);
            console.log(`📊 Resampling ratio: ${this.resampleState.ratio.toFixed(2)}:1`);
            
            // Create AudioContext with detected sample rate (no forced resampling)
            this.audioContext = new AudioContext({
                sampleRate: this.resampleState.inputSampleRate
            });
            
            // Setup optimized audio pipeline
            await this.setupOptimizedAudioPipeline(stream);
            
            // Connect to Railway WebSocket
            await this.connectRailwayWebSocket();
            
            this.updateStatus('✅ Audio capture active - Processing audio...');
            console.log('✅ Optimized SE Insight audio capture started');
            
        } catch (error) {
            this.updateStatus(`❌ Failed to start audio capture: ${error.message}`);
            console.error('❌ Failed to start optimized audio capture:', error);
            throw error;
        }
    }
    
    async setupOptimizedAudioPipeline(stream) {
        console.log('🔊 Setting up optimized audio processing pipeline...');
        
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // Use smaller buffer size for lower latency, but not too small to avoid glitches
        // 2048 samples = ~43ms at 48kHz, good balance for YouTube
        const processor = this.audioContext.createScriptProcessor(2048, 1, 1);
        
        // Pre-allocate resampling buffer
        const outputBufferSize = Math.ceil(2048 / this.resampleState.ratio);
        this.resampleBuffer = new Float32Array(outputBufferSize);
        
        processor.onaudioprocess = (event) => {
            if (!this.isRecording) return;
            
            // Use requestIdleCallback for non-critical processing to prevent YouTube lag
            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => {
                    this.processAudioChunk(event);
                }, { timeout: 50 });
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => this.processAudioChunk(event), 0);
            }
        };
        
        // Connect audio nodes
        source.connect(processor);
        // Don't connect to destination to avoid audio feedback
        
        this.isRecording = true;
        console.log('✅ Optimized audio pipeline established');
        console.log(`📊 Buffer size: 2048 samples (~${(2048/this.resampleState.inputSampleRate*1000).toFixed(1)}ms)`);
    }
    
    processAudioChunk(event) {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Calculate audio level for monitoring
        this.calculateAudioLevel(inputData);
        
        // Efficient resampling using linear interpolation
        const resampledData = this.efficientResample(inputData);
        
        if (resampledData && resampledData.length > 0) {
            // Convert to Int16 using memory pool
            const int16Data = this.convertToInt16Pooled(resampledData);
            
            // Queue for sending to prevent WebSocket backpressure
            this.queueAudioChunk(int16Data);
        }
    }
    
    calculateAudioLevel(audioData) {
        // Calculate RMS (Root Mean Square) for audio level
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);
        
        // Add to rolling average
        this.audioLevelSamples.push(rms);
        if (this.audioLevelSamples.length > this.maxAudioLevelSamples) {
            this.audioLevelSamples.shift();
        }
        
        // Calculate average audio level
        const avgLevel = this.audioLevelSamples.reduce((a, b) => a + b, 0) / this.audioLevelSamples.length;
        
        // Normalize and smooth the audio level (0-1 range)
        this.currentAudioLevel = Math.min(1, avgLevel * 10); // Amplify for better visualization
    }
    
    efficientResample(inputData) {
        const inputLength = inputData.length;
        const outputLength = Math.floor(inputLength / this.resampleState.ratio);
        
        // Reuse buffer if possible
        if (!this.resampleBuffer || this.resampleBuffer.length < outputLength) {
            this.resampleBuffer = new Float32Array(outputLength);
        }
        
        let outputIndex = 0;
        const ratio = this.resampleState.ratio;
        
        // Linear interpolation resampling (efficient and good quality)
        for (let i = 0; i < outputLength && outputIndex < outputLength; i++) {
            const inputIndex = i * ratio;
            const inputIndexFloor = Math.floor(inputIndex);
            const inputIndexCeil = Math.min(inputIndexFloor + 1, inputLength - 1);
            const fraction = inputIndex - inputIndexFloor;
            
            // Linear interpolation
            const sample1 = inputData[inputIndexFloor] || 0;
            const sample2 = inputData[inputIndexCeil] || 0;
            this.resampleBuffer[outputIndex] = sample1 + (sample2 - sample1) * fraction;
            
            outputIndex++;
        }
        
        // Return a view of the used portion
        return this.resampleBuffer.subarray(0, outputIndex);
    }
    
    convertToInt16Pooled(float32Data) {
        // Get Int16Array from pool or create new one
        let int16Array = this.int16Pool.pop();
        if (!int16Array || int16Array.length < float32Data.length) {
            int16Array = new Int16Array(float32Data.length);
        }
        
        // Efficient conversion with SIMD-friendly loop
        const length = float32Data.length;
        for (let i = 0; i < length; i++) {
            // Clamp and convert in one operation
            const sample = Math.max(-1, Math.min(1, float32Data[i]));
            int16Array[i] = (sample * 0x7FFF) | 0; // Bitwise OR for faster integer conversion
        }
        
        return int16Array.subarray(0, length);
    }
    
    queueAudioChunk(int16Data) {
        // Add to send queue
        this.sendQueue.push(int16Data);
        
        // Limit queue size to prevent memory buildup
        if (this.sendQueue.length > 20) {
            const oldChunk = this.sendQueue.shift();
            this.returnToPool(oldChunk);
        }
        
        // Process queue if not already processing
        if (!this.isSending) {
            this.processSendQueue();
        }
    }
    
    async processSendQueue() {
        this.isSending = true;
        
        while (this.sendQueue.length > 0 && this.websocket?.readyState === WebSocket.OPEN) {
            const chunk = this.sendQueue.shift();
            
            try {
                // Send binary data
                const buffer = chunk.buffer.slice(
                    chunk.byteOffset,
                    chunk.byteOffset + chunk.byteLength
                );
                
                this.websocket.send(buffer);
                
                // Return to pool for reuse
                this.returnToPool(chunk);
                
                // Small delay to prevent overwhelming the WebSocket
                await new Promise(resolve => setTimeout(resolve, 1));
                
            } catch (error) {
                console.error('❌ Failed to send audio chunk:', error);
                this.returnToPool(chunk);
                break;
            }
        }
        
        this.isSending = false;
    }
    
    returnToPool(int16Array) {
        // Return Int16Array to pool for reuse
        if (this.int16Pool.length < this.maxPoolSize) {
            this.int16Pool.push(int16Array);
        }
    }
    
    async connectRailwayWebSocket() {
        return new Promise((resolve, reject) => {
            console.log('🚂 Connecting to SE Insight Railway WebSocket...');
            this.updateStatus('🚂 Connecting to Railway backend...');
            
            // Use config system to get proper WebSocket URL
            const wsUrl = this.config.getWebSocketUrl(this.railwayUrl);
            if (!wsUrl) {
                reject(new Error('Invalid Railway URL for WebSocket connection'));
                return;
            }
            
            console.log(`🔌 WebSocket URL: ${wsUrl}`);
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ SE Insight Railway WebSocket connected');
                this.updateStatus('✅ Connected to Railway backend');
                
                // Send optimized audio configuration
                this.websocket.send(JSON.stringify({
                    type: 'audio_config',
                    config: {
                        ...this.audioConfig,
                        inputSampleRate: this.resampleState.inputSampleRate,
                        resampleRatio: this.resampleState.ratio
                    },
                    client_info: {
                        extension: 'SE Insight Railway Optimized',
                        version: '1.0',
                        timestamp: Date.now()
                    }
                }));
                
                resolve();
            };
            
            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRailwayMessage(data);
                } catch (error) {
                    console.error('❌ Failed to parse Railway message:', error);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ SE Insight Railway WebSocket error:', error);
                this.updateStatus('❌ WebSocket connection error');
                reject(error);
            };
            
            this.websocket.onclose = (event) => {
                console.log('🚂 SE Insight Railway WebSocket disconnected');
                this.updateStatus('🔴 Disconnected from Railway backend');
                this.websocket = null;
            };
            
            setTimeout(() => {
                if (this.websocket?.readyState !== WebSocket.OPEN) {
                    this.updateStatus('⏰ Connection timeout - Check Railway URL');
                    reject(new Error('SE Insight Railway WebSocket connection timeout'));
                }
            }, 10000);
        });
    }
    
    handleRailwayMessage(data) {
        // Forward transcription results to content script with SE term definitions
        if (data.type === 'transcription_result') {
            chrome.runtime.sendMessage({
                type: 'TRANSCRIPTION_RESULT',
                data: {
                    ...data,
                    // Include SE term definitions for frontend display
                    se_definitions: data.se_definitions || {}
                }
            }).catch(error => {
                console.log('Content script not available:', error);
            });
        }
    }
    
    stopAudioCapture() {
        console.log('🛑 Stopping optimized SE Insight audio capture');
        this.updateStatus('🛑 Stopping audio capture...');
        
        this.isRecording = false;
        
        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clean up WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        // Clear queues and pools
        this.sendQueue.length = 0;
        this.int16Pool.length = 0;
        this.resampleBuffer = null;
        
        // Reset audio level monitoring
        this.currentAudioLevel = 0;
        this.audioLevelSamples.length = 0;
        
        // Reset resampling state
        this.resampleState.lastInputSample = 0;
        this.resampleState.accumulator = 0;
        this.resampleState.sampleCounter = 0;
        
        this.updateStatus('⏹️ Audio capture stopped');
        console.log('✅ Optimized audio capture stopped and cleaned up');
    }
}

// Initialize optimized SE Insight Railway Audio Processor
const railwayAudioProcessor = new RailwayAudioProcessor();