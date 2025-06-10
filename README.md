# Kan News Content Assistant 📺

*עוזר התוכן של כאן חדשות*

A Hebrew-language full-stack web application that generates YouTube content suggestions by analyzing news videos using Google's Gemini Pro AI. The application extracts video frames for thumbnails and provides structured content recommendations in Hebrew for Israeli news content creators.

## 🚀 Features

- **Video Upload & Analysis**: Upload MP4 videos up to 100MB for AI analysis
- **AI-Powered Content Generation**: Uses Google Gemini Pro to analyze video content and generate:
  - Content summaries in Hebrew
  - Multiple title suggestions
  - Description recommendations
  - Thumbnail suggestions with specific timestamps
- **Intelligent Thumbnail Extraction**: Automatically extracts high-quality (HD 1080p) video frames at AI-suggested timestamps
- **Hebrew RTL Interface**: Fully localized Hebrew interface with proper right-to-left text support
- **Interactive Content Editing**: Edit titles and descriptions with inline editing capabilities
- **Progress Tracking**: Real-time progress bar showing upload, processing, and completion stages
- **Video Preview**: Preview uploaded videos before processing

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling with RTL support
- **Modern UI Components** with responsive design

### Backend
- **Node.js** with Express.js
- **Google Gemini Pro API** for AI video analysis
- **Multer** for file upload handling
- **FFmpeg** for video processing and thumbnail extraction
- **CORS** enabled for cross-origin requests

### Key Dependencies
- `@google/generative-ai` - Google Gemini AI integration
- `fluent-ffmpeg` - Video processing
- `multer` - File upload middleware
- `express` - Web framework

## 📁 Project Structure

```
iDgimot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── InputForm.tsx      # Video upload form with progress
│   │   │   └── OutputDisplay.tsx  # Results display with editing
│   │   ├── App.tsx               # Main application component
│   │   └── index.css            # Tailwind styles with RTL
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Node.js backend
│   ├── uploads/           # Temporary video storage (gitignored)
│   ├── thumbnails/        # Generated thumbnails (gitignored)
│   ├── index.js          # Main server file
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
PORT=3001
```

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

## 📋 API Endpoints

### POST `/api/generate`
Analyzes uploaded video and generates content suggestions.

**Request**: `multipart/form-data`
- `video`: Video file (MP4, MOV, AVI - max 100MB)
- `reporterName`: Reporter's name (string)
- `videoDate`: Video date (string)

**Response**: JSON
```json
{
  "success": true,
  "content": {
    "summary": "Content summary in Hebrew",
    "titles": ["Title 1", "Title 2", "Title 3"],
    "descriptions": ["Description 1", "Description 2"],
    "thumbnails": [
      {"timestamp": "00:30.500", "description": "Key moment description"},
      {"timestamp": "02:15.200", "description": "Another key moment"}
    ]
  },
  "reporterName": "Reporter Name",
  "videoDate": "Date",
  "processing": {
    "videoSize": "12.5 MB",
    "processingTime": 15000,
    "modelUsed": "gemini-2.5-pro-preview-06-05"
  }
}
```

### POST `/api/extract-thumbnail`
Extracts video frame at specific timestamp.

**Request**: JSON
- `timestamp`: Time in format "MM:SS.XXX" or seconds

**Response**: JSON
```json
{
  "success": true,
  "thumbnailUrl": "/api/thumbnails/thumbnail-123456789.jpg"
}
```

### GET `/api/thumbnails/:filename`
Serves generated thumbnail images.

### GET `/api/health`
Health check endpoint.

## 🎨 UI Features

### Progress Tracking
- **Upload Stage (10-30%)**: File preparation and upload
- **Processing Stage (60%)**: AI analysis with Gemini Pro
- **Finalizing Stage (90%)**: Results preparation
- **Complete (100%)**: Success confirmation

### Content Management
- **Inline Editing**: Click to edit titles and descriptions
- **Save/Cancel**: Confirm or discard changes
- **Thumbnail Preview**: Large modal view for thumbnails
- **Download**: Save thumbnails locally

### Hebrew Interface
- Full RTL (Right-to-Left) text support
- Hebrew error messages and feedback
- Culturally appropriate date formats
- Israeli news terminology

## 🔧 Configuration

### Video Settings
- **Max file size**: 100MB
- **Supported formats**: MP4, MOV, AVI
- **Thumbnail quality**: HD 1080p (q:v 2)
- **Thumbnail format**: JPEG

### AI Model Settings
- **Model**: Google Gemini 2.5 Pro Preview
- **Content focus**: Hebrew news content
- **Output format**: Structured JSON
- **Analysis depth**: Full video content analysis

## 🚧 Development

### Available Scripts

**Root**:
- `npm run dev` - Start both client and server in development
- `npm run build` - Build client for production
- `npm start` - Start production server
- `npm run render-build` - Build command for Render deployment

**Server**:
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

**Client**:
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Development Notes

- The application uses Hebrew as the primary language
- All AI prompts are configured for Hebrew content generation
- Video files are temporarily stored during processing and automatically cleaned up
- Thumbnails are generated on-demand and cached on the server

## 📝 Usage Example

1. **Upload a Hebrew news video** (MP4 format, under 100MB)
2. **Fill in reporter details** (name and broadcast date)
3. **Click "נתח סרטון והפק הצעות"** (Analyze video and generate suggestions)
4. **Watch the progress bar** as the video is processed
5. **Review AI-generated content**:
   - Summary of the video content
   - Multiple title options
   - Description suggestions
   - Thumbnail recommendations with timestamps
6. **Edit content inline** by clicking on titles or descriptions
7. **Extract thumbnails** by clicking on timestamp suggestions
8. **Download thumbnails** for use in YouTube or other platforms

## 🔒 Security Notes

- API keys are stored in environment variables
- Uploaded videos are temporarily stored and automatically deleted
- No persistent storage of user content
- CORS configured for local development

## 🐛 Troubleshooting

### Common Issues

1. **"Too Many Requests" Error**: Gemini Pro Preview has usage limits
2. **FFmpeg not found**: Install FFmpeg on your system
3. **Large file uploads**: Check file size limits (100MB max)
4. **Hebrew text issues**: Ensure browser supports RTL text rendering

### Debug Mode

Server includes extensive logging for debugging:
- Video upload validation
- AI processing steps
- Thumbnail extraction process
- Error handling with stack traces

## 🤝 Contributing

This application is designed specifically for Hebrew news content creation. When contributing:

1. Maintain Hebrew language support
2. Follow RTL design principles
3. Test with Hebrew content
4. Ensure cultural appropriateness for Israeli news context

## 🚀 Deployment

### Render.com (Recommended)

This project is configured for easy deployment on Render.com:

1. **Push to GitHub**: Ensure your code is in a GitHub repository
2. **Connect to Render**: Link your GitHub repo to Render
3. **Auto-deploy**: Render will detect `render.yaml` and deploy automatically

**Environment Variables Required**:
```env
NODE_ENV=production
GEMINI_API_KEY=your_gemini_api_key
```

For detailed deployment instructions, see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

### Live Demo
Once deployed, your app will be available at:
```
https://your-app-name.onrender.com
```

## 📄 License

This project is private and intended for internal use.

---

**Built with ❤️ for Hebrew news content creators** 