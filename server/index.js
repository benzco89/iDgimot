const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
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

// === Logging System ===
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create log file for today
function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `server_${year}-${month}-${day}.log`;
}

// Smart logging system with rate limiting
const recentLogs = new Map();
const LOG_THROTTLE_TIME = 30000; // 30 seconds for repeated logs

function smartLog(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logKey = `${level}:${message}`;
  
  // Check if this is a repeated log
  if (recentLogs.has(logKey)) {
    const lastTime = recentLogs.get(logKey);
    if (Date.now() - lastTime < LOG_THROTTLE_TIME) {
      return; // Skip repeated log
    }
  }
  
  recentLogs.set(logKey, Date.now());
  
  // Clean old entries periodically
  if (recentLogs.size > 100) {
    const cutoff = Date.now() - LOG_THROTTLE_TIME;
    for (const [key, time] of recentLogs.entries()) {
      if (time < cutoff) {
        recentLogs.delete(key);
      }
    }
  }
  
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  
  // Console output (only important logs)
  if (level === 'info' || level === 'error' || level === 'warn') {
    const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
    console.log(`${emoji} ${message}`, data.details ? `- ${data.details}` : '');
  }
  
  // File output (all logs)
  const logLine = JSON.stringify(logEntry) + '\n';
  const logFile = path.join(logsDir, getLogFileName());
  fs.appendFileSync(logFile, logLine);
}

// === Daily Storage System ===
// Create daily analyses directory if it doesn't exist
const dailyAnalysesDir = path.join(__dirname, 'daily_analyses');
if (!fs.existsSync(dailyAnalysesDir)) {
  fs.mkdirSync(dailyAnalysesDir);
}

// Helper function to get current date string
function getCurrentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get daily analyses file path
function getDailyAnalysesFilePath() {
  const dateString = getCurrentDateString();
  return path.join(dailyAnalysesDir, `analyses_${dateString}.json`);
}

// Helper function to load daily analyses
function loadDailyAnalyses() {
  const filePath = getDailyAnalysesFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('❌ שגיאה בטעינת ניתוחים יומיים:', error);
  }
  
  // Return default structure if file doesn't exist or error
  return {
    date: getCurrentDateString(),
    analyses: []
  };
}

// Helper function to save daily analyses
function saveDailyAnalyses(analysesData) {
  const filePath = getDailyAnalysesFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(analysesData, null, 2), 'utf8');
    smartLog('debug', 'Daily analyses saved', { filePath });
    return true;
  } catch (error) {
    console.error('❌ שגיאה בשמירת ניתוחים יומיים:', error);
    return false;
  }
}

// Helper function to add analysis to daily storage
function addAnalysisToDaily(analysisData) {
  const dailyData = loadDailyAnalyses();
  
  // Create analysis entry
  const analysis = {
    id: `analysis_${Date.now()}`,
    timestamp: new Date().toISOString(),
    reporterName: analysisData.reporterName,
    videoDate: analysisData.videoDate,
    modelUsed: analysisData.modelUsed,
    videoSize: analysisData.videoSize,
    processingTime: analysisData.processingTime,
    content: analysisData.content,
    originalFilename: analysisData.originalFilename,
    filename: analysisData.filename,
    fileSize: analysisData.fileSize,
    status: 'pending',
    completedAt: null
  };
  
  dailyData.analyses.push(analysis);
  
  if (saveDailyAnalyses(dailyData)) {
    smartLog('debug', 'Analysis added to daily storage', { analysisId: analysis.id });
    return analysis;
  }
  
  return null;
}

// Schedule daily reset at 2:00 AM
function scheduleDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0); // 2:00 AM
  
  const msUntilReset = tomorrow.getTime() - now.getTime();
  
  setTimeout(() => {
    smartLog('info', 'Starting daily reset at 02:00');
    // The reset happens automatically when a new day starts
    // because getCurrentDateString() will return a new date
    smartLog('info', 'Daily reset completed - new day started');
    
    // Schedule next reset
    scheduleDailyReset();
  }, msUntilReset);
  
  smartLog('info', 'Daily reset scheduled', { nextReset: tomorrow.toLocaleString('he-IL') });
}

// Start daily reset scheduler
scheduleDailyReset();

// === End Daily Storage System ===

// Middleware
app.use(cors());
app.use(express.json());

// Simple test endpoint for debugging
app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works!' });
});

// Serve static files from the React app (always for simplicity)
app.use(express.static(path.join(__dirname, '../client/dist')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Create thumbnails directory if it doesn't exist
const thumbnailsDir = path.join(__dirname, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir);
}

// Serve static files for thumbnails
app.use('/thumbnails', express.static(thumbnailsDir));

// Configure multer for video uploads with Hebrew filename support
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Try to decode Hebrew filename for extension
    let extension = path.extname(file.originalname);
    try {
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      extension = path.extname(decodedName);
    } catch (error) {
      // Keep original extension if decoding fails
    }
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
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
  smartLog('info', 'Airtable ready for use');
} else {
  smartLog('warn', 'Airtable not configured - feedback will be saved in logs only');
}



