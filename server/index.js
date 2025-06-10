const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpeg = require('fluent-ffmpeg');

// Set FFmpeg path for Windows (if needed)
if (process.platform === 'win32') {
  ffmpeg.setFfmpegPath('ffmpeg');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the React app (for production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('רק קבצי וידאו מותרים'));
    }
  }
});

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

// Helper function to convert file to generative part
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    }
  };
}

// Helper function to extract frame from video at specific timestamp
function extractFrameFromVideo(videoPath, timestamp, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .frames(1)
      .output(outputPath)
      .outputOptions([
        '-q:v 2',        // איכות גבוהה (1-31, נמוך יותר = איכות גבוהה יותר)
        '-vf scale=1920:1080:force_original_aspect_ratio=decrease', // רזולוציה מקסימלית 1080p
        '-f image2'      // פורמט תמונה
      ])
      .on('end', () => {
        console.log(`✅ פריים חולץ בהצלחה באיכות גבוהה: ${timestamp} -> ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`❌ שגיאה בחילוץ פריים: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

// Helper function to parse timestamp (MM:SS.XXX) to seconds
function parseTimestamp(timestamp) {
  const parts = timestamp.split(':');
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return parseFloat(minutes) * 60 + parseFloat(seconds);
  }
  return parseFloat(timestamp); // If already in seconds
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Endpoint לניתוח סרטון וייצור הצעות תוכן
app.post('/api/generate', upload.single('video'), async (req, res) => {
  console.log('=== התחלת בקשה חדשה ===');
  console.log('req.body:', req.body);
  console.log('req.file:', req.file ? {
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path
  } : 'לא התקבל קובץ');
  
  try {
    const { reporterName, videoDate } = req.body;
    
    console.log('נתונים שחולצו:');
    console.log('- reporterName:', reporterName);
    console.log('- videoDate:', videoDate);
    console.log('- videoFile exists:', !!req.file);

    const videoFile = req.file;

    // בדיקת שדות נדרשים
    if (!videoFile || !reporterName || !videoDate) {
      console.log('❌ חסרים שדות נדרשים:');
      console.log('- videoFile:', !!videoFile);
      console.log('- reporterName:', !!reporterName);
      console.log('- videoDate:', !!videoDate);
      
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: video file, reporterName, videoDate'
      });
    }

    console.log('✅ כל השדות התקבלו בהצלחה');
    console.log('מתחיל לעבד קובץ:', videoFile.filename);

    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-preview-06-05" });
    console.log('✅ מודל Gemini אותחל בהצלחה');

    // Convert the uploaded video to the format needed by Gemini
    console.log('מכין קובץ וידאו למודל...');
    const videoPart = fileToGenerativePart(videoFile.path, videoFile.mimetype);
    console.log('✅ קובץ וידאו הוכן בהצלחה');

    // בניית הפרומפט עם הוראות לניתוח הסרטון
    const prompt = `אתה עורך דיגיטל מומחה בערוץ היוטיוב של "כאן חדשות". נתח את הסרטון וצור הצעות תוכן.

שם הכתב/ת: ${reporterName}
תאריך שידור: ${videoDate}

החזר את התשובה בפורמט JSON המדויק הזה:

{
  "summary": "תקציר קצר ובהיר של הכתבה ב-2-3 משפטים",
  "titles": [
    "כותרת חדשותית ישירה",
    "כותרת עם זווית מעניינת",
    "כותרת עם אלמנט של סקרנות"
  ],
  "descriptions": [
    "תיאור קצר של הכתבה. כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}.",
    "תיאור אחר של הכתבה. כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}."
  ],
  "thumbnails": [
    {
      "timestamp": "MM:SS.XXX",
      "description": "תיאור הפריים הראשון"
    },
    {
      "timestamp": "MM:SS.XXX", 
      "description": "תיאור הפריים השני"
    }
  ]
}

הערה חשובה: טיימקוד צריך להיות מדויק בפורמט MM:SS.XXX (למשל: 02:15.750)`;

    console.log('שולח בקשה למודל Gemini...');
    // Generate content with video analysis
    const result = await model.generateContent([prompt, videoPart]);
    console.log('✅ תשובה התקבלה מהמודל');
    
    const response = await result.response;
    const generatedContent = response.text();
    console.log('✅ תוכן נוצר בהצלחה, אורך:', generatedContent.length, 'תווים');

    // נסה לפרסר את התוכן כ-JSON
    let parsedContent;
    try {
      // מחפש JSON בתוך התוכן (במקרה שיש טקסט נוסף)
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON פורסר בהצלחה');
      } else {
        throw new Error('לא נמצא JSON בתשובה');
      }
    } catch (parseError) {
      console.log('⚠️ לא ניתן לפרסר כ-JSON, משלח כטקסט רגיל');
      parsedContent = { rawContent: generatedContent };
    }

    // Clean up uploaded file after processing
    fs.unlinkSync(videoFile.path);
    console.log('✅ קובץ זמני נמחק');

    console.log('שולח תשובה ללקוח...');
    res.json({
      success: true,
      content: parsedContent,
      reporterName,
      videoDate,
      processing: {
        videoSize: formatFileSize(videoFile.size),
        processingTime: Date.now() - Date.parse(new Date()),
        modelUsed: "gemini-2.5-pro-preview-06-05"
      }
    });
    console.log('=== בקשה הושלמה בהצלחה ===');

  } catch (error) {
    console.error('❌ שגיאה בייצור תוכן:', error);
    console.error('Stack trace:', error.stack);
    
    // Clean up uploaded file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'שגיאה בשרת: ' + error.message
    });
  }
});

// Serve static images for thumbnails
app.use('/api/thumbnails', express.static(path.join(__dirname, 'thumbnails')));

// Endpoint לחילוץ תמונת ת'מבנייל
app.post('/api/extract-thumbnail', upload.single('video'), async (req, res) => {
  console.log('=== בקשה לחילוץ ת\'מבנייל ===');
  
  try {
    const { timestamp } = req.body;
    const videoFile = req.file;

    if (!videoFile || !timestamp) {
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: video file, timestamp'
      });
    }

    console.log('חולץ ת\'מבנייל בטיימקוד:', timestamp);

    // Create thumbnails directory if it doesn't exist
    const thumbnailsDir = path.join(__dirname, 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir);
    }

    // Parse timestamp and extract frame
    const timestampInSeconds = parseTimestamp(timestamp);
    const outputFileName = `thumbnail-${Date.now()}.jpg`;
    const outputPath = path.join(thumbnailsDir, outputFileName);

    await extractFrameFromVideo(videoFile.path, timestampInSeconds, outputPath);

    // Clean up uploaded file
    fs.unlinkSync(videoFile.path);

    // Return the thumbnail URL
    res.json({
      success: true,
      thumbnailUrl: `/api/thumbnails/${outputFileName}`,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('❌ שגיאה בחילוץ ת\'מבנייל:', error);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'שגיאה בחילוץ ת\'מבנייל: ' + error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'השרת פועל תקין' });
});

// Catch-all handler: serve React app for any non-API routes (production only)
if (process.env.NODE_ENV === 'production') {
  app.get('/*', (req, res) => {
    // Only serve React app for non-API routes
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    } else {
      res.status(404).json({ error: 'API route not found' });
    }
  });
}

app.listen(PORT, () => {
  console.log(`השרת פועל על פורט ${PORT}`);
  console.log('מוכן לקבל העלאות סרטונים וניתוח עם Gemini Pro');
  console.log('API Key מוגדר:', !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY));
}); 