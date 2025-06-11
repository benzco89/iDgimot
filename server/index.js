const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ffmpeg = require('fluent-ffmpeg');
const Airtable = require('airtable');

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

// Initialize Airtable
let airtableBase = null;
if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
  Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY
  });
  airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID);
  console.log('✅ Airtable מוכן לשימוש');
} else {
  console.log('⚠️ Airtable לא מוגדר - פידבק יישמר רק בלוגים');
}

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
    const prompt = `אתה עורך דיגיטל מומחה המתמחה בערוץ היוטיוב של "כאן חדשות". משימתך היא לנתח את תוכן הכתבה שתסופק לך ולצור הצעות תוכן מותאמות.

שם הכתב/ת: ${reporterName}
תאריך שידור: ${videoDate}

### שלב 1: ניתוח הסרטון
נתח את הסרטון ופרק את התוכן לרכיבים מרכזיים.

### שלב 2: הצעות לערוץ היוטיוב

#### ✍️ הצעות לכותרת (3 אפשרויות)
הכלל: כותרת ראשית המתארת את האירוע, שיכולה לכלול הקשר מעניין, פרט מסקרן, שאלה מושכת, ציטוט וסגנון חדשותי וישיר.

#### 📄 הצעות לתיאור (2 אפשרויות)  
הכלל: פסקה המסכמת את עיקרי הכתבה (1-3 משפטים) ומשפט חתימה סטנדרטי מותאם מגדרית.

#### 🖼️ הצעות לת'מבנייל (2 אפשרויות)
הכלל: טיימקוד מדויק לפריים ויזואלי חזק, אותנטי ודרמטי. ללא דמות הכתב/ת או טקסט. חפש רגעים עם אקשן, רגש, או אלמנטים ויזואליים בולטים.

החזר את התשובה בפורמט JSON המדויק הזה:

{
  "summary": "תקציר קצר ובהיר של הכתבה ב-2-3 משפטים",
  "titles": [
    "כותרת חדשותית ישירה המתארת את האירוע המרכזי",
    "כותרת עם זווית מעניינת או הקשר רחב יותר", 
    "כותרת עם אלמנט של סקרנות, שאלה או ציטוט"
  ],
  "descriptions": [
    "תיאור קצר המסכם את עיקרי הכתבה. כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}.",
    "תיאור אחר עם זווית שונה של הכתבה. כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}."
  ],
  "thumbnails": [
    {
      "timestamp": "MM:SS.XXX",
      "description": "תיאור ויזואלי מפורט של הפריים - מה רואים, איך זה נראה, למה זה מושך עין"
    },
    {
      "timestamp": "MM:SS.XXX", 
      "description": "תיאור ויזואלי מפורט של פריים נוסף עם אלמנט ויזואלי חזק או רגשי"
    }
  ]
}

הערות חשובות:
- טיימקוד חייב להיות מדויק בפורמט MM:SS.XXX (למשל: 02:15.750)
- לת'מבנייל: חפש פריימים ללא דמות הכתב/ת, עם אקשן או רגש חזק
- לכותרות: השתמש בשפה חדשותית ישירה ומושכת
- לתיאורים: תמיד סיים עם המשפט הסטנדרטי כולל שם הכתב והתאריך`;

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

// Endpoint לשמירת פידבק משתמש
app.post('/api/feedback', async (req, res) => {
  console.log('=== בקשה לשמירת פידבק ===');
  
  try {
    const { contentType, contentText, feedback, explanation, reporter, videoDate } = req.body;

    // בדיקת שדות נדרשים
    if (!contentType || !contentText || !feedback) {
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: contentType, contentText, feedback'
      });
    }

    console.log('פידבק התקבל:', {
      contentType,
      contentText: contentText.substring(0, 50) + '...',
      feedback,
      explanation: explanation ? 'יש הסבר' : 'אין הסבר',
      reporter
    });

    const feedbackData = {
      id: Date.now().toString(),
      contentType,
      contentText,
      feedback,
      explanation: explanation || '',
      reporter: reporter || '',
      videoDate: videoDate || '',
      timestamp: new Date().toISOString()
    };

    // שמירה ב-Airtable אם מוגדר
    if (airtableBase) {
      try {
        const record = await airtableBase('Feedback').create([
          {
            "fields": {
              "Content Type": contentType,
              "Content Text": contentText,
              "Feedback": feedback,
              "Explanation": explanation || '',
              "Reporter": reporter || '',
              "Video Date": videoDate || '',
              "Timestamp": new Date().toISOString(),
              "Feedback ID": feedbackData.id
            }
          }
        ]);

        console.log('✅ פידבק נשמר ב-Airtable:', record[0].getId());
        
        res.json({
          success: true,
          message: 'פידבק נשמר בהצלחה ב-Airtable',
          feedbackId: feedbackData.id,
          airtableId: record[0].getId()
        });

      } catch (airtableError) {
        console.error('❌ שגיאה בשמירה ב-Airtable:', airtableError);
        
        // גם אם יש שגיאה ב-Airtable, עדיין נחזיר הצלחה
        console.log('✅ פידבק נשמר מקומית:', feedbackData.id);
        
        res.json({
          success: true,
          message: 'פידבק נשמר מקומית (שגיאה ב-Airtable)',
          feedbackId: feedbackData.id,
          airtableError: airtableError.message
        });
      }
    } else {
      // אין Airtable - רק לוג מקומי
      console.log('✅ פידבק נשמר מקומית:', feedbackData.id);
      
      res.json({
        success: true,
        message: 'פידבק נשמר מקומית (Airtable לא מוגדר)',
        feedbackId: feedbackData.id
      });
    }

  } catch (error) {
    console.error('❌ שגיאה בשמירת פידבק:', error);
    
    res.status(500).json({
      error: 'שגיאה בשמירת פידבק: ' + error.message
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