// Helper function to create the main analysis prompt
function createAnalysisPrompt(reporterName, videoDate, isAutomaticProcessing = false) {
  // אם לא הועבר תאריך, השתמש בתאריך היום
  if (!videoDate || videoDate.trim() === '') {
    videoDate = new Date().toLocaleDateString('he-IL');
    smartLog('info', 'No date provided - using today date', { videoDate });
  }
  
  // הגדר הוראות מיוחדות לעיבוד ידני או אוטומטי
  let processingInstructions = '';
  let descriptionsFormat = '';
  
  if (!isAutomaticProcessing && reporterName && reporterName.trim() !== '') {
    // עיבוד ידני עם שם כתב מוגדר
    processingInstructions = ` הוראה קריטית - חובה לציית! 

שם הכתב שהוקש ידנית: "${reporterName}"
תאריך הכתבה שהוקש ידנית: "${videoDate}"

 חובה מוחלטת - קרא בעיון! 
1. אתה חייב להשתמש בדיוק בשם הכתב: "${reporterName}"
2. אתה חייב להשתמש בדיוק בתאריך: "${videoDate}"  
3. גם אם הסרטון מכיל שם כתב אחר - התעלם ממנו לחלוטין!
4. גם אם הסרטון מכיל תאריך אחר - התעלם ממנו לחלוטין!
5. השתמש רק בפרטים הללו: כתב="${reporterName}", תאריך="${videoDate}"

 זכור: אל תחליף! אל תשנה! השתמש בדיוק בפרטים שרשמתי למעלה! 

 תזכורת חובה: השתמש בכתב="${reporterName}" ותאריך="${videoDate}" בלבד! `;
    
    descriptionsFormat = `"כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}."`;
    
  } else {
    // עיבוד אוטומטי - זיהוי כתב מהסרטון
    processingInstructions = `הוראה חשובה: זהו עיבוד אוטומטי של הקובץ. זהה את שם הכתב/ת מהסרטון ויצור תוכן מקצועי בעברית.

 תאריך הכתבה: ${videoDate}`;
    
    descriptionsFormat = `"כתבתו/כתבתה של [שם הכתב שזיהית] מתוך מהדורת כאן חדשות, ${videoDate}."`;
  }

  // בנה את הפרומפט המאוחד
  return `אתה עוזר AI מקצועי שמנתח כתבות חדשותיות של כאן חדשות ומייצר תוכן לפלטפורמות דיגיטליות.

${processingInstructions}

נתח את הסרטון החדשותי וצור תוכן מסוגנן ומושך לפלטפורמות דיגיטליות, בהתאם לדרישות הבאות:

## 🎯 כותרות (4 כותרות יוטיוב) - הכותרות חייבות להיות מדויקות עובדתית עם המידע בכתבה:

 **עיקרון זהב**: התמקד בנושא המרכזי של הכתבה - לא בפרטים שוליים או תוספות!
 **מצא את ה"ג'וס"**: זהה את הזווית הכי מעניינת, דרמטית או מפתיעה בכתבה

🎪 **טכניקות ליצירת עניין (בהתבסס על עיתונאות מקצועית):**

1. **כותרת מרכזית**: התמקד בנושא העיקרי + **מספרים/נתונים** אם יש (מחירים, תאריכים, כמויות)
2. **כותרת זווית**: הדגש את הזווית הכי מעניינת + **השלכות אישיות** על הציבור הישראלי
3. **כותרת סקרנות**: עורר סקרנות עם **שאלה פתוחה** או **ניגוד מפתיע** מהכתבה 
4. **כותרת ציטוט**: **ציטוט דרמטי** מהכתבה או **השוואה מפתיעה**

💡 **נוסחאות מוכחות לעניין (בחר מה שמתאים לתוכן):**
- **"X שיעשה Y: Z"** - למשל: "היעד שיחליף את תאילנד: מה זה יעלה?"
- **"למה X עדיין Y?"** - למשל: "למה יוקר המחיה עדיין עולה?"
- **"מ-X ל-Y: הסיפור שמאחורי Z"** - למשל: "מחלום לסיוט: הסיפור שמאחורי המחאה"
- **"X בלבד: איך Y משנה Z"** - למשל: "שבוע בלבד: איך החוק משנה הכל"
- **"בפעם הראשונה: X"** - למשל: "בפעם הראשונה: ישראלים יוכלו לטוס ל..."

 **חובה**: כל כותרת צריכה לעסוק בחלק העיקרי והמשמעותי ביותר בכתבה!
 **חובה**: השתמש במילים פשוטות ובהירות שכל אחד יבין!

##  תיאורים (2 תיאורים בלבד):

 **אורך**: 100-150 מילים (מפורט אבל לא מתוח)

 **סגנון עיתונאי נקי:**
- התחל ישר עם העובדות המעניינות - בלי "וווים" מלאכותיים
- סדר כרונולוגי או לוגי של האירועים
- פרטים ספציפיים: שמות, מקומות, זמנים, מספרים
- שפה עיתונאית רשמית אבל קוראת טוב
- תן לסיפור לדבר בעצמו - הוא צריך להיות מעניין מטבעו
- בלי קריאות לפעולה מלאכותיות

 **מבנה פשוט:**
1. פתיחה עם העובדה המרכזית
2. פיתוח עם פרטים רלוונטיים  
3. סיום עם הקשר או השלכות
4. המשפט החובה עם שם הכתב

** CRITICAL REQUIREMENT - חובה מוחלטת **: 
כל תיאור חייב - ללא יוצא מן הכלל - להסתיים בדיוק במשפט הזה:
${descriptionsFormat}

 MANDATORY: אסור בתכלית האיסור לחרוג מהפורמט הזה! 
 הדרישה הזו קריטית ביותר - אם לא תעקוב אחריה, התוצאה תיפסל!
 כל תיאור חייב להסתיים במשפט המדויק - ללא שינויים!

##  תמונות מייצגות (3 תמונות):

🎬 **מה עושה ת'אמבנייל שמושך?** בחר רגעים ויזואליים שיש בהם:
- **רגשות חזקים**: כעס, שמחה, הפתעה, דאגה, רצינות
- **פעולה דרמטית**: תנועה, מחאות, חגיגות, פגישות חשובות
- **ניגודים ויזואליים**: עשיר/עני, ישן/חדש, גדול/קטן
- **אנשים בפעולה**: דיבור בתשוקה, קריאות, שיחות חשובות

📸 **סוגי תמונות שעובדות הכי טוב:**
- **פנים אקספרסיביות**: מישהו שמדבר בהתרגשות או מגיב חזק
- **תמונות מקום דרמטיות**: נופים מרשימים, מבנים חשובים, קהל גדול
- **ניגודים**: משהו ישן לצד משהו חדש, או שני דברים מנוגדים
- **פעולה ברגע**: מישהו במהלך דיבור, הסבר או התגובה חזקה

 **3 רגעים (בחר את החזקים ביותר!):**
- **פתיחה דרמטית**: רגע חזק מהתחלה שמושך מיד (עד דקה ראשונה)
- **שיא מרכזי**: הרגע הכי דרמטי או משמעותי בכתבה (אמצע)
- **סיום חזק**: רגע שמשאיר רושם או מסכם בעוצמה (סוף)

 **תיאור כל תמונה**: 
- **Timestamp מדויק**: בפורמט MM:SS.XXX (למשל: 01:23.456)
- **מה קורה ברגע**: תיאור מדויק של הפעולה, הרגש, המצב
- **פרטים ויזואליים**: ביטויי פנים, תנוחות גוף, צבעים, תאורה
- **למה זה יושך**: הסבר קצר למה התמונה הזו תגרום לאנשים ללחוץ

** דרישות חשובות:**
- כל התוכן חייב להיות בעברית בלבד
- השתמש בשפה עיתונאית מקצועית אך מעניינת  
- הכותרות צריכות להיות קצרות ומושכות לקליקים
- התמונות צריכות להיות ויזואלית מעניינות וברורות
- זהה נושאים רלוונטיים לציבור הישראלי
- הכותרות חייבות להיות מדויקות עובדתית עם המידע בכתבה
- הכותרות צריכות לעסוק בחלק העיקרי בכתבה

דבר בעברית טבעית ומקצועית. תן דגש על יצירת תוכן שמושך תשומת לב אבל נשאר אמין וחדשותי.

##  אזהרות קריטיות (בהתבסס על פידבק משתמשים):

 **אל תעשה:**
- אל תתמקד בפרטים שוליים או תוספות לא מרכזיות
- אל תשכח את הנושא העיקרי של הכתבה
- אל תכתוב תיאורים קצרים (מתחת ל-100 מילים)
- אל תיצור כותרות על נושאים משניים
- אל תוסיף "הוקים" מלאכותיים או קריאות לפעולה

 **תמיד תעשה:**
- זהה מה הנושא המרכזי והכי חשוב
- מצא את הזווית הכי מעניינת ("הג'וס")
- כתוב תיאורים ארוכים ומפורטים (100-150 מילים)
- השתמש בסגנון עיתונאי נקי ופשוט
- תן לסיפור לדבר בעצמו

## 🚨 דיוק עובדתי קריטי (פידבק משתמש - בעיה חמורה!):

⚠️ **אסור לשנות עובדות:** 
- אם הכתבה אומרת "עשוי להיפתח" או "אולי יצטרף" - כתוב בדיוק כך
- אל תהפוך אפשרויות עתידיות לעובדות וודאיות
- אל תכתוב "שייפתחו" אם הכתבה אומרת "שעשויים להיפתח"
- שמור על הדיוק המדויק של המידע בכתבה

✅ **דוגמאות נכונות:**
- "יעדים שעשויים להיפתח" (לא: "יעדים שייפתחו")
- "אולי יצטרפו בקרוב" (לא: "יצטרפו בקרוב")
- "ייתכן שיפותח" (לא: "יפותח")

🎯 **מטרה:** תוכן מעניין ומושך אבל עובדתית מדויק לחלוטין!

 FINAL WARNING - אזהרה אחרונה 
${!isAutomaticProcessing && reporterName ? 
  `השתמש רק בכתב: "${reporterName}" ותאריך: "${videoDate}"!
אל תשתמש בשמות או תאריכים אחרים מהסרטון!
כל תיאור חייב להסתיים במשפט הקבוע עם הפרטים הללו בלבד!` :
  `אם אתה לא תסיים את כל התיאורים במשפט המדויק שדרשתי, התוצאה תיפסל לחלוטין!
כל תיאור חייב להסתיים במשפט הקבוע - זו הדרישה החשובה ביותר!
אל תשכח - אל תחרוג - אל תשנה!`}`;
}

