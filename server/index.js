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

// Helper function to parse timestamp (MM:SS or MM:SS.XXX) to seconds
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
    const { reporterName, videoDate, selectedModel } = req.body;
    
    console.log('נתונים שחולצו:');
    console.log('- reporterName:', reporterName);
    console.log('- videoDate:', videoDate);
    console.log('- selectedModel:', selectedModel);
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

    // Available models with their characteristics
    const availableModels = {
      'gemini-2.5-pro': {
        name: 'Gemini 2.5 Pro',
        description: 'המודל החזק ביותר - מיועד לניתוח מורכב',
        speed: 'איטי',
        quality: 'מקסימלי',
        cost: 'גבוה'
      },
      'gemini-2.5-flash': {
        name: 'Gemini 2.5 Flash', 
        description: 'מאוזן - מהיר ויעיל',
        speed: 'מהיר',
        quality: 'גבוה',
        cost: 'בינוני'
      },
      'gemini-2.5-flash-lite-preview-06-17': {
        name: 'Gemini 2.5 Flash Lite',
        description: 'הכי מהיר וחסכוני',
        speed: 'מהיר מאוד',
        quality: 'טוב',
        cost: 'נמוך'
      }
    };

    // Select model - default to Pro if not specified
    const modelToUse = selectedModel && availableModels[selectedModel] 
      ? selectedModel 
      : 'gemini-2.5-pro';

    console.log('🤖 מודל נבחר:', availableModels[modelToUse].name);
    console.log('📊 מאפיינים:', availableModels[modelToUse]);

    // הגדרת סכמת JSON מובנית למודל
    const responseSchema = {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "תקציר התוכן החדשותי של הכתבה ב-2-3 משפטים - מה הסיפור העיקרי?"
        },
        titles: {
          type: "array",
          items: { type: "string" },
          description: "3 כותרות יוטיוב מושכות ומעניינות לסרטון"
        },
        descriptions: {
          type: "array", 
          items: { type: "string" },
          description: "2-3 תיאורים לסרטון עם קריאה לפעולה, כולל שם הכתב ותאריך"
        },
        thumbnails: {
          type: "array",
          items: {
            type: "object",
            properties: {
              timestamp: { type: "string", description: "זמן בפורמט MM:SS.XXX (למשל: 02:15.750)" },
              description: { type: "string", description: "תיאור ויזואלי מפורט של הפריים - מה רואים, איך זה נראה, למה זה מושך עין" }
            },
            required: ["timestamp", "description"]
          },
          description: "2-3 רגעים ויזואליים מעניינים לתמונות ת'מבנייל"
        }
      },
      required: ["summary", "titles", "descriptions", "thumbnails"]
    };

    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: modelToUse
    });
    console.log('✅ מודל Gemini אותחל בהצלחה');

    // Convert the uploaded video to the format needed by Gemini
    console.log('מכין קובץ וידאו למודל...');
    const videoPart = fileToGenerativePart(videoFile.path, videoFile.mimetype);
    console.log('✅ קובץ וידאו הוכן בהצלחה');

    // בניית הפרומפט עם הוראות לניתוח הסרטון
    const prompt = `אתה עורך דיגיטלי מומחה המתמחה בערוץ היוטיוב של "כאן חדשות". משימתך היא לנתח את תוכן הכתבה שתסופק לך ולצור הצעות תוכן מותאמות.

שם הכתב/ת: ${reporterName}
תאריך שידור: ${videoDate}

הוראות חשובות:
- אל תתרגם טקסט שמופיע על המסך
- אל תתאר מה כתוב בסרטון  
- התמקד בתוכן החדשותי והמסר העיקרי
- נתח את האירועים והעובדות, לא את הטקסט הגרפי

### שלב 1: ניתוח הסרטון
נתח את הסרטון ופרק את התוכן לרכיבים מרכזיים.

### שלב 2: הצעות לערוץ היוטיוב

#### ✍️ הצעות לכותרת (3 אפשרויות)
הכלל: כותרת ראשית המתארת את האירוע, שיכולה לכלול הקשר מעניין, פרט מסקרן, שאלה מושכת, ציטוט וסגנון חדשותי וישיר. אפשר ליצור משחקי מילים או טרנדים

#### 📄 הצעות לתיאור (3 אפשרויות)  
הכלל: פסקה המסכמת את עיקרי הכתבה (1-3 משפטים) ומשפט חתימה סטנדרטי מותאם מגדרית.

#### 🖼️ הצעות לת'מבנייל (2-3 אפשרויות)
הכלל: טיימקוד מדויק לפריים ויזואלי חזק, אותנטי ודרמטי. ללא דמות הכתב/ת או טקסט. חפש רגעים עם אקשן, רגש, או אלמנטים ויזואליים בולטים.

פורמט הת'מבנייל:
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

הערות חשובות:
- טיימקוד חייב להיות מדויק בפורמט MM:SS.XXX (למשל: 02:15.750)
- לת'מבנייל: חפש פריימים ללא דמות הכתב/ת, עם אקשן או רגש חזק
- לכותרות: השתמש בשפה חדשותית ישירה ומושכת
- לתיאורים: תמיד סיים עם המשפט הסטנדרטי כולל שם הכתב והתאריך
- התמקד בתוכן החדשותי בלבד, לא בתרגום טקסט

התשובה חייבת להיות בעברית בלבד.`;

    console.log('שולח בקשה למודל Gemini עם JSON Schema...');
    
    let parsedContent;
    let attempts = 0;
    const maxAttempts = 3;
    
    // נסה עד 3 פעמים לקבל JSON תקין
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 ניסיון ${attempts}/${maxAttempts}`);
      
      try {
        const result = await model.generateContent({
          contents: [{ parts: [{ text: prompt }, videoPart] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema,
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        });
        
        const response = await result.response;
        let generatedContent = response.text();
        console.log('✅ תשובה התקבלה מהמודל, אורך:', generatedContent.length, 'תווים');
        
        // אם זה thinking model, חפש את ה-JSON האחרון בתוכן
        if (generatedContent.includes('```json') || generatedContent.includes('{')) {
          console.log('🧠 זוהה thinking model - מחפש JSON סופי...');
          
          // חפש את כל בלוקי ה-JSON בתוכן
          const jsonBlocks = [];
          
          // חפש JSON בתוך ```json blocks
          const jsonCodeBlocks = generatedContent.match(/```json\s*([\s\S]*?)\s*```/g);
          if (jsonCodeBlocks) {
            jsonCodeBlocks.forEach(block => {
              const jsonContent = block.replace(/```json\s*|\s*```/g, '').trim();
              if (jsonContent.startsWith('{')) {
                jsonBlocks.push(jsonContent);
              }
            });
          }
          
          // חפש JSON ישירות (שמתחיל ב-{ ומסתיים ב-})
          const jsonMatches = generatedContent.match(/\{[\s\S]*?\}(?=\s*$|\s*\n\s*$)/g);
          if (jsonMatches) {
            jsonMatches.forEach(match => {
              if (match.includes('"summary"') || match.includes('"titles"')) {
                jsonBlocks.push(match.trim());
              }
            });
          }
          
          // קח את ה-JSON האחרון שנמצא
          if (jsonBlocks.length > 0) {
            generatedContent = jsonBlocks[jsonBlocks.length - 1];
            console.log('✅ נמצא JSON סופי, אורך:', generatedContent.length, 'תווים');
          }
        }
        
        // פרסור ה-JSON
        parsedContent = JSON.parse(generatedContent);
        console.log('✅ JSON פורסר בהצלחה');
        console.log('📊 מבנה התוכן:', {
          summary: !!parsedContent.summary,
          titles: parsedContent.titles?.length || 0,
          descriptions: parsedContent.descriptions?.length || 0,
          thumbnails: parsedContent.thumbnails?.length || 0
        });
        break;
        
      } catch (error) {
        console.error(`❌ שגיאה בניסיון ${attempts}:`, error.message);
        if (attempts === maxAttempts) {
          // אם כל הניסיונות נכשלו, החזר תוכן בסיסי
          parsedContent = { 
            summary: "שגיאה בניתוח הסרטון - נסה שוב",
            titles: ["כתבה של " + reporterName, "חדשות מ-" + videoDate, "עדכון חדשותי"],
            descriptions: [
              `כתבתו של ${reporterName}, כאן חדשות ${videoDate}.`,
              `עדכון חדשותי מאת ${reporterName} - ${videoDate}.`
            ],
            thumbnails: [
              {"timestamp": "00:10", "description": "פתיחת הכתבה"},
              {"timestamp": "00:30", "description": "רגע מרכזי בכתבה"}
            ]
          };
          break;
        }
        // חכה קצת לפני ניסיון נוסף
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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
        modelUsed: modelToUse,
        modelName: availableModels[modelToUse].name,
        modelCharacteristics: availableModels[modelToUse]
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

// Endpoint לקבלת רשימת המודלים הזמינים
app.get('/api/models', (req, res) => {
  const availableModels = {
    'gemini-2.5-pro': {
      name: 'Gemini 2.5 Pro',
      description: 'המודל החזק ביותר - מיועד לניתוח מורכב',
      speed: 'איטי',
      quality: 'מקסימלי',
      cost: 'גבוה',
      recommended: 'לכתבות מורכבות ומפורטות (ברירת מחדל)',
      default: true
    },
    'gemini-2.5-flash': {
      name: 'Gemini 2.5 Flash', 
      description: 'מאוזן - מהיר ויעיל',
      speed: 'מהיר',
      quality: 'גבוה',
      cost: 'בינוני',
      recommended: 'למרבית הכתבות'
    },
    'gemini-2.5-flash-lite-preview-06-17': {
      name: 'Gemini 2.5 Flash Lite',
      description: 'הכי מהיר וחסכוני',
      speed: 'מהיר מאוד',
      quality: 'טוב',
      cost: 'נמוך',
      recommended: 'לעיבוד מהיר בכמויות גדולות'
    }
  };

  res.json({
    success: true,
    models: availableModels,
    defaultModel: 'gemini-2.5-pro'
  });
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