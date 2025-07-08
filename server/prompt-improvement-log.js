// מעקב אחר שיפורי פרומפט והשפעתם
const fs = require('fs');
const path = require('path');

const PROMPT_LOG_FILE = path.join(__dirname, 'prompt-improvements.json');

// רישום שיפור פרומפט
function logPromptImprovement(improvementData) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...improvementData
  };

  let log = [];
  try {
    if (fs.existsSync(PROMPT_LOG_FILE)) {
      log = JSON.parse(fs.readFileSync(PROMPT_LOG_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('שגיאה בקריאת קובץ הלוג:', error);
  }

  log.push(logEntry);

  try {
    fs.writeFileSync(PROMPT_LOG_FILE, JSON.stringify(log, null, 2));
    console.log(`✅ שיפור פרומפט נרשם: ${improvementData.version}`);
  } catch (error) {
    console.error('שגיאה בכתיבת לוג שיפור:', error);
  }
}

// רישום השיפור הנוכחי
const currentImprovement = {
  version: 'v2.0',
  changes: [
    'הוספת הוראות ספציפיות לכותרות (40-60 תווים)',
    'הרחבת התיאורים עם קריאה לפעולה והקשר',
    'שיפור הוראות thumbnails - דגש על ויזואליה דרמטית',
    'הוספת thumbnail שלישי כאופציה',
    'הוראות נגד סנסציוניות מוגזמת'
  ],
  basedOnFeedback: {
    totalFeedbacks: 27,
    negativePercentage: 48.1,
    mainIssues: [
      'תוכן קצר מדי',
      'בעיות בתיאורים', 
      'בעיות בתמונות thumbnail'
    ],
    mainSuccesses: [
      'הצלחות בכותרות'
    ]
  },
  expectedImprovements: [
    'כותרות מעוצבות יותר באורך מתאים',
    'תיאורים ארוכים יותר עם קריאה לפעולה',
    'thumbnails ויזואליים יותר',
    'תוכן איכותי ומקצועי יותר'
  ]
};

logPromptImprovement(currentImprovement);

module.exports = { logPromptImprovement }; 