// Helper function to decode Hebrew filenames
function decodeHebrewFilename(filename) {
  if (!filename) return '';
  
  // Try multiple decoding approaches
  const decodingMethods = [
    // Method 1: Direct UTF-8 conversion from latin1
    () => Buffer.from(filename, 'latin1').toString('utf8'),
    
    // Method 2: URI decode
    () => decodeURIComponent(escape(filename)),
    
    // Method 3: Try different encodings
    () => {
      try {
        return Buffer.from(filename, 'binary').toString('utf8');
      } catch (e) {
        return filename;
      }
    },
    
    // Method 4: Just return original if all fail
    () => filename
  ];
  
  for (const method of decodingMethods) {
    try {
      const decoded = method();
      
      // Check if the decoded string looks like Hebrew
      const hebrewRegex = /[\u0590-\u05FF]/;
      if (hebrewRegex.test(decoded) || decoded !== filename) {
        smartLog('debug', 'Filename decoded successfully', { original: filename, decoded });
        return decoded;
      }
    } catch (error) {
      continue; // Try next method
    }
  }
  
  smartLog('warn', 'Unable to decode filename', { filename });
  return filename;
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
  smartLog('debug', 'Attempting to extract frame', { videoPath, timestamp, outputPath });
  
  return new Promise((resolve, reject) => {
    // Check if input file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ קובץ הוידאו לא נמצא: ${videoPath}`);
      reject(new Error(`קובץ הוידאו לא נמצא: ${videoPath}`));
      return;
    }
    
    smartLog('debug', 'Starting frame extraction with ffmpeg');
    
    ffmpeg(videoPath)
      .seekInput(timestamp)
      .frames(1)
      .output(outputPath)
      .outputOptions([
        '-q:v 2',        // איכות גבוהה (1-31, נמוך יותר = איכות גבוהה יותר)
        '-vf scale=1920:1080:force_original_aspect_ratio=decrease', // רזולוציה מקסימלית 1080p
        '-f image2'      // פורמט תמונה
      ])
      .on('start', (commandLine) => {
        smartLog('debug', 'FFmpeg command', { command: commandLine });
      })
      .on('progress', (progress) => {
        smartLog('debug', 'Extraction progress', { percent: progress.percent });
      })
      .on('end', () => {
        smartLog('info', 'Frame extracted successfully', { timestamp, outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`❌ שגיאה בחילוץ פריים: ${err.message}`);
        console.error(`❌ פרטי השגיאה המלאים:`, err);
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
  smartLog('info', 'New analysis request started');
  console.log('req.body:', req.body);
  console.log('req.file:', req.file ? {
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path
  } : 'לא התקבל קובץ');
  
  try {
    const { reporterName, videoDate, selectedModel } = req.body;
    
    smartLog('debug', 'Request data extracted', {
      reporterName,
      videoDate,
      selectedModel,
      hasVideoFile: !!req.file
    });

    const videoFile = req.file;

    // בדיקת שדות נדרשים - רק וידאו ושם כתב הם חובה, תאריך יכול להיות ריק
    if (!videoFile || !reporterName) {
      smartLog('warn', 'Missing required fields', {
        hasVideoFile: !!videoFile,
        hasReporterName: !!reporterName,
        videoDate: videoDate || 'empty - will use today date'
      });
      
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: video file, reporterName'
      });
    }

    smartLog('info', 'All fields received successfully', { filename: videoFile.filename });

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

    smartLog('info', 'Model selected', {
      model: availableModels[modelToUse].name,
      properties: availableModels[modelToUse]
    });

    // הגדרת סכמת JSON מובנית למודל
    smartLog('debug', 'JSON Schema parameters', { reporterName, videoDate });
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
          description: "4 כותרות יוטיוב מושכות ומעניינות לסרטון"
        },
        descriptions: {
          type: "array", 
          items: { type: "string" },
          description: `2 תיאורים לסרטון. חובה מוחלטת: כל תיאור חייב להסתיים בדיוק במשפט 'כתבתו/כתבתה של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}.' - ללא חריגות!`
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

    // הדפסת ה-JSON Schema לבדיקה
    smartLog('debug', 'JSON Schema descriptions field configured', { field: responseSchema.properties.descriptions.description });

    // Get the generative model
    const model = genAI.getGenerativeModel({ 
      model: modelToUse
    });
    smartLog('info', 'Gemini model initialized successfully');

    // Convert the uploaded video to the format needed by Gemini
    smartLog('debug', 'Preparing video file for model');
    const videoPart = fileToGenerativePart(videoFile.path, videoFile.mimetype);
    smartLog('info', 'Video file prepared successfully');

    // בניית הפרומפט עם הוראות לניתוח הסרטון
    smartLog('debug', 'Creating prompt with parameters');
    console.log('- reporterName:', `"${reporterName}"`);
    console.log('- videoDate:', `"${videoDate}"`);
    console.log('- isAutomaticProcessing:', false);
    
    const prompt = createAnalysisPrompt(reporterName, videoDate, false);
    
    // נוסיף בדיקה שהפרומפט מכיל את הפרמטרים הנכונים
    if (prompt.includes(reporterName) && prompt.includes(videoDate)) {
      smartLog('debug', 'Prompt contains correct parameters');
    } else {
      smartLog('warn', 'Prompt missing parameters warning');
      smartLog('debug', 'Prompt parameter check', { hasReporterName: prompt.includes(reporterName) });
      smartLog('debug', 'Prompt parameter check', { hasVideoDate: prompt.includes(videoDate) });
    }
    
    // נציג חלק מהפרומפט לבדיקה
    smartLog('debug', 'Prompt preview', { preview: prompt.substring(0, 300) + '...' });

    smartLog('info', 'Sending request to Gemini model with JSON Schema');
    
    let parsedContent;
    let attempts = 0;
    const maxAttempts = 3;
    
    // נסה עד 3 פעמים לקבל JSON תקין
    while (attempts < maxAttempts) {
      attempts++;
      smartLog('debug', 'Analysis attempt', { attempt: attempts, maxAttempts });
      
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
        smartLog('info', 'Response received from model', { contentLength: generatedContent.length });
        
        // אם זה thinking model, חפש את ה-JSON האחרון בתוכן
        if (generatedContent.includes('```json') || generatedContent.includes('{')) {
          smartLog('debug', 'Thinking model detected - searching for final JSON');
          
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
            smartLog('debug', 'Final JSON found', { contentLength: generatedContent.length });
          }
        }
        
        // פרסור ה-JSON
        parsedContent = JSON.parse(generatedContent);
        smartLog('info', 'JSON parsed successfully');
        smartLog('debug', 'Content structure', {
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
            titles: ["כתבה של " + reporterName, "חדשות מ-" + videoDate, "עדכון חדשותי", "דיווח מיוחד של " + reporterName],
            descriptions: [
              `שגיאה בניתוח הסרטון - נסה שוב. כתבתו של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}.`,
              `עדכון חדשותי מיוחד - המערכת זמנית לא זמינה. כתבתו של ${reporterName} מתוך מהדורת כאן חדשות, ${videoDate}.`
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
    smartLog('debug', 'Temporary file deleted');

    // Prepare processing info
    const processingInfo = {
      videoSize: formatFileSize(videoFile.size),
      processingTime: Date.now() - Date.parse(new Date()),
      modelUsed: modelToUse,
      modelName: availableModels[modelToUse].name,
      modelCharacteristics: availableModels[modelToUse]
    };

    // Decode Hebrew filename properly
    const decodedFilename = decodeHebrewFilename(videoFile.originalname);
    smartLog('debug', 'Original filename', { filename: videoFile.originalname });
    smartLog('debug', 'Decoded filename', { filename: decodedFilename });

    // Save analysis to daily storage
    const savedAnalysis = addAnalysisToDaily({
      reporterName,
      videoDate,
      modelUsed: modelToUse,
      videoSize: processingInfo.videoSize,
      processingTime: processingInfo.processingTime,
      content: parsedContent,
      originalFilename: decodedFilename,
      filename: videoFile.filename,
      fileSize: videoFile.size
    });

    smartLog('debug', 'Sending response to client');
    res.json({
      success: true,
      content: parsedContent,
      reporterName,
      videoDate,
      processing: processingInfo,
      analysisId: savedAnalysis ? savedAnalysis.id : null // Add analysis ID to response
    });
    smartLog('info', 'Request completed successfully');

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
  

// Endpoint לחילוץ תמונת ת'מבנייל (לפי בקשה בלבד, ללא שמירה)
app.post('/api/extract-thumbnail', upload.single('video'), async (req, res) => {
  smartLog('info', 'Thumbnail extraction request started');
  
  try {
    const { timestamp } = req.body;
    const videoFile = req.file;

    if (!videoFile || !timestamp) {
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: video file, timestamp'
      });
    }

    smartLog('debug', 'Extracting thumbnail at timestamp', { timestamp });

    // Parse timestamp and extract frame to temp file
    const timestampInSeconds = parseTimestamp(timestamp);
    const tempFileName = `temp_thumbnail_${Date.now()}.jpg`;
    const tempPath = path.join(__dirname, 'uploads', tempFileName);

    await extractFrameFromVideo(videoFile.path, timestampInSeconds, tempPath);

    // Move the thumbnail to the thumbnails directory with a permanent name
    const thumbnailFileName = `thumbnail_${Date.now()}_${timestamp.replace(/[:.]/g, '_')}.jpg`;
    const thumbnailPath = path.join(__dirname, 'thumbnails', thumbnailFileName);
    
    // Ensure thumbnails directory exists
    if (!fs.existsSync(path.join(__dirname, 'thumbnails'))) {
      fs.mkdirSync(path.join(__dirname, 'thumbnails'), { recursive: true });
    }
    
    // Move the temp file to permanent location
    fs.renameSync(tempPath, thumbnailPath);
    
    // Clean up uploaded video file
    fs.unlinkSync(videoFile.path);

    // Return success response with thumbnail URL
    res.json({
      success: true,
      thumbnailUrl: `/thumbnails/${thumbnailFileName}`,
      message: 'ת\'אמבנייל נוצר בהצלחה'
    });

  } catch (error) {
    console.error('❌ שגיאה בחילוץ ת\'מבנייל:', error);
    
    // Clean up on error
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
  smartLog('info', 'Feedback submission request started');
  
  try {
    const { contentType, contentText, feedback, explanation, reporter, videoDate } = req.body;

    // בדיקת שדות נדרשים
    if (!contentType || !contentText || !feedback) {
      return res.status(400).json({
        error: 'חסרים שדות נדרשים: contentType, contentText, feedback'
      });
    }

    smartLog('debug', 'Feedback received', {
      contentType,
      contentTextPreview: contentText.substring(0, 50) + '...',
      feedback,
      hasExplanation: !!explanation,
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

        smartLog('info', 'Feedback saved to Airtable', { recordId: record[0].getId() });
        
        res.json({
          success: true,
          message: 'פידבק נשמר בהצלחה ב-Airtable',
          feedbackId: feedbackData.id,
          airtableId: record[0].getId()
        });

      } catch (airtableError) {
        console.error('❌ שגיאה בשמירה ב-Airtable:', airtableError);
        
        // גם אם יש שגיאה ב-Airtable, עדיין נחזיר הצלחה
        smartLog('info', 'Feedback saved locally', { feedbackId: feedbackData.id });
        
        res.json({
          success: true,
          message: 'פידבק נשמר מקומית (שגיאה ב-Airtable)',
          feedbackId: feedbackData.id,
          airtableError: airtableError.message
        });
      }
    } else {
      // אין Airtable - רק לוג מקומי
      smartLog('info', 'Feedback saved locally', { feedbackId: feedbackData.id });
      
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

// Endpoint לקבלת רשימת תאריכים זמינים
app.get('/api/available-dates', (req, res) => {
  smartLog('debug', 'API request: available-dates', { endpoint: '/api/available-dates' });
  
  try {
    const files = fs.readdirSync(dailyAnalysesDir);
    const dates = files
      .filter(file => file.startsWith('analyses_') && file.endsWith('.json'))
      .map(file => {
        const dateStr = file.replace('analyses_', '').replace('.json', '');
        const filePath = path.join(dailyAnalysesDir, file);
        const stats = fs.statSync(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        return {
          date: dateStr,
          displayDate: new Date(dateStr + 'T00:00:00').toLocaleDateString('he-IL'),
          analysisCount: data.analyses ? data.analyses.length : 0,
          lastModified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first
    
    smartLog('debug', 'Available dates found', { count: dates.length });
    
    res.json({
      success: true,
      dates: dates,
      currentDate: getCurrentDateString()
    });
    
  } catch (error) {
    console.error('❌ שגיאה בקבלת תאריכים:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת רשימת התאריכים'
    });
  }
});

// Endpoint לקבלת ניתוחים יומיים (עם תמיכה בתאריך ספציפי)
app.get('/api/daily-analyses', (req, res) => {
  smartLog('debug', 'API request: daily-analyses', { 
    endpoint: '/api/daily-analyses',
    requestedDate: req.query.date 
  });
  
  const requestedDate = req.query.date; // Get date from query parameter
  
  try {
    let dailyData;
    let targetDate;
    
    if (requestedDate) {
      // Load specific date
      targetDate = requestedDate;
      const filePath = path.join(dailyAnalysesDir, `analyses_${requestedDate}.json`);
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        dailyData = JSON.parse(data);
        smartLog('debug', 'Daily analyses loaded', { date: requestedDate });
      } else {
        smartLog('warn', 'Daily analyses file not found', { requestedDate });
        return res.json({
          success: true,
          date: requestedDate,
          analyses: [],
          totalCount: 0,
          pendingCount: 0,
          completedCount: 0,
          message: `לא נמצאו ניתוחים עבור תאריך ${requestedDate}`
        });
      }
    } else {
      // Load current date (existing behavior)
      dailyData = loadDailyAnalyses();
      targetDate = dailyData.date;
    }
    
    smartLog('debug', 'Analyses found for date', { 
      count: dailyData.analyses.length, 
      date: targetDate 
    });

    // Sort analyses by timestamp - newest first (reverse chronological order)
    const sortedAnalyses = [...dailyData.analyses].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    res.json({
      success: true,
      date: targetDate,
      analyses: sortedAnalyses,
      totalCount: dailyData.analyses.length,
      pendingCount: dailyData.analyses.filter(a => a.status === 'pending').length,
      completedCount: dailyData.analyses.filter(a => a.status === 'completed').length
    });
    
  } catch (error) {
    console.error('❌ שגיאה בקבלת ניתוחים יומיים:', error);
    res.status(500).json({
      error: 'שגיאה בקבלת ניתוחים יומיים: ' + error.message
    });
  }
});

// Endpoint לעדכון סטטוס ניתוח
app.put('/api/analysis/:id/status', (req, res) => {
  smartLog('info', 'Analysis status update request started');
  
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!id || !status) {
      return res.status(400).json({
        error: 'חסרים פרמטרים נדרשים: id, status'
      });
    }
    
    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({
        error: 'סטטוס לא חוקי. חייב להיות: pending או completed'
      });
    }
    
    const dailyData = loadDailyAnalyses();
    const analysisIndex = dailyData.analyses.findIndex(a => a.id === id);
    
    if (analysisIndex === -1) {
      return res.status(404).json({
        error: 'ניתוח לא נמצא'
      });
    }
    
    // Update analysis status
    dailyData.analyses[analysisIndex].status = status;
    dailyData.analyses[analysisIndex].completedAt = status === 'completed' ? new Date().toISOString() : null;
    
    if (saveDailyAnalyses(dailyData)) {
      smartLog('info', 'Analysis status updated', { analysisId: id, newStatus: status });
      
      res.json({
        success: true,
        message: `סטטוס ניתוח עודכן ל-${status}`,
        analysis: dailyData.analyses[analysisIndex]
      });
    } else {
      res.status(500).json({
        error: 'שגיאה בשמירת עדכון הסטטוס'
      });
    }
    
  } catch (error) {
    console.error('❌ שגיאה בעדכון סטטוס ניתוח:', error);
    res.status(500).json({
      error: 'שגיאה בעדכון סטטוס ניתוח: ' + error.message
    });
  }
});

// Endpoint למחיקת ניתוח
app.delete('/api/analysis/:id', (req, res) => {
  smartLog('info', 'Analysis deletion request started');
  
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'חסר מזהה ניתוח'
      });
    }
    
    // Search through all daily analysis files to find the analysis
    const analysesDir = path.join(__dirname, 'daily_analyses');
    let foundAnalysis = null;
    let targetFile = null;
    
    if (fs.existsSync(analysesDir)) {
      const files = fs.readdirSync(analysesDir);
      
      for (const file of files) {
        if (file.startsWith('analyses_') && file.endsWith('.json')) {
          const filePath = path.join(analysesDir, file);
          try {
            const data = fs.readFileSync(filePath, 'utf8');
            const dailyData = JSON.parse(data);
            
            const analysisIndex = dailyData.analyses.findIndex(a => a.id === id);
            if (analysisIndex !== -1) {
              foundAnalysis = dailyData.analyses[analysisIndex];
              targetFile = { filePath, dailyData, analysisIndex };
              break;
            }
          } catch (error) {
            console.warn(`⚠️ שגיאה בקריאת קובץ ${file}:`, error);
          }
        }
      }
    }
    
    if (!foundAnalysis || !targetFile) {
      return res.status(404).json({
        error: 'ניתוח לא נמצא בשום תאריך'
      });
    }
    
    // Remove analysis from array
    const deletedAnalysis = targetFile.dailyData.analyses.splice(targetFile.analysisIndex, 1)[0];
    
    // Save the updated file
    try {
      fs.writeFileSync(targetFile.filePath, JSON.stringify(targetFile.dailyData, null, 2), 'utf8');
      smartLog('info', 'Analysis deleted', { analysisId: id, reporterName: deletedAnalysis.reporterName });
      
      res.json({
        success: true,
        message: 'ניתוח נמחק בהצלחה',
        deletedAnalysis: {
          id: deletedAnalysis.id,
          reporterName: deletedAnalysis.reporterName,
          videoDate: deletedAnalysis.videoDate
        }
      });
    } catch (saveError) {
      console.error('❌ שגיאה בשמירת קובץ לאחר מחיקה:', saveError);
      res.status(500).json({
        error: 'שגיאה בשמירת הקובץ לאחר מחיקה'
      });
    }
    
  } catch (error) {
    console.error('❌ שגיאה במחיקת ניתוח:', error);
    res.status(500).json({
      error: 'שגיאה במחיקת ניתוח: ' + error.message
    });
  }
});

// === File Watcher System ===

// Settings storage
const settingsFile = path.join(__dirname, 'watcher-settings.json');
let watcherSettings = {
  watchFolder: '',
  isEnabled: false,
  processedFiles: [], // Track processed files to avoid duplicates
  selectedModel: 'gemini-2.5-pro' // Default to Pro model for watcher
};

// Track files currently being processed to avoid duplicate processing
const currentlyProcessing = new Set();

// Load watcher settings on startup
function loadWatcherSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      const data = fs.readFileSync(settingsFile, 'utf8');
      watcherSettings = { ...watcherSettings, ...JSON.parse(data) };
      smartLog('info', 'Watcher settings loaded', { folder: watcherSettings.watchFolder });
    }
  } catch (error) {
    smartLog('error', 'Failed to load watcher settings', { error: error.message });
  }
}

// Save watcher settings
function saveWatcherSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(watcherSettings, null, 2));
    smartLog('info', 'Watcher settings saved');
    return true;
  } catch (error) {
    console.error('❌ שגיאה בשמירת הגדרות:', error);
    return false;
  }
}

