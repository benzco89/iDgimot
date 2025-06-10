# Deployment Guide - Render.com

## Prerequisites

1. **GitHub Repository**: Ensure your project is pushed to GitHub
2. **Render Account**: Create a free account at [render.com](https://render.com)
3. **Google Gemini API Key**: Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Deployment Steps

### Method 1: Using render.yaml (Recommended)

1. **Connect GitHub Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Select "Build and deploy from a Git repository"
   - Connect your GitHub account and select the repository

2. **Configure Service**:
   - Render will automatically detect the `render.yaml` file
   - Review the configuration:
     - **Name**: `kan-news-content-assistant`
     - **Environment**: Node
     - **Build Command**: `npm run render-build`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Set Environment Variables**:
   - In the Render dashboard, go to your service settings
   - Add environment variables:
     ```
     GEMINI_API_KEY=your_actual_gemini_api_key_here
     NODE_ENV=production
     ```

4. **Deploy**:
   - Click "Create Web Service"
   - Render will build and deploy automatically

### Method 2: Manual Configuration

1. **Create Web Service**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**:
   ```
   Name: kan-news-content-assistant
   Environment: Node
   Region: Oregon (US West) or Frankfurt (Europe)
   Branch: main
   Build Command: npm run render-build
   Start Command: npm start
   ```

3. **Advanced Settings**:
   ```
   Node Version: 18
   Health Check Path: /api/health
   ```

4. **Environment Variables**:
   ```
   NODE_ENV=production
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

## Important Notes

### FFmpeg Installation
Render's Node.js environment includes FFmpeg by default, so no additional installation is needed.

### File Storage
- Uploaded videos are stored temporarily and automatically deleted after processing
- Generated thumbnails are stored on disk (included in the service)
- For production use, consider using external storage like AWS S3

### Environment Variables
- **Never commit API keys to your repository**
- Set sensitive variables in Render's dashboard only
- The `.env.example` file shows the required variables

### Build Process
The deployment process:
1. Installs root dependencies
2. Installs client dependencies  
3. Builds React app (creates `client/dist/`)
4. Installs server dependencies
5. Starts the Node.js server

### URL Structure
After deployment, your app will be available at:
```
https://kan-news-content-assistant.onrender.com
```

## Monitoring and Logs

### Health Check
- URL: `https://your-app.onrender.com/api/health`
- Should return: `{"status":"השרת פועל תקין"}`

### Viewing Logs
1. Go to your service in Render Dashboard
2. Click on "Logs" tab
3. Monitor for:
   - Build process completion
   - Server startup messages
   - API request processing
   - Error messages

### Common Log Messages
```bash
# Successful startup
השרת פועל על פורט 10000
מוכן לקבל העלאות סרטונים וניתוח עם Gemini Pro
API Key מוגדר: true

# Successful video processing
✅ תשובה התקבלה מהמודל
✅ תוכן נוצר בהצלחה
```

## Troubleshooting

### Build Failures
1. **"Package not found"**: Ensure all dependencies are in `package.json`
2. **"Out of memory"**: The free tier has memory limits, optimize build process
3. **"Build timeout"**: Check if build command is correct

### Runtime Issues
1. **"API Key not found"**: Verify environment variables are set correctly
2. **"FFmpeg not found"**: Should work automatically on Render
3. **"File upload failed"**: Check file size limits (100MB max)

### Performance
- Free tier has limitations (750 hours/month)
- App sleeps after 15 minutes of inactivity
- Cold starts may take 10-30 seconds

## Production Considerations

### Scaling
For high usage, consider:
- Upgrading to paid Render plan
- Implementing Redis for session management
- Using external storage (AWS S3) for files

### Security
- Set up proper CORS policies
- Implement rate limiting
- Add authentication if needed
- Monitor API usage and costs

### Monitoring
- Set up Render's built-in monitoring
- Consider external monitoring services
- Set up alerts for downtime or errors

## Cost Considerations

### Free Tier Limits
- 750 hours/month (enough for development/testing)
- Sleeps after 15 minutes of inactivity
- 512MB RAM, shared CPU

### Paid Plans
- **Starter ($7/month)**: No sleep, more resources
- **Standard ($25/month)**: Dedicated resources, custom domains
- **Pro ($85/month)**: Advanced features, priority support

### API Costs
- Google Gemini Pro has usage-based pricing
- Monitor your API usage in Google Cloud Console
- Set up billing alerts to avoid unexpected charges 