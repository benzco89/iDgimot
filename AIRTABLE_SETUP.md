# מדריך הגדרת Airtable לשמירת פידבק

## שלב 1: יצירת חשבון Airtable

1. היכנס ל-[Airtable.com](https://airtable.com) וצור חשבון חינמי
2. לחץ על "Create a base" או "צור בסיס חדש"

## שלב 2: יצירת הטבלה

1. צור Base חדש עם השם "Kan News Feedback"
2. שנה את שם הטבלה ל-"Feedback"
3. צור את העמודות הבאות:

| שם העמודה | סוג | תיאור |
|-----------|-----|--------|
| Content Type | Single select | title, description, thumbnail |
| Content Text | Long text | הטקסט של הכותרת/תיאור |
| Feedback | Single select | like, dislike |
| Explanation | Long text | הסבר המשתמש |
| Reporter | Single line text | שם הכתב |
| Video Date | Single line text | תאריך הסרטון |
| Timestamp | Date & time | זמן שליחת הפידבק |
| Feedback ID | Single line text | מזהה ייחודי |

## שלב 3: קבלת API Key

1. לחץ על התמונה שלך בפינה השמאלית עליונה
2. בחר "Developer hub"
3. לחץ על "Create new token"
4. תן לו שם כמו "Kan News Feedback"
5. בחר scope: `data.records:read` ו-`data.records:write`
6. בחר את ה-Base שיצרת
7. העתק את ה-token

## שלב 4: קבלת Base ID

1. לך ל-[Airtable API Documentation](https://airtable.com/developers/web/api/introduction)
2. בחר את ה-Base שלך
3. תראה את ה-Base ID בכתובת או בדוקומנטציה
4. זה נראה כמו: `appXXXXXXXXXXXXXX`

## שלב 5: הגדרת המשתנים

ערוך את הקובץ `server/.env` והוסף:

```env
AIRTABLE_API_KEY=patXXXXXXXXXXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
```

## שלב 6: הפעלה מחדש

הפעל מחדש את השרת:

```bash
cd server
npm start
```

אמור להופיע: `✅ Airtable מוכן לשימוש`

## בדיקה

כשתשלח פידבק באפליקציה, תראה את הנתונים מופיעים ב-Airtable בזמן אמת!

## היתרונות

- ✅ **תצוגה נוחה** של כל הפידבק
- ✅ **מיון וסינון** לפי כותרות טובות/רעות  
- ✅ **ייצוא לExcel** לצורך ניתוח
- ✅ **שיתוף** עם חברי צוות
- ✅ **אף פעם לא נכבה** - יציב לחלוטין 