// Check if video file meets criteria
// Helper function to log file processing decisions
function logFileProcessing(filename, filePath, decision, reason) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    filename,
    filePath,
    decision, // 'processed', 'skipped', 'error'
    reason
  };
  
  // Ensure processing log directory exists
  const logsDir = path.join(__dirname, 'processing_logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
  
  // Create daily log file
  const dateString = getCurrentDateString();
  const logFilePath = path.join(logsDir, `processing_${dateString}.json`);
  
  let logs = [];
  try {
    if (fs.existsSync(logFilePath)) {
      const data = fs.readFileSync(logFilePath, 'utf8');
      logs = JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️ שגיאה בטעינת לוגים קיימים:', error);
  }
  
  logs.push(logEntry);
  
  try {
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8');
    smartLog('debug', 'Watcher log saved', { decision, filename, reason });
  } catch (error) {
    console.error('❌ שגיאה בשמירת לוג:', error);
  }
}

function shouldProcessFile(filename, filePath) {
  try {
    // Check filename pattern: starts with "20_vtr"
    if (!filename.toLowerCase().startsWith('20_vtr')) {
      logFileProcessing(filename, filePath, 'skipped', 'לא מתחיל ב-20_vtr');
      return false;
    }
    
    // Check if file is MP4
    if (!filename.toLowerCase().endsWith('.mp4')) {
      logFileProcessing(filename, filePath, 'skipped', 'לא קובץ MP4');
      return false;
    }
    
    // Check if already processed
    if (watcherSettings.processedFiles.includes(filename)) {
      logFileProcessing(filename, filePath, 'skipped', 'כבר עובד בעבר (כפילות)');
      return false;
    }
    
    // Check if currently being processed
    if (currentlyProcessing.has(filename)) {
      logFileProcessing(filename, filePath, 'skipped', 'נמצא כעת בתהליך עיבוד');
      return false;
    }
    
    // Check file duration (must be > 1 minute)
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('❌ שגיאה בבדיקת אורך הסרטון:', err);
          logFileProcessing(filename, filePath, 'error', `שגיאה בבדיקת מטאדטה: ${err.message}`);
          resolve(false);
          return;
        }
        
        const duration = metadata.format.duration;
        const isLongEnough = duration && duration > 60; // More than 1 minute
        
        if (isLongEnough) {
          logFileProcessing(filename, filePath, 'processed', `אורך מתאים: ${Math.round(duration)}s`);
          smartLog('debug', 'File duration check', { filename, duration, isLongEnough });
        } else {
          logFileProcessing(filename, filePath, 'skipped', `אורך קצר מדי: ${Math.round(duration)}s (נדרש >60s)`);
          smartLog('debug', 'File too short', { filename, duration });
        }
        
        resolve(isLongEnough);
      });
    });
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת קובץ:', error);
    logFileProcessing(filename, filePath, 'error', `שגיאה כללית: ${error.message}`);
    return false;
  }
}

