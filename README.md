# Kan News Content Assistant 📺

*עוזר התוכן של כאן חדשות*

A Hebrew-language full-stack web application that generates YouTube content suggestions by analyzing news videos using Google's Gemini AI. Features both manual upload analysis and automatic file monitoring for seamless workflow integration.

## 🚀 Features

### **Content Analysis**
- **Manual Video Upload**: Upload MP4 videos up to 100MB for AI analysis
- **Automatic File Monitoring**: Monitor folders for new video files and process automatically  
- **AI-Powered Content Generation**: Uses multiple Gemini models to analyze video content and generate:
  - Content summaries in Hebrew
  - Multiple title suggestions  
  - Description recommendations with required closing format
  - Thumbnail suggestions with specific timestamps

### **Advanced Workflow**
- **Daily Analysis Management**: Organized by date with automatic daily file creation
- **Analysis Reprocessing**: Re-analyze manual uploads with correction notes for better results
- **Real-time Updates**: Auto-refresh analysis list every 15-30 seconds based on pending analyses
- **Status Tracking**: Mark analyses as completed/pending with visual indicators
- **Smart Classification**: Automatic vs Manual analysis detection

### **User Interface**
- **Hebrew RTL Interface**: Fully localized Hebrew interface with proper right-to-left text support
- **Compact Design**: Optimized, space-efficient interface without unnecessary icons
- **Interactive Content Management**: View, edit, and manage all analyses in organized lists
- **Manual Thumbnail Extraction**: Extract specific frames from videos on demand (temporary files only)
- **Auto-refresh Indicator**: Shows last update time with visual status indicator

### **System Features**
- **Multiple AI Models**: Support for Gemini 2.5 Pro, Flash, and Flash Lite
- **Clean File Management**: No persistent thumbnail storage - generates on-demand only
- **Processing Logs**: Detailed logging for automatic file processing
- **Watch Folder Settings**: Configurable automatic processing with processed file tracking
- **Feedback System**: User feedback collection with optional Airtable integration

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling with RTL support
- **Modern UI Components** with responsive design

### Backend
- **Node.js** with Express.js
- **Google Gemini AI API** (Pro, Flash, Flash Lite models)
- **Multer** for file upload handling
- **FFmpeg** for video processing and thumbnail extraction
- **Chokidar** for file system monitoring
- **CORS** enabled for cross-origin requests

### Key Dependencies
- `@google/generative-ai` - Google Gemini AI integration
- `fluent-ffmpeg` - Video processing
- `chokidar` - File system watcher
- `multer` - File upload middleware
- `express` - Web framework

## 📁 Project Structure

```
iDgimot/
├── client/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputForm.tsx        # Video upload form with progress
│   │   │   ├── OutputDisplay.tsx    # Results display with editing
│   │   │   ├── AnalysisList.tsx     # Daily analyses management
│   │   │   └── SettingsPanel.tsx    # Watch folder configuration
│   │   ├── App.tsx                  # Main application component
│   │   └── index.css               # Tailwind styles with RTL
│   ├── package.json
│   └── vite.config.ts
├── server/                          # Node.js backend
│   ├── uploads/                     # Temporary video storage (gitignored)
│   ├── daily_analyses/              # Daily analysis JSON files (gitignored)
│   ├── processing_logs/             # Automatic processing logs (gitignored)
│   ├── index.js                     # Main server file
│   ├── watcher-settings.json        # File watcher configuration (gitignored)
│   ├── processed-files.json         # Processed files tracking (gitignored)
│   └── package.json
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **FFmpeg** installed on your system
- **Google Gemini API Key**

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd iDgimot
```

2. **Install server dependencies**:
```bash
cd server
npm install
```

3. **Install client dependencies**:
```bash
cd ../client
npm install
```

4. **Set up environment variables**:
Create a `.env` file in the `server` directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
# Alternative: GOOGLE_API_KEY=your_gemini_api_key_here
PORT=3001

# Optional: For feedback storage
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

5. **Optional: Set up Airtable for feedback storage**:
See [AIRTABLE_SETUP.md](AIRTABLE_SETUP.md) for detailed instructions.

### Running the Application

1. **Start the backend server**:
```bash
cd server
npm start
```
Server will run on `http://localhost:3001`

2. **Start the frontend development server**:
```bash
cd client
npm run dev
```
Client will run on `http://localhost:5173`

3. **Open your browser** and navigate to `http://localhost:5173`

## 📋 Key API Endpoints

### POST `/api/generate`
Analyzes uploaded video and generates content suggestions.

### POST `/api/reanalyze`
Re-analyzes existing content with correction notes (manual uploads only).

### POST `/api/extract-thumbnail`
Extracts video frame at specific timestamp (returns file directly, no storage).

### GET `/api/daily-analyses`
Gets analyses for a specific date or current date.

### GET `/api/available-dates`
Lists all available analysis dates.

### File Watcher APIs
- `GET /api/watcher/status` - Get file watcher status
- `POST /api/watcher/start` - Start automatic file monitoring
- `POST /api/watcher/stop` - Stop file monitoring
- `POST /api/watcher/settings` - Update watch folder settings

