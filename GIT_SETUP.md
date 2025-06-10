# Git Setup Instructions

## Initial Setup

1. **Initialize Git repository**:
```bash
git init
```

2. **Add all files**:
```bash
git add .
```

3. **Create initial commit**:
```bash
git commit -m "Initial commit: Hebrew Kan News Content Assistant

- Full-stack React + Node.js application
- Google Gemini Pro AI integration for video analysis
- Hebrew RTL interface with progress tracking
- Video thumbnail extraction with FFmpeg
- Structured content generation (titles, descriptions, thumbnails)
- HD quality thumbnail generation at AI-suggested timestamps"
```

## GitHub Repository Setup

1. **Create repository on GitHub**:
   - Go to https://github.com/new
   - Repository name: `kan-news-content-assistant`
   - Description: "Hebrew-language full-stack web application for generating YouTube content suggestions using Google Gemini Pro AI"
   - Set to Private (recommended)
   - Don't initialize with README (we already have one)

2. **Add remote origin**:
```bash
git remote add origin https://github.com/YOUR_USERNAME/kan-news-content-assistant.git
```

3. **Push to GitHub**:
```bash
git branch -M main
git push -u origin main
```

## Environment Setup for Contributors

After cloning the repository, contributors should:

1. **Copy environment variables**:
```bash
cp server/.env.example server/.env
```

2. **Edit .env file with actual values**:
```bash
# In server/.env
GEMINI_API_KEY=your_actual_api_key_here
PORT=3001
NODE_ENV=development
```

3. **Install all dependencies**:
```bash
npm run install:all
```

4. **Run development servers**:
```bash
npm run dev
```

## Important Notes

- Never commit `.env` files containing real API keys
- The `uploads/` and `thumbnails/` directories are gitignored (temporary files)
- Make sure FFmpeg is installed on development machines
- Test with Hebrew content to ensure RTL functionality works correctly

## Deployment Considerations

For production deployment:
- Set `NODE_ENV=production`
- Ensure FFmpeg is installed on the production server
- Configure proper file upload limits
- Set up proper CORS policies
- Consider using environment-specific API endpoints 