// Process video file automatically
async function processVideoFile(filePath, filename) {
  // Mark as currently processing
  currentlyProcessing.add(filename);
  
  try {
    smartLog('info', 'Automatic processing started', { filename });
    

    
    // Get current date for the analysis
    const currentDate = new Date().toLocaleDateString('he-IL');
    
    // Create form data for analysis
    const formData = {
      reporterName: '', // No reporter name for automatic processing
      videoDate: currentDate,
      selectedModel: watcherSettings.selectedModel || 'gemini-2.5-pro', // Use selected model from settings
      videoFile: {
        path: filePath,
        filename: filename,
        mimetype: 'video/mp4',
        size: fs.statSync(filePath).size
      }
    };
    
    // Process using existing analysis logic
    smartLog('info', 'Sending for automatic analysis');
    const result = await analyzeVideoAutomatically(formData);
    
    if (result.success) {
      smartLog('info', 'Automatic processing completed', { filename });
      
      // Mark as processed only after successful analysis
      watcherSettings.processedFiles.push(filename);
      saveWatcherSettings();
      smartLog('debug', 'File added to processed list', { filename });
      
      // Add to daily analyses
      const analysisData = {
        reporterName: 'עיבוד אוטומטי',
        videoDate: currentDate,
        modelUsed: formData.selectedModel,
        videoSize: formData.videoFile.size,
        processingTime: result.processingTime,
        content: result.content,
        originalFilename: filename,
        filename: filename,
        fileSize: formData.videoFile.size,
        originalPath: filePath // שמור את הנתיב המקורי
      };
      


      addAnalysisToDaily(analysisData);
      smartLog('info', 'Analysis saved to daily file');
      
    } else {
      console.error(`❌ עיבוד אוטומטי נכשל: ${result.error}`);
      // Don't add to processed files if analysis failed
    }
    
  } catch (error) {
    console.error(`❌ שגיאה בעיבוד אוטומטי של ${filename}:`, error);
    // Don't add to processed files if error occurred
  } finally {
    // Remove from currently processing list
    currentlyProcessing.delete(filename);
    smartLog('debug', 'File removed from processing list', { filename });
  }
}

