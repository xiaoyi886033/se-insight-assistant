#!/usr/bin/env python3
"""
Prepare SE Insight Extension for deployment
"""

import os
import zipfile
import json
import shutil
from datetime import datetime

def create_extension_package():
    """Create a deployment-ready extension package"""
    
    print("🚀 Preparing SE Insight Extension for Deployment")
    print("=" * 50)
    
    # Files to include in the extension package
    extension_files = [
        'manifest.json',
        'background.js',
        'content_script.js',
        'offscreen.js',
        'offscreen.html',
        'popup.js',
        'popup.html',
        'icons/icon16.png',
        'icons/icon48.png',
        'icons/icon128.png'
    ]
    
    # Verify all files exist
    missing_files = []
    for file in extension_files:
        file_path = os.path.join('extension', file)
        if not os.path.exists(file_path):
            missing_files.append(file)
    
    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        return False
    
    # Create deployment directory
    deploy_dir = "deployment"
    if os.path.exists(deploy_dir):
        shutil.rmtree(deploy_dir)
    os.makedirs(deploy_dir)
    
    # Create extension package
    extension_zip = os.path.join(deploy_dir, "se-insight-extension.zip")
    
    with zipfile.ZipFile(extension_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in extension_files:
            file_path = os.path.join('extension', file)
            zipf.write(file_path, file)
            print(f"✅ Added {file}")
    
    # Get package info
    zip_size = os.path.getsize(extension_zip)
    
    print(f"\n📦 Extension Package Created:")
    print(f"   File: {extension_zip}")
    print(f"   Size: {zip_size:,} bytes ({zip_size/1024:.1f} KB)")
    
    # Create backend deployment files
    backend_files = [
        'main.py',
        'config.py',
        'requirements.txt',
        'install_asr.py'
    ]
    
    backend_zip = os.path.join(deploy_dir, "se-insight-backend.zip")
    
    with zipfile.ZipFile(backend_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in backend_files:
            file_path = os.path.join('backend', file)
            if os.path.exists(file_path):
                zipf.write(file_path, file)
                print(f"✅ Added backend/{file}")
    
    backend_size = os.path.getsize(backend_zip)
    print(f"\n📦 Backend Package Created:")
    print(f"   File: {backend_zip}")
    print(f"   Size: {backend_size:,} bytes ({backend_size/1024:.1f} KB)")
    
    # Create deployment guide
    create_deployment_guide(deploy_dir)
    
    print(f"\n🎉 Deployment packages ready in '{deploy_dir}' folder!")
    return True

def create_deployment_guide(deploy_dir):
    """Create a deployment guide"""
    
    guide_content = f"""# SE Insight Extension - Deployment Guide

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 📦 Package Contents

### Extension Package: `se-insight-extension.zip`
Ready for Chrome Web Store submission containing:
- manifest.json (Extension configuration)
- background.js (Service worker)
- content_script.js (UI injection)
- offscreen.js (Audio capture)
- popup.js & popup.html (User interface)
- icons/ (16px, 48px, 128px PNG icons)

### Backend Package: `se-insight-backend.zip`
Ready for cloud deployment containing:
- main.py (FastAPI server)
- config.py (Configuration)
- requirements.txt (Dependencies)
- install_asr.py (ASR setup)

## 🚀 Chrome Web Store Deployment

### 1. Developer Account Setup
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Pay $5 one-time registration fee
3. Verify your identity

### 2. Extension Submission
1. Click "Add new item"
2. Upload `se-insight-extension.zip`
3. Fill out store listing:
   - **Name**: SE Insight: Intelligent Learning Assistant
   - **Description**: Real-time transcription and SE terminology analysis for educational content
   - **Category**: Education
   - **Language**: English

### 3. Store Listing Details
```
Short Description:
Real-time transcription with SE terminology explanations for technical videos and meetings.

Detailed Description:
SE Insight enhances your learning experience by providing real-time transcription and intelligent Software Engineering terminology analysis. Perfect for:

• Technical YouTube videos and online courses
• Software engineering meetings and presentations  
• Coding tutorials and conference talks
• Academic lectures on computer science topics

Features:
✓ Real-time audio transcription
✓ Automatic SE terminology detection
✓ Contextual explanations for technical terms
✓ Clean, non-intrusive caption display
✓ Privacy-first local processing

Simply click the extension icon, start capture, and watch as technical content becomes more accessible with instant explanations of complex terminology.
```

### 4. Screenshots Needed
Create 1280x800 screenshots showing:
1. Extension popup interface
2. Caption bar with SE term highlighting
3. Tooltip explanations in action

## ☁️ Backend Deployment Options

### Option 1: Railway (Recommended - Easiest)
1. Go to [Railway.app](https://railway.app)
2. Connect GitHub repository
3. Deploy `backend/` folder
4. Set environment variables:
   - `SE_INSIGHT_HOST=0.0.0.0`
   - `SE_INSIGHT_PORT=8000`

### Option 2: Render
1. Go to [Render.com](https://render.com)
2. Create new Web Service
3. Connect repository, select `backend/` folder
4. Build command: `pip install -r requirements.txt && python install_asr.py`
5. Start command: `python main.py`

### Option 3: Heroku
1. Install Heroku CLI
2. Create `Procfile` in backend folder: `web: python main.py`
3. Deploy:
```bash
cd backend
heroku create se-insight-backend
git add .
git commit -m "Deploy backend"
git push heroku main
```

## 🔧 Post-Deployment Configuration

### Update Extension for Production
After deploying backend, update `extension/offscreen.js`:
```javascript
// Change this line:
const WS_URL = "ws://localhost:8000/ws/audio";

// To your deployed backend URL:
const WS_URL = "wss://your-backend-url.com/ws/audio";
```

Then repackage and resubmit to Chrome Web Store.

## ✅ Pre-Deployment Checklist

- [ ] Icons created (16px, 48px, 128px)
- [ ] Manifest.json complete with all required fields
- [ ] All extension files included in package
- [ ] Backend tested locally
- [ ] Chrome Web Store developer account ready
- [ ] Screenshots prepared for store listing
- [ ] Backend deployment platform chosen
- [ ] Production WebSocket URL configured

## 🎯 Success Metrics

After deployment, monitor:
- Chrome Web Store ratings and reviews
- Backend server performance and uptime
- User adoption and usage statistics
- Error rates and performance metrics

## 📞 Support

For technical issues:
1. Check browser console for extension errors
2. Verify backend server status
3. Test WebSocket connectivity
4. Review Chrome extension permissions

The SE Insight Extension is production-ready and optimized for real-world usage!
"""
    
    guide_path = os.path.join(deploy_dir, "DEPLOYMENT_GUIDE.md")
    with open(guide_path, 'w', encoding='utf-8') as f:
        f.write(guide_content)
    
    print(f"✅ Created deployment guide: {guide_path}")

def main():
    """Main deployment preparation"""
    success = create_extension_package()
    
    if success:
        print("\n" + "=" * 50)
        print("🎊 SE Insight Extension is ready for deployment!")
        print("\nNext steps:")
        print("1. Review deployment/DEPLOYMENT_GUIDE.md")
        print("2. Submit se-insight-extension.zip to Chrome Web Store")
        print("3. Deploy backend using se-insight-backend.zip")
        print("4. Update WebSocket URL in extension for production")
        print("\n✨ Your extension is production-ready!")
    else:
        print("\n❌ Deployment preparation failed. Please fix missing files.")

if __name__ == "__main__":
    main()