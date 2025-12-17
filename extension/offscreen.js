// extension/offscreen.js - Enhanced audio processing with robust error handling and reconnection

console.log('SE Insight Offscreen Document Loading...');

let ws = null;
let audioContext = null;
let mediaStream = null;
let audioProcessor = null;
let currentTabId = null;
let isCapturing = false;
let reconnectAttempts = 0;
let reconnectTimer = null;

const WS_URL = "ws://localhost:8000/ws/audio";
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000; // 1 second

// Enhanced Float32 to Int16 PCM conversion with validation and optimization
function convertFloat32ToInt16(buffer) {
    try {
        if (!buffer || buffer.length === 0) {
            console.warn('Empty audio buffer received');
            return null;
        }
        
        const length = buffer.length;
        const result = new Int16Array(length);
        
        // Track audio statistics for quality monitoring
        let maxAmplitude = 0;
        let rmsSum = 0;
        
        for (let i = 0; i < length; i++) {
            // Validate sample
            let sample = buffer[i];
            
            if (isNaN(sample) || !isFinite(sample)) {
                sample = 0; // Replace invalid samples with silence
            }
            
            // Clamp to valid range
            sample = Math.max(-1, Math.min(1, sample));
            
            // Convert to 16-bit PCM
            result[i] = Math.round(sample * 0x7FFF);
            
            // Track statistics
            const amplitude = Math.abs(sample);
            maxAmplitude = Math.max(maxAmplitude, amplitude);
            rmsSum += sample * sample;
        }
        
        // Calculate RMS for audio level monitoring
        const rms = Math.sqrt(rmsSum / length);
        
        // Log audio quality metrics periodically
        if (Math.random() < 0.01) { // 1% of the time
            console.log('Audio quality metrics:', {
                maxAmplitude: maxAmplitude.toFixed(3),
                rms: rms.toFixed(3),
                bufferSize: length,
                dynamicRange: (maxAmplitude > 0 ? (rms / maxAmplitude).toFixed(3) : 0)
            });
        }
        
        // Warn if audio level is too low
        if (maxAmplitude < 0.01 && Math.random() < 0.001) {
            console.warn('Low audio level detected - check microphone/tab audio');
        }
        
        return result.buffer;
        
    } catch (error) {
        console.error('Error converting audio format:', error);
        return null;
    }
}

// Validate audio stream quality and provide feedback
function validateAudioStream(stream) {
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in stream');
    }
    
    const track = audioTracks[0];
    const settings = track.getSettings();
    
    // Check if track is active
    if (!track.enabled || track.readyState !== 'live') {
        throw new Error('Audio track is not active');
    }
    
    // Validate audio settings
    const issues = [];
    
    if (settings.sampleRate && settings.sampleRate < 16000) {
        issues.push(`Low sample rate: ${settings.sampleRate}Hz (recommended: ≥16kHz)`);
    }
    
    if (settings.channelCount && settings.channelCount > 2) {
        issues.push(`High channel count: ${settings.channelCount} (recommended: 1-2)`);
    }
    
    if (issues.length > 0) {
        console.warn('Audio stream quality issues:', issues);
    }
    
    return {
        isValid: true,
        settings: settings,
        issues: issues
    };
}