// Automatic analysis function (uses the same full prompt as manual processing)
async function analyzeVideoAutomatically(formData) {
  const startTime = Date.now();
  
  try {
    // Get the generative model (use selected model from settings)
    const model = genAI.getGenerativeModel({ 
      model: formData.selectedModel || 'gemini-2.5-pro'
    });
    
    // Convert video file
    const videoPart = fileToGenerativePart(formData.videoFile.path, formData.videoFile.mimetype);
    
    // Use the same detailed Hebrew prompt as manual analysis
    const prompt = createAnalysisPrompt('', formData.videoDate, true);

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
          description: "4 כותרות יוטיוב מושכות ומעניינות לסרטון"
        },
        descriptions: {
          type: "array", 
          items: { type: "string" },
          description: `2 תיאורים לסרטון. חובה מוחלטת: כל תיאור חייב להסתיים בדיוק במשפט 'כתבתו/כתבתה של [שם הכתב שזיהית מהסרטון] מתוך מהדורת כאן חדשות, ${formData.videoDate}.' - ללא חריגות!`
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
    
    smartLog('info', 'Sending request to Gemini model with JSON Schema');
    
    let parsedContent;
    let attempts = 0;
    const maxAttempts = 3;
    
    // נסה עד 3 פעמים לקבל JSON תקין
    while (attempts < maxAttempts) {
      attempts++;
      smartLog('debug', 'Analysis attempt', { attempt: attempts, maxAttempts });
      
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
        smartLog('info', 'Response received from model', { contentLength: generatedContent.length });
        
        // אם זה thinking model, חפש את ה-JSON האחרון בתוכן
        if (generatedContent.includes('```json') || generatedContent.includes('{')) {
          smartLog('debug', 'Thinking model detected - searching for final JSON');
          
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
          
          if (jsonBlocks.length > 0) {
            smartLog('debug', 'Final JSON found in automatic analysis', { contentLength: jsonBlocks[jsonBlocks.length - 1].length });
            generatedContent = jsonBlocks[jsonBlocks.length - 1]; // קח את האחרון
          }
        }
        
        // נסה לפרסר את ה-JSON
        parsedContent = JSON.parse(generatedContent);
        smartLog('info', 'JSON parsed successfully');
        smartLog('debug', 'Content structure', {
          summary: !!parsedContent.summary,
          titles: parsedContent.titles?.length || 0,
          descriptions: parsedContent.descriptions?.length || 0,
          thumbnails: parsedContent.thumbnails?.length || 0
        });
        
        break; // הצלחנו - צא מהלולאה
        
      } catch (error) {
        smartLog('error', 'Analysis attempt failed', { attempt: attempts, error: error.message });
        if (attempts >= maxAttempts) {
          throw new Error(`כשל בכל הניסיונות לקבל JSON תקין: ${error.message}`);
        }
        // המתן קצת לפני הניסיון הבא
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      success: true,
      content: parsedContent,
      processingTime: processingTime
    };
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח אוטומטי:', error);
    return {
      success: false,
      error: error.message
    };
  }
}