## 🎯 Usage Workflows

### Manual Analysis
1. Upload a Hebrew news video (MP4 format, under 100MB)
2. Fill in reporter details (name and broadcast date)
3. Select AI model (Pro/Flash/Flash Lite)
4. Click "נתח סרטון והפק הצעות" (Analyze video and generate suggestions)
5. Review and edit generated content
6. Mark as completed when done

### Automatic Analysis
1. Configure watch folder in Settings panel
2. Enable automatic monitoring
3. Drop video files in the watch folder
4. System automatically processes new files
5. View results in the daily analyses list
6. Mark analyses as completed when reviewed

### Re-analysis with Corrections
1. For manual uploads, click the reanalyze button (🔄)
2. Add correction notes (e.g., "The reporter is David Sharon, not Itai Blumenthal")
3. Submit for improved analysis
4. Compare results with original

## 🔧 Configuration Options

### AI Models
- **Gemini 2.5 Pro**: Best quality, slower processing
- **Gemini 2.5 Flash**: Balanced speed and quality
- **Gemini 2.5 Flash Lite**: Fastest processing, good quality

### File Watcher Settings
- **Watch Folder**: Directory to monitor for new videos
- **Processed Files Tracking**: Prevents duplicate processing
- **Model Selection**: Choose default model for automatic processing

### System Behavior
- **Daily Reset**: Automatic daily file organization at 2:00 AM
- **Auto-refresh**: Smart refresh intervals (15s with pending, 30s without)
- **File Cleanup**: Temporary thumbnails deleted immediately after use

## 🔀 Deployment Options

### 🌐 Cloud Deployment (main branch)
Basic version for Render.com cloud deployment:
- Manual video upload only
- Basic analysis features
- No file monitoring
- Internet accessible

### 🏢 Local Network Deployment (local-network-version branch)
Full-featured version for internal networks:
- ✅ Automatic file monitoring and processing
- ✅ Daily analysis management with date organization
- ✅ Processing logs and statistics
- ✅ Multiple AI model support
- ✅ Reanalysis with correction notes
- ✅ Clean file management (no accumulation)
- ✅ Network access configuration (0.0.0.0 binding)
- ✅ Simplified UI for end users
- ✅ Auto-refresh with visual indicators

## 🏢 Network Deployment

For deploying on company/office networks:

### Server Requirements
- **Node.js** runtime environment
- **FFmpeg** for video processing
- **Network access** for Gemini API calls
- **File system permissions** for uploads and processing

### Network Setup
1. **Install on server**: Copy project to dedicated server machine
2. **Configure IP access**: Server accessible at `http://[server-ip]:3001`
3. **Firewall settings**: Open port 3001 for network access
4. **Watch folder**: Set up shared network folder for automatic processing
5. **User access**: Employees access via web browser

### Production Commands
```bash
# Build client for production
cd client && npm run build

# Start server (consider using PM2 for process management)
cd server && npm start

# Or with PM2 for production
npm install -g pm2
pm2 start server/index.js --name idgimot
pm2 startup
pm2 save
```

### Branch Management
```bash
# Switch to local network version
git checkout local-network-version

# Or clone specific branch
git clone -b local-network-version https://github.com/your-repo/kan-news-content-assistant.git

# Deploy local network version
cd kan-news-content-assistant
npm run install:all
NODE_ENV=production npm start
```

## 🛡️ Security & Data Management

### Data Storage
- **Temporary uploads**: Videos deleted after processing
- **Daily analyses**: Stored in JSON files, organized by date
- **No thumbnail accumulation**: Generated on-demand only
- **Processing logs**: Kept for debugging and audit

### Privacy
- **Local processing**: All data stays on your network
- **API calls**: Only to Google Gemini (for AI analysis)
- **No external storage**: Optional Airtable integration only

## 🐛 Troubleshooting

### Common Issues
1. **API Rate Limits**: Switch to Flash Lite model for high volume
2. **FFmpeg not found**: Ensure FFmpeg is in system PATH
3. **File access errors**: Check folder permissions for watch directory
4. **Hebrew text issues**: Ensure browser supports RTL rendering

### Debug Information
- Server includes extensive Hebrew logging
- Processing logs saved automatically
- Error messages in Hebrew for user clarity

## 🤝 Contributing

When contributing:
1. Maintain Hebrew language support throughout
2. Follow RTL design principles
3. Test with Hebrew content and file names
4. Keep the interface clean and efficient
5. Preserve the dual manual/automatic workflow

## 📄 Recent Updates

- ✅ **Smart classification**: Proper automatic vs manual detection
- ✅ **Compact UI**: Removed unnecessary icons, optimized spacing
- ✅ **Clean file management**: No persistent thumbnail storage
- ✅ **Enhanced auto-refresh**: Visual indicators and smart intervals
- ✅ **Reanalysis feature**: Correction notes for manual uploads only
- ✅ **Daily organization**: Automatic date-based file management

---

**Built with ❤️ for Hebrew news content creators** 