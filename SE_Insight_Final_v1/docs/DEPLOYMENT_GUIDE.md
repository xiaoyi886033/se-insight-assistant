# SE Insight Railway Deployment Guide

This guide walks you through deploying SE Insight to Railway cloud platform with Google Speech API integration.

## 🚀 Quick Deployment

### 1. Railway Backend Deployment

1. **Connect Repository to Railway:**
   - Go to [Railway](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your SE Insight repository
   - Railway will auto-detect the configuration

2. **Set Environment Variables:**
   ```bash
   # Required Variables
   GCP_KEY_JSON={"type":"service_account","project_id":"upm-se-assistant",...}
   GEMINI_API_KEY=your-gemini-api-key-here
   
   # Optional Variables (Email archival)
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   RECIPIENT_EMAIL=recipient@example.com
   ```

3. **Deploy and Verify:**
   - Railway will automatically deploy using `Procfile`
   - Check deployment logs for any errors
   - Verify health endpoint: `https://your-app.railway.app/health`

### 2. Chrome Extension Setup

1. **Load Extension:**
   ```bash
   # Open Chrome
   chrome://extensions/
   
   # Enable Developer mode
   # Click "Load unpacked"
   # Select the extension/ folder
   ```

2. **Configure Railway URL:**
   - Open extension popup
   - Update "Railway Backend URL" field
   - Enter your Railway deployment URL: `https://your-app.railway.app`
   - Click "Test Railway Connection"

3. **Start Transcription:**
   - Navigate to educational video (YouTube, etc.)
   - Click "Start SE Transcription"
   - SE terms will be highlighted with explanations

## 🔧 Environment Variables Setup

### Required Variables

#### GCP_KEY_JSON
Google Cloud service account JSON for Speech API access.

**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `upm-se-assistant`
3. Navigate to IAM & Admin → Service Accounts
4. Create or select service account
5. Generate JSON key
6. Copy entire JSON content

**Format:**
```json
{
  "type": "service_account",
  "project_id": "upm-se-assistant",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "se-insight@upm-se-assistant.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

#### GEMINI_API_KEY
Google AI Studio API key for Chinese SE term explanations.

**How to get:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create new API key
3. Copy the key value

### Optional Variables

#### Email Archival (PO1 Feature)
```bash
EMAIL_USER=your-email@gmail.com          # Gmail address
EMAIL_PASSWORD=your-app-password         # Gmail app password (not account password)
RECIPIENT_EMAIL=recipient@example.com    # Where to send session archives
SMTP_SERVER=smtp.gmail.com              # SMTP server (default: Gmail)
SMTP_PORT=587                           # SMTP port (default: 587)
```

**Gmail App Password Setup:**
1. Enable 2-factor authentication on Gmail
2. Go to Google Account settings
3. Security → App passwords
4. Generate app password for "SE Insight"
5. Use generated password (not your Gmail password)

## 🏗️ Architecture Overview

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│ Chrome Extension│ ←──────────────→ │ Railway Backend │
│                 │                  │                 │
│ • Audio Capture │                  │ • Google Speech │
│ • SE Term UI    │                  │ • Gemini AI     │
│ • Glassmorphism │                  │ • Email Archive │
└─────────────────┘                  └─────────────────┘
```

### Backend Components
- **FastAPI Server**: Main application with WebSocket support
- **Google Speech API**: Real-time transcription
- **Gemini AI**: Chinese SE term explanations
- **Email Service**: Session transcript archival
- **SE Knowledge Base**: 26+ terminology definitions

### Extension Components
- **Service Worker**: Background message routing
- **Offscreen Document**: Audio capture and processing
- **Content Script**: Glassmorphism caption UI
- **Popup**: Configuration and status monitoring

## 🔍 Health Check Verification

After deployment, verify all services are working:

```bash
curl https://your-app.railway.app/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": 1703123456.789,
  "google_api_available": true,
  "client_initialized": true,
  "gcp_key_configured": true,
  "project": "upm-se-assistant",
  "features": {
    "se_knowledge_base": 26,
    "email_archival": true,
    "gemini_api": true,
    "active_sessions": 0
  },
  "audio_config": {
    "sample_rate": 16000,
    "channels": 1,
    "bit_depth": 16
  }
}
```

## 🐛 Troubleshooting

### Backend Issues

**❌ Google API not available**
- Check `GCP_KEY_JSON` environment variable
- Verify service account has Speech API permissions
- Ensure JSON format is valid

**❌ Gemini API not configured**
- Check `GEMINI_API_KEY` environment variable
- Verify API key is active in Google AI Studio
- Check API quotas and billing

**❌ Email archival not working**
- Verify `EMAIL_USER`, `EMAIL_PASSWORD`, `RECIPIENT_EMAIL`
- Use Gmail app password, not account password
- Check SMTP settings for other providers

### Extension Issues

**❌ WebSocket connection failed**
- Verify Railway URL in extension popup
- Check CORS settings in backend
- For localhost: Enable Chrome flag for insecure origins

**❌ Audio capture not working**
- Check Chrome permissions for tab audio
- Verify extension has `tabCapture` permission
- Test on supported sites (YouTube, etc.)

**❌ SE terms not showing**
- Check backend health endpoint
- Verify WebSocket connection in popup
- Check browser console for errors

### Performance Issues

**❌ Browser lag during capture**
- Audio processing is optimized for YouTube
- Check Chrome task manager for memory usage
- Restart extension if memory usage is high

**❌ Slow transcription**
- Check Railway backend logs
- Verify Google Speech API quotas
- Test with different audio sources

## 📊 Monitoring and Logs

### Railway Logs
```bash
# View deployment logs
railway logs

# Follow real-time logs
railway logs --follow
```

### Chrome Extension Debugging
```bash
# Open extension developer tools
chrome://extensions/ → SE Insight → "service worker" link

# Check content script console
F12 → Console (on any webpage)

# Monitor WebSocket traffic
F12 → Network → WS filter
```

### Performance Monitoring
- Railway dashboard shows CPU/memory usage
- Chrome task manager shows extension resource usage
- Backend `/health` endpoint provides service status

## 🔒 Security Best Practices

1. **Environment Variables:**
   - Never commit API keys to git
   - Use Railway's secure environment variable storage
   - Rotate API keys regularly

2. **CORS Configuration:**
   - Backend allows all origins for Chrome extension compatibility
   - Consider restricting origins in production if needed

3. **API Key Permissions:**
   - Limit Google Cloud service account permissions
   - Set appropriate quotas on APIs
   - Monitor API usage for anomalies

4. **Email Security:**
   - Use Gmail app passwords, not account passwords
   - Consider using dedicated email account for archival
   - Verify recipient email addresses

## 🎯 Production Checklist

- [ ] Railway deployment successful
- [ ] All environment variables set
- [ ] Health check returns "healthy"
- [ ] Google Speech API working
- [ ] Gemini AI explanations working
- [ ] Email archival configured (optional)
- [ ] Extension loads without errors
- [ ] WebSocket connection established
- [ ] Audio capture working on test videos
- [ ] SE terms detected and explained
- [ ] Chinese explanations displayed
- [ ] Session archival emails sent (if configured)

## 📞 Support

For deployment issues:
1. Check Railway deployment logs
2. Verify environment variables
3. Test health check endpoint
4. Check Chrome extension console
5. Review this deployment guide

---

**SE Insight Railway Edition** - Real-time SE terminology learning assistant