// File watcher instance
let fileWatcher = null;

// Start file watcher
function startFileWatcher() {
  if (!watcherSettings.watchFolder || !watcherSettings.isEnabled) {
    smartLog('warn', 'File watcher not enabled or path not configured');
    return;
  }
  
  if (!fs.existsSync(watcherSettings.watchFolder)) {
    console.error('❌ תיקיית מעקב לא קיימת:', watcherSettings.watchFolder);
    return;
  }
  
  // Stop existing watcher if running
  if (fileWatcher) {
    fileWatcher.close();
  }
  
  smartLog('info', 'File watcher started', { folder: watcherSettings.watchFolder });
  
  fileWatcher = chokidar.watch(watcherSettings.watchFolder, {
    ignored: /[\/\\]\./, // ignore dotfiles
    persistent: true,
    ignoreInitial: true, // Don't process existing files on startup
    usePolling: true,    // חובה לרשת
    interval: 300000,    // כל 5 דקות - הגיוני לרשת
  });
  
  fileWatcher.on('add', async (filePath) => {
    const filename = path.basename(filePath);
    smartLog('info', 'New file detected', { filename, path: filePath });
    
    // Check if file meets criteria
    const shouldProcess = await shouldProcessFile(filename, filePath);
    
    if (shouldProcess) {
      smartLog('info', 'File processing started', { filename });
      await processVideoFile(filePath, filename);
    } else {
      smartLog('debug', 'File skipped', { filename, reason: 'does not meet criteria' });
    }
  });
  
  fileWatcher.on('error', (error) => {
    smartLog('error', 'File watcher error', { error: error.message });
  });
}

// Stop file watcher
function stopFileWatcher() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    smartLog('info', 'File watcher stopped');
  }
}

// Load settings on startup
loadWatcherSettings();

// API endpoints for watcher settings

// Get watcher settings
app.get('/api/watcher/settings', (req, res) => {
  res.json({
    success: true,
    settings: {
      watchFolder: watcherSettings.watchFolder,
      isEnabled: watcherSettings.isEnabled,
      processedFilesCount: watcherSettings.processedFiles.length,
      selectedModel: watcherSettings.selectedModel
    }
  });
});

// Update watcher settings
app.post('/api/watcher/settings', (req, res) => {
  try {
    const { watchFolder, isEnabled, selectedModel } = req.body;
    
    if (watchFolder !== undefined) {
      watcherSettings.watchFolder = watchFolder;
    }
    
    if (isEnabled !== undefined) {
      watcherSettings.isEnabled = isEnabled;
    }
    
    if (selectedModel !== undefined) {
      watcherSettings.selectedModel = selectedModel;
    }
    
    if (saveWatcherSettings()) {
      // Restart watcher if enabled
      if (watcherSettings.isEnabled) {
        startFileWatcher();
      } else {
        stopFileWatcher();
      }
      
      res.json({
        success: true,
        message: 'הגדרות עודכנו בהצלחה',
        settings: {
          watchFolder: watcherSettings.watchFolder,
          isEnabled: watcherSettings.isEnabled,
          selectedModel: watcherSettings.selectedModel
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'שגיאה בשמירת הגדרות'
      });
    }
    
  } catch (error) {
    console.error('❌ שגיאה בעדכון הגדרות מעקב:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון הגדרות: ' + error.message
    });
  }
});

// Get watcher status
app.get('/api/watcher/status', (req, res) => {
  res.json({
    success: true,
    status: {
      isRunning: !!fileWatcher,
      isEnabled: watcherSettings.isEnabled,
      watchFolder: watcherSettings.watchFolder,
      processedFilesCount: watcherSettings.processedFiles.length,
      lastProcessedFiles: watcherSettings.processedFiles.slice(-5), // Last 5 files
      selectedModel: watcherSettings.selectedModel
    }
  });
});

// Clear processed files list
app.post('/api/watcher/clear-processed', (req, res) => {
  try {
    watcherSettings.processedFiles = [];
    if (saveWatcherSettings()) {
      res.json({
        success: true,
        message: 'רשימת קבצים מעובדים נמחקה'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'שגיאה בשמירת הגדרות'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'שגיאה במחיקת רשימה: ' + error.message
    });
  }
});

// Get processing logs
app.get('/api/watcher/logs', (req, res) => {
  try {
    const dateString = getCurrentDateString();
    const logsDir = path.join(__dirname, 'processing_logs');
    const logFilePath = path.join(logsDir, `processing_${dateString}.json`);
    
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      const data = fs.readFileSync(logFilePath, 'utf8');
      logs = JSON.parse(data);
    }
    
    // Get summary stats
    const stats = {
      total: logs.length,
      processed: logs.filter(log => log.decision === 'processed').length,
      skipped: logs.filter(log => log.decision === 'skipped').length,
      errors: logs.filter(log => log.decision === 'error').length,
      duplicates: logs.filter(log => log.reason.includes('כפילות')).length
    };
    
    res.json({
      success: true,
      logs: logs.reverse(), // Most recent first
      stats,
      date: dateString
    });
    
  } catch (error) {
    console.error('❌ שגיאה בטעינת לוגים:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בטעינת לוגים: ' + error.message
    });
  }
});

// Start watcher if enabled on startup
if (watcherSettings.isEnabled) {
  setTimeout(() => {
    startFileWatcher();
  }, 2000); // Wait 2 seconds after server start
}

// === End File Watcher System ===



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'השרת פועל תקין' });
});

// Catch-all handler: serve React app for any non-API routes  
app.use((req, res, next) => {
  // If it's an API route, let it fall through to 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  // Otherwise serve the React app
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  smartLog('info', 'Server started successfully', {
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    networkUrl: `http://[YOUR_IP]:${PORT}`,
    apiKeyConfigured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
  });
  
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🏠 Local: http://localhost:${PORT}`);
  console.log(`🏢 Network: http://[YOUR_IP]:${PORT}`);
  console.log(`🤖 Gemini API: ${!!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'Configured' : 'Missing'}`);
}); 