// Calculate exponential backoff delay
function calculateReconnectDelay(attempt) {
    return Math.min(RECONNECT_BASE_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
}

// Send message to content script with error handling
async function sendToContentScript(tabId, message) {
    if (!tabId) return;
    
    try {
        await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
        console.warn('Failed to send message to content script:', error.message);
    }
}

// Enhanced WebSocket connection with buffering and performance monitoring
let audioBuffer = [];
let bufferFlushTimer = null;
let connectionStats = {
    packetssent: 0,
    bytesSent: 0,
    lastSendTime: 0,
    avgSendRate: 0
};

function createWebSocketConnection(tabId) {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket already connecting/connected');
        return;
    }
    
    console.log('Creating enhanced WebSocket connection...');
    ws = new WebSocket(WS_URL);
    
    // Set binary type for efficient audio data transmission
    ws.binaryType = 'arraybuffer';
    
    ws.onopen = () => {
        console.log('WebSocket connected successfully');
        reconnectAttempts = 0;
        
        // Reset connection stats
        connectionStats = {
            packetsent: 0,
            bytesSent: 0,
            lastSendTime: Date.now(),
            avgSendRate: 0
        };
        
        // Send initial connection message with audio format info
        ws.send(JSON.stringify({
            type: 'connection',
            tabId: tabId,
            timestamp: Date.now(),
            audioFormat: {
                sampleRate: 16000,
                channels: 1,
                bitDepth: 16,
                encoding: 'PCM'
            }
        }));
        
        // Start buffer flushing for efficient data transmission
        startBufferFlushing();
        
        // Notify content script of connection
        sendToContentScript(tabId, {
            type: 'UPDATE_CAPTION',
            text: 'Connected - processing audio...',
            status: 'connected'
        });
    };
    
    ws.onmessage = (event) => {
        try {
            // Handle both text and binary responses
            let data;
            if (typeof event.data === 'string') {
                data = JSON.parse(event.data);
            } else {
                console.warn('Received unexpected binary data from server');
                return;
            }
            
            console.log('Received from backend:', data.type);
            
            // Handle different message types
            switch (data.type) {
                case 'transcription':
                    if (data.text) {
                        sendToContentScript(tabId, {
                            type: 'UPDATE_CAPTION',
                            text: data.text,
                            keywords: data.keywords || [],
                            explanations: data.explanations || {},
                            confidence: data.confidence || 0,
                            status: 'transcribing'
                        });
                    }
                    break;
                    
                case 'connection':
                    console.log('Backend connection acknowledged:', data.status);
                    break;
                    
                case 'stats':
                    // Log backend processing statistics
                    console.log('Backend stats:', data);
                    break;
                    
                case 'error':
                    console.error('Backend error:', data.error);
                    sendToContentScript(tabId, {
                        type: 'UPDATE_CAPTION',
                        text: `Backend error: ${data.error}`,
                        status: 'error'
                    });
                    break;
                    
                default:
                    console.warn('Unknown message type from backend:', data.type);
            }
            
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        
        // Stop buffer flushing
        stopBufferFlushing();
        
        if (isCapturing && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = calculateReconnectDelay(reconnectAttempts);
            console.log(`Attempting reconnection ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            
            reconnectTimer = setTimeout(() => {
                reconnectAttempts++;
                createWebSocketConnection(tabId);
            }, delay);
            
            sendToContentScript(tabId, {
                type: 'UPDATE_CAPTION',
                text: `Connection lost. Reconnecting... (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`,
                status: 'reconnecting'
            });
        } else if (isCapturing) {
            console.error('Max reconnection attempts reached');
            sendToContentScript(tabId, {
                type: 'UPDATE_CAPTION',
                text: 'Connection failed. Please restart transcription.',
                status: 'failed'
            });
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        
        // For development/testing: show mock transcription if backend is unavailable
        if (reconnectAttempts === 0) {
            setTimeout(() => {
                sendToContentScript(tabId, {
                    type: 'UPDATE_CAPTION',
                    text: 'Backend unavailable - showing mock transcription for development',
                    keywords: ['Backend', 'Development'],
                    status: 'mock'
                });
            }, 2000);
        }
    };
}

// Efficient audio data buffering and transmission
function sendAudioData(pcmData) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !pcmData) {
        return;
    }
    
    // Add to buffer for batch sending
    audioBuffer.push(pcmData);
    
    // Update connection stats
    connectionStats.packetsent++;
    connectionStats.bytesSent += pcmData.byteLength;
    
    // If buffer is getting large, flush immediately
    if (audioBuffer.length >= 5) {
        flushAudioBuffer();
    }
}

// Start periodic buffer flushing for optimal performance
function startBufferFlushing() {
    if (bufferFlushTimer) return;
    
    bufferFlushTimer = setInterval(() => {
        if (audioBuffer.length > 0) {
            flushAudioBuffer();
        }
        
        // Log connection stats periodically
        if (connectionStats.packetsent > 0 && connectionStats.packetsent % 100 === 0) {
            const now = Date.now();
            const timeDiff = now - connectionStats.lastSendTime;
            connectionStats.avgSendRate = connectionStats.bytesSent / (timeDiff / 1000);
            
            console.log('Connection stats:', {
                packetsent: connectionStats.packetsent,
                bytesSent: connectionStats.bytesSent,
                avgSendRate: `${(connectionStats.avgSendRate / 1024).toFixed(1)} KB/s`
            });
            
            connectionStats.lastSendTime = now;
        }
    }, 50); // Flush every 50ms for low latency
}

// Stop buffer flushing
function stopBufferFlushing() {
    if (bufferFlushTimer) {
        clearInterval(bufferFlushTimer);
        bufferFlushTimer = null;
    }
    
    // Flush any remaining data
    if (audioBuffer.length > 0) {
        flushAudioBuffer();
    }
}

// Flush buffered audio data to WebSocket
function flushAudioBuffer() {
    if (audioBuffer.length === 0 || !ws || ws.readyState !== WebSocket.OPEN) {
        return;
    }
    
    try {
        // Send each buffer individually for now
        // Could be optimized to combine buffers for fewer WebSocket sends
        for (const buffer of audioBuffer) {
            ws.send(buffer);
        }
        
        audioBuffer = []; // Clear buffer
        
    } catch (error) {
        console.error('Error flushing audio buffer:', error);
        audioBuffer = []; // Clear buffer on error
    }
}

// Modern audio processing setup with AudioWorklet (fallback to ScriptProcessor)
async function setupAudioProcessing(stream, tabId) {
    try {
        console.log('Setting up enhanced audio processing...');
        
        // Create audio context with optimal settings for speech recognition
        audioContext = new AudioContext({ 
            sampleRate: 16000,
            latencyHint: 'interactive'
        });
        
        // Ensure audio context is running
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        console.log(`Audio context created: ${audioContext.sampleRate}Hz, state: ${audioContext.state}`);
        
        // Create media stream source
        const source = audioContext.createMediaStreamSource(stream);
        
        // Validate stream properties
        const track = stream.getAudioTracks()[0];
        if (track) {
            const settings = track.getSettings();
            console.log('Audio track settings:', {
                sampleRate: settings.sampleRate,
                channelCount: settings.channelCount,
                echoCancellation: settings.echoCancellation,
                noiseSuppression: settings.noiseSuppression
            });
        }
        
        // Try to use modern AudioWorklet, fallback to ScriptProcessor
        let processingNode;
        
        try {
            // Attempt to use AudioWorklet for better performance
            await setupAudioWorklet(source, tabId);
            console.log('Using AudioWorklet for audio processing');
        } catch (workletError) {
            console.warn('AudioWorklet not available, falling back to ScriptProcessor:', workletError.message);
            processingNode = await setupScriptProcessor(source, tabId);
        }
        
        console.log('Audio processing setup complete');
        return true;
        
    } catch (error) {
        console.error('Error setting up audio processing:', error);
        return false;
    }
}

// Modern AudioWorklet setup (preferred method)
async function setupAudioWorklet(source, tabId) {
    try {
        // Create AudioWorklet processor
        await audioContext.audioWorklet.addModule(createAudioWorkletProcessor());
        
        audioProcessor = new AudioWorkletNode(audioContext, 'audio-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            channelCount: 1,
            processorOptions: {
                bufferSize: 4096
            }
        });
        
        // Handle processed audio data
        audioProcessor.port.onmessage = (event) => {
            if (!isCapturing) {
                return;
            }
            
            try {
                const { audioData } = event.data;
                if (audioData && audioData.length > 0) {
                    const pcmData = convertFloat32ToInt16(audioData);
                    if (pcmData) {
                        sendAudioData(pcmData);
                    }
                }
            } catch (error) {
                console.error('Error processing AudioWorklet data:', error);
            }
        };
        
        // Connect audio processing chain
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
    } catch (error) {
        throw new Error(`AudioWorklet setup failed: ${error.message}`);
    }
}

// Fallback ScriptProcessor setup (for compatibility)
async function setupScriptProcessor(source, tabId) {
    console.log('Setting up ScriptProcessor fallback...');
    
    // Create script processor with optimal buffer size
    audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    // Audio processing event handler
    audioProcessor.onaudioprocess = (event) => {
        if (!isCapturing) {
            return;
        }
        
        try {
            const inputData = event.inputBuffer.getChannelData(0);
            
            // Apply basic audio processing
            const processedData = applyAudioEnhancements(inputData);
            const pcmData = convertFloat32ToInt16(processedData);
            
            if (pcmData) {
                sendAudioData(pcmData);
            }
        } catch (error) {
            console.error('Error processing audio:', error);
        }
    };
    
    // Connect audio processing chain
    source.connect(audioProcessor);
    audioProcessor.connect(audioContext.destination);
    
    return audioProcessor;
}

// Create AudioWorklet processor code as a blob URL
function createAudioWorkletProcessor() {
    const processorCode = `
        class AudioProcessor extends AudioWorkletProcessor {
            constructor(options) {
                super();
                this.bufferSize = options.processorOptions?.bufferSize || 4096;
                this.buffer = new Float32Array(this.bufferSize);
                this.bufferIndex = 0;
            }
            
            process(inputs, outputs, parameters) {
                const input = inputs[0];
                const output = outputs[0];
                
                if (input.length > 0) {
                    const inputChannel = input[0];
                    
                    // Copy input to output (passthrough)
                    if (output.length > 0) {
                        output[0].set(inputChannel);
                    }
                    
                    // Buffer audio data for processing
                    for (let i = 0; i < inputChannel.length; i++) {
                        this.buffer[this.bufferIndex] = inputChannel[i];
                        this.bufferIndex++;
                        
                        if (this.bufferIndex >= this.bufferSize) {
                            // Send buffered audio data to main thread
                            this.port.postMessage({
                                audioData: new Float32Array(this.buffer)
                            });
                            this.bufferIndex = 0;
                        }
                    }
                }
                
                return true; // Keep processor alive
            }
        }
        
        registerProcessor('audio-processor', AudioProcessor);
    `;
    
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
}

// Apply basic audio enhancements for better speech recognition
function applyAudioEnhancements(inputData) {
    const enhanced = new Float32Array(inputData.length);
    
    // Apply simple high-pass filter to reduce low-frequency noise
    let prevSample = 0;
    const alpha = 0.95; // High-pass filter coefficient
    
    for (let i = 0; i < inputData.length; i++) {
        // High-pass filter
        enhanced[i] = alpha * (enhanced[i - 1] || 0) + alpha * (inputData[i] - prevSample);
        prevSample = inputData[i];
        
        // Apply gentle compression to normalize volume
        const threshold = 0.7;
        const ratio = 0.5;
        
        if (Math.abs(enhanced[i]) > threshold) {
            const excess = Math.abs(enhanced[i]) - threshold;
            const compressedExcess = excess * ratio;
            enhanced[i] = Math.sign(enhanced[i]) * (threshold + compressedExcess);
        }
    }
    
    return enhanced;
}

// Enhanced main capture function with robust error handling
async function startCapturing(streamId, tabId) {
    if (isCapturing) {
        console.log('Capture already in progress');
        return;
    }
    
    console.log('Starting enhanced audio capture with stream ID:', streamId);
    currentTabId = tabId;
    isCapturing = true;
    
    try {
        // Notify content script of capture start
        sendToContentScript(tabId, {
            type: 'UPDATE_CAPTION',
            text: 'Initializing audio capture...',
            status: 'connecting'
        });
        
        // Acquire audio stream with enhanced constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                },
                optional: [
                    { echoCancellation: false },
                    { noiseSuppression: false },
                    { autoGainControl: false },
                    { googEchoCancellation: false },
                    { googAutoGainControl: false },
                    { googNoiseSuppression: false },
                    { googHighpassFilter: false }
                ]
            }
        });
        
        console.log('Audio stream acquired successfully');
        
        // Validate audio stream quality
        const validation = validateAudioStream(mediaStream);
        if (!validation.isValid) {
            throw new Error('Audio stream validation failed');
        }
        
        // Log stream information
        console.log('Audio stream validation:', validation);
        
        // Setup stream monitoring
        setupStreamMonitoring(mediaStream, tabId);
        
        // Setup audio processing
        const audioSetupSuccess = await setupAudioProcessing(mediaStream, tabId);
        if (!audioSetupSuccess) {
            throw new Error('Failed to setup audio processing');
        }
        
        // Create WebSocket connection
        createWebSocketConnection(tabId);
        
        console.log('Enhanced audio capture started successfully');
        
        // Notify content script of successful start
        sendToContentScript(tabId, {
            type: 'UPDATE_CAPTION',
            text: 'Audio capture active - processing...',
            status: 'connected'
        });
        
    } catch (error) {
        console.error('Failed to start audio capture:', error);
        isCapturing = false;
        
        // Provide detailed error feedback
        let errorMessage = 'Audio capture failed';
        let errorStatus = 'error';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Permission denied - please allow tab audio capture';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No audio source found in this tab';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Tab audio capture not supported';
        } else if (error.message.includes('stream')) {
            errorMessage = 'Invalid audio stream - try refreshing the tab';
        } else {
            errorMessage = `Audio capture error: ${error.message}`;
        }
        
        // Send detailed error to content script
        sendToContentScript(tabId, {
            type: 'UPDATE_CAPTION',
            text: errorMessage,
            status: errorStatus
        });
        
        // Clean up on error
        await stopCapturing();
    }
}

// Setup stream monitoring for quality and health checks
function setupStreamMonitoring(stream, tabId) {
    const audioTracks = stream.getAudioTracks();
    
    if (audioTracks.length > 0) {
        const track = audioTracks[0];
        
        // Monitor track state changes
        track.addEventListener('ended', () => {
            console.warn('Audio track ended unexpectedly');
            sendToContentScript(tabId, {
                type: 'UPDATE_CAPTION',
                text: 'Audio source disconnected - please restart transcription',
                status: 'error'
            });
            
            // Attempt to restart capture
            setTimeout(() => {
                if (isCapturing) {
                    console.log('Attempting to restart audio capture...');
                    // Could implement automatic restart logic here
                }
            }, 2000);
        });
        
        track.addEventListener('mute', () => {
            console.warn('Audio track muted');
            sendToContentScript(tabId, {
                type: 'UPDATE_CAPTION',
                text: 'Audio muted - waiting for audio...',
                status: 'reconnecting'
            });
        });
        
        track.addEventListener('unmute', () => {
            console.log('Audio track unmuted');
            sendToContentScript(tabId, {
                type: 'UPDATE_CAPTION',
                text: 'Audio restored - transcription active',
                status: 'connected'
            });
        });
        
        // Periodic health check
        const healthCheckInterval = setInterval(() => {
            if (!isCapturing) {
                clearInterval(healthCheckInterval);
                return;
            }
            
            if (track.readyState !== 'live' || !track.enabled) {
                console.warn('Audio track health check failed:', {
                    readyState: track.readyState,
                    enabled: track.enabled
                });
                
                sendToContentScript(tabId, {
                    type: 'UPDATE_CAPTION',
                    text: 'Audio quality issue detected',
                    status: 'reconnecting'
                });
            }
        }, 10000); // Check every 10 seconds
        
        console.log('Stream monitoring setup complete');
    }
}

// Enhanced stop capture function with complete cleanup
async function stopCapturing() {
    console.log('Stopping enhanced audio capture...');
    isCapturing = false;
    
    // Clear reconnection timer
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // Stop buffer flushing
    stopBufferFlushing();
    
    // Close WebSocket with proper disconnect message
    if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({
                    type: 'disconnect',
                    timestamp: Date.now(),
                    stats: connectionStats
                }));
            } catch (error) {
                console.warn('Failed to send disconnect message:', error);
            }
        }
        ws.close();
        ws = null;
    }
    
    // Stop audio processing
    if (audioProcessor) {
        try {
            if (audioProcessor.port) {
                // AudioWorklet cleanup
                audioProcessor.port.onmessage = null;
                audioProcessor.disconnect();
            } else {
                // ScriptProcessor cleanup
                audioProcessor.onaudioprocess = null;
                audioProcessor.disconnect();
            }
        } catch (error) {
            console.warn('Error disconnecting audio processor:', error);
        }
        audioProcessor = null;
    }
    
    // Close audio context
    if (audioContext) {
        try {
            if (audioContext.state !== 'closed') {
                await audioContext.close();
            }
        } catch (error) {
            console.warn('Error closing audio context:', error);
        }
        audioContext = null;
    }
    
    // Stop media stream and all tracks
    if (mediaStream) {
        try {
            mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped ${track.kind} track:`, track.label);
            });
        } catch (error) {
            console.warn('Error stopping media stream tracks:', error);
        }
        mediaStream = null;
    }
    
    // Clear audio buffer
    audioBuffer = [];
    
    // Reset connection stats
    connectionStats = {
        packetsent: 0,
        bytesSent: 0,
        lastSendTime: 0,
        avgSendRate: 0
    };
    
    // Notify content script
    if (currentTabId) {
        sendToContentScript(currentTabId, {
            type: 'UPDATE_CAPTION',
            text: '',
            status: 'stopped'
        });
    }
    
    currentTabId = null;
    reconnectAttempts = 0;
    
    console.log('Enhanced audio capture stopped and cleaned up');
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Offscreen received message:', message.type);
    
    switch (message.type) {
        case 'START_CAPTURING':
            if (message.streamId && message.tabId) {
                startCapturing(message.streamId, message.tabId);
                sendResponse({ status: 'started' });
            } else {
                console.error('Invalid start capturing message:', message);
                sendResponse({ status: 'error', error: 'Missing streamId or tabId' });
            }
            break;
            
        case 'STOP_CAPTURING':
            stopCapturing();
            sendResponse({ status: 'stopped' });
            break;
            
        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({ status: 'error', error: 'Unknown message type' });
    }
    
    return true; // Async response
});

// Notify background that offscreen is ready
chrome.runtime.sendMessage({
    type: 'OFFSCREEN_READY',
    timestamp: Date.now()
});

console.log('SE Insight Offscreen Document Ready');