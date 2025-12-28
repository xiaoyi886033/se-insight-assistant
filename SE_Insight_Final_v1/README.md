# SE Insight - Real-time SE Terminology Transcription

SE Insight is a Chrome extension with Railway backend that provides real-time transcription and Software Engineering terminology explanations for educational content.

## 🎯 Features

- **Real-time Audio Capture**: Chrome extension captures tab audio using native APIs
- **Live Transcription**: Google Speech API with automatic SE term detection
- **SE Terminology Detection**: Custom knowledge base with 26+ SE terms and definitions
- **AI-Powered Explanations**: Gemini API provides Chinese explanations for SE terms
- **Email Archival**: Automatic session transcript emails on disconnect
- **Modern UI**: Glassmorphism-styled caption bar with interactive term explanations

## 🏗️ Architecture

- **Backend**: Python FastAPI server with Google Speech API and Gemini AI integration
- **Frontend**: Chrome Manifest V3 extension with service worker and offscreen document
- **Deployment**: Railway cloud hosting with environment variable configuration
- **Audio Processing**: 16kHz downsampling optimized for real-time performance

## 🚀 Quick Start

### Backend Deployment (Railway)

1. **Deploy to Railway:**
   ```bash
   # Connect this repository to Railway
   # Railway will auto-detect configuration from Procfile
   ```

2. **Set Environment Variables:**
   ```bash
   # Required
   GCP_KEY_JSON={"type":"service_account",...}  # Google Cloud service account
   GEMINI_API_KEY=your-gemini-api-key           # Google AI Studio API key
   
   # Optional (Email archival)
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   RECIPIENT_EMAIL=recipient@example.com
   ```

3. **Verify Deployment:**
   ```bash
   curl https://your-app.railway.app/health
   ```

### Extension Installation

1. **Load Extension:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" → Select `extension/` folder

2. **Configure Backend URL:**
   - Open extension popup
   - Update Railway URL: `https://your-app.railway.app`
   - Test connection

3. **Start Transcription:**
   - Navigate to educational video (YouTube, etc.)
   - Click "Start SE Transcription" in extension popup
   - SE terminology will be highlighted with explanations

## 📁 Project Structure

```
SE_Insight_Final_v1/
├── backend/                 # FastAPI backend server
│   ├── main.py             # Main application with all endpoints
│   ├── requirements.txt    # Python dependencies
│   ├── Procfile           # Railway deployment configuration
│   └── railway.toml       # Railway build configuration
├── extension/              # Chrome extension files
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Service worker
│   ├── content.js         # Caption UI and SE term display
│   ├── popup.html/js      # Extension popup interface
│   ├── offscreen.html/js  # Audio capture and processing
│   └── config.js          # Railway URL configuration
└── docs/                  # Documentation
    ├── DEPLOYMENT_GUIDE.md
    └── RAILWAY_VARS_TEMPLATE.txt
```

## 🔧 Development

### Local Backend Development

```bash
cd backend
pip install -r requirements.txt
python main.py
# Server runs on http://localhost:8006
```

### Extension Development

1. Load extension in Chrome developer mode
2. Make changes to extension files
3. Click "Reload" in chrome://extensions/
4. Test functionality on educational videos

## 🎓 SE Terminology Support

SE Insight detects and explains 26+ Software Engineering terms including:

- **Architecture**: API, Microservices, REST, GraphQL, MVC
- **OOP**: Inheritance, Polymorphism, Encapsulation, Abstraction
- **Design Patterns**: Singleton, Factory, Observer
- **Data**: Database, SQL, NoSQL, Algorithm, Data Structure
- **DevOps**: Docker, Kubernetes, CI/CD
- **Programming**: Functional Programming, Asynchronous, Framework

## 🤖 AI Features

- **Gemini AI Integration**: Provides concise Chinese explanations for detected SE terms
- **Context-Aware**: Explanations focus on the current educational context
- **Real-time Processing**: <100ms SE term detection, <2s total latency

## 📧 Session Archival

- Automatically emails complete session transcripts on disconnect
- Includes detected SE terms and timestamps
- Professional HTML email templates with SE Insight branding

## 🔒 Security & Privacy

- All API keys stored as environment variables
- No audio data stored permanently
- Secure WebSocket connections (WSS for production)
- Chrome extension permissions limited to necessary APIs

## 📊 Performance

- **Target Latency**: <2s end-to-end transcription
- **SE Term Detection**: <100ms processing time
- **Memory Efficient**: Optimized audio processing prevents browser lag
- **Scalability**: Supports 100+ concurrent users

## 🛠️ Technology Stack

**Backend:**
- FastAPI with uvicorn ASGI server
- Google Cloud Speech API
- Google Gemini AI API
- aiosmtplib for email archival
- NumPy for audio processing

**Frontend:**
- Chrome Extension Manifest V3
- Service Worker + Offscreen Document architecture
- WebSocket for real-time communication
- Glassmorphism CSS styling

**Deployment:**
- Railway cloud hosting
- Environment variable configuration
- Health check monitoring
- Auto-scaling support

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the documentation in `docs/`
- Review Railway deployment logs
- Verify environment variable configuration
- Test with health check endpoint

---

**SE Insight Railway Edition v1.0** - Real-time SE terminology learning assistant