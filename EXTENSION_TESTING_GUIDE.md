# SE Insight Extension - Chrome Testing Guide

## 🚀 Quick Start

### Prerequisites
- ✅ Backend server running on `localhost:8000`
- ✅ Chrome browser (Manifest V3 compatible)
- ✅ Developer mode enabled in Chrome

### 1. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension` folder from this project
5. The SE Insight extension should appear in your extensions list

### 2. Start Backend Server

```bash
cd backend
python main.py
```

Wait for: `INFO: Application startup complete.`

### 3. Test Extension

1. **Open a YouTube video** or any webpage with audio content
2. **Click the SE Insight extension icon** in Chrome toolbar
3. **Click "Start Capture"** in the popup
4. **Grant microphone/tab audio permissions** when prompted
5. **Look for the caption bar** at the bottom of the page

## 🧪 Testing Scenarios

### Scenario 1: YouTube Technical Video
1. Go to a software engineering YouTube video
2. Start SE Insight capture
3. Verify:
   - ✅ Caption bar appears at bottom
   - ✅ Real-time transcription displays
   - ✅ SE terms are highlighted
   - ✅ Hover over terms shows explanations

### Scenario 2: Online Meeting/Lecture
1. Join a technical meeting (Zoom, Teams, etc.)
2. Start SE Insight capture
3. Verify:
   - ✅ Audio capture from meeting tab
   - ✅ SE terminology extraction
   - ✅ Contextual explanations

### Scenario 3: Multiple Tabs
1. Open multiple tabs with audio
2. Test capture on different tabs
3. Verify:
   - ✅ Correct tab audio capture
   - ✅ Independent processing per tab
   - ✅ Clean stop/start functionality

## 🔧 Troubleshooting

### Extension Not Loading
- Check Chrome developer mode is enabled
- Verify all extension files are present
- Check browser console for errors

### No Audio Capture
- Grant microphone/tab permissions
- Check if tab has audio playing
- Verify backend WebSocket connection

### No Transcription
- Check backend server is running
- Verify WebSocket connection in browser DevTools
- Check backend logs for errors

### Caption Bar Not Appearing
- Check content script injection
- Verify no CSS conflicts
- Check browser console for errors

## 🎯 Expected Behavior

### Popup Interface
- ✅ Clean, modern UI
- ✅ Start/Stop capture buttons
- ✅ Connection status indicator
- ✅ Real-time statistics

### Caption Bar
- ✅ Sticky bottom positioning
- ✅ Glassmorphism design
- ✅ Smooth text updates
- ✅ SE term highlighting
- ✅ Interactive tooltips
- ✅ Minimize/maximize controls

### Backend Processing
- ✅ Real-time audio processing
- ✅ SE terminology extraction
- ✅ Contextual explanations
- ✅ Multiple connection support

## 📊 Performance Metrics

### Expected Performance
- **Latency**: < 2 seconds from speech to display
- **CPU Usage**: < 10% during active capture
- **Memory**: < 50MB for extension
- **Network**: ~10KB/s audio streaming

### Monitoring
- Check Chrome Task Manager for resource usage
- Monitor backend logs for processing times
- Use browser DevTools for network activity

## 🐛 Common Issues & Solutions

### Issue: "Service worker inactive"
**Solution**: Reload extension or restart Chrome

### Issue: "WebSocket connection failed"
**Solution**: Ensure backend server is running on port 8000

### Issue: "No audio permissions"
**Solution**: Grant microphone access in Chrome settings

### Issue: "Caption bar overlaps content"
**Solution**: Adjust z-index in content_script.js

## 🔍 Debug Mode

### Enable Debug Logging
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for SE Insight logs
4. Check Network tab for WebSocket activity

### Backend Debug
1. Check backend terminal for logs
2. Visit `http://localhost:8000/stats` for statistics
3. Use `http://localhost:8000/health` for health check

## ✅ Success Criteria

The extension is working correctly when:
- ✅ Popup loads without errors
- ✅ Audio capture starts successfully
- ✅ Caption bar appears and updates
- ✅ SE terms are highlighted with explanations
- ✅ Backend processes audio in real-time
- ✅ Clean stop/start functionality works
- ✅ No memory leaks or performance issues

## 🎉 Ready for Production

Once all tests pass, the SE Insight extension is ready for:
- User testing and feedback
- Performance optimization
- Additional SE terminology expansion
- Cloud deployment consideration