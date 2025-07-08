const Airtable = require('airtable');
require('dotenv').config();

// Initialize Airtable
let airtableBase = null;
if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
  Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_API_KEY
  });
  airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID);
} else {
  console.error('❌ Airtable לא מוגדר - בדוק את המשתנים AIRTABLE_API_KEY ו-AIRTABLE_BASE_ID');
  process.exit(1);
}

async function analyzeFeedback() {
  console.log('🔍 מתחיל ניתוח נתוני פידבק מ-Airtable...\n');

  try {
    // קבלת כל רשומות הפידבק
    const records = await airtableBase('Feedback').select({
      // Sort by newest first
      sort: [{field: 'Timestamp', direction: 'desc'}]
    }).all();

         console.log(`📊 נמצאו ${records.length} רשומות פידבק\n`);

    if (records.length === 0) {
      console.log('💡 אין נתוני פידבק לניתוח עדיין');
      return;
    }

    // הצגת דוגמאות פידבק גולמיות לבדיקה
    console.log('🔍 דוגמאות פידבק גולמיות (5 ראשונות):');
    console.log('================================================');
    records.slice(0, 5).forEach((record, index) => {
      const fields = record.fields;
      console.log(`\n${index + 1}. רשומה מ-${new Date(fields['Timestamp']).toLocaleDateString('he-IL')}:`);
      console.log(`   סוג תוכן: "${fields['Content Type']}"`);
      console.log(`   פידבק: "${fields['Feedback']}"`);
      console.log(`   תוכן: "${fields['Content Text']?.substring(0, 150)}..."`);
      console.log(`   הסבר: "${fields['Explanation'] || 'ללא הסבר'}"`);
      console.log(`   כתב: "${fields['Reporter'] || 'לא מוגדר'}"`);
    });
    console.log('\n================================================\n');

    // ניתוח הנתונים
    const analysis = {
      totalFeedback: records.length,
      byContentType: {},
      byFeedback: {},
      commonIssues: {},
      suggestions: []
    };

    // קטגוריזציה לפי סוג תוכן
    records.forEach(record => {
      const fields = record.fields;
      const contentType = fields['Content Type'] || 'לא מוגדר';
      const feedback = fields['Feedback'] || 'לא מוגדר';
      const explanation = fields['Explanation'] || '';

      // ספירה לפי סוג תוכן
      analysis.byContentType[contentType] = (analysis.byContentType[contentType] || 0) + 1;

      // ספירה לפי סוג פידבק
      analysis.byFeedback[feedback] = (analysis.byFeedback[feedback] || 0) + 1;

             // חיפוש דפוסים בהסברים - לכל סוגי הפידבק
       if (explanation) {
         const lowerExplanation = explanation.toLowerCase();
         
         // בעיות ספציפיות (גם לפידבק שלילי וגם חיובי)
         if (lowerExplanation.includes('כותרת') || lowerExplanation.includes('כותרות')) {
           const key = feedback === 'dislike' ? 'בעיות בכותרות' : 'הצלחות בכותרות';
           analysis.commonIssues[key] = (analysis.commonIssues[key] || 0) + 1;
         }
         if (lowerExplanation.includes('תיאור') || lowerExplanation.includes('תיאורים')) {
           const key = feedback === 'dislike' ? 'בעיות בתיאורים' : 'הצלחות בתיאורים';
           analysis.commonIssues[key] = (analysis.commonIssues[key] || 0) + 1;
         }
         if (lowerExplanation.includes('תמונה') || lowerExplanation.includes('תמונות') || lowerExplanation.includes('ת\'מבנייל')) {
           const key = feedback === 'dislike' ? 'בעיות בתמונות thumbnail' : 'הצלחות בתמונות thumbnail';
           analysis.commonIssues[key] = (analysis.commonIssues[key] || 0) + 1;
         }
         
         // דפוסי בעיות ספציפיות
         if (feedback === 'dislike') {
           if (lowerExplanation.includes('קצר') || lowerExplanation.includes('לא מפורט')) {
             analysis.commonIssues['תוכן קצר מדי'] = (analysis.commonIssues['תוכן קצר מדי'] || 0) + 1;
           }
           if (lowerExplanation.includes('ארוך') || lowerExplanation.includes('מפורט מדי')) {
             analysis.commonIssues['תוכן ארוך מדי'] = (analysis.commonIssues['תוכן ארוך מדי'] || 0) + 1;
           }
           if (lowerExplanation.includes('לא רלוונטי') || lowerExplanation.includes('לא מתאים')) {
             analysis.commonIssues['תוכן לא רלוונטי'] = (analysis.commonIssues['תוכן לא רלוונטי'] || 0) + 1;
           }
           if (lowerExplanation.includes('משעמם') || lowerExplanation.includes('לא מעניין')) {
             analysis.commonIssues['תוכן משעמם'] = (analysis.commonIssues['תוכן משעמם'] || 0) + 1;
           }
           if (lowerExplanation.includes('לא מדויק') || lowerExplanation.includes('שגוי')) {
             analysis.commonIssues['אי דיוק בתוכן'] = (analysis.commonIssues['אי דיוק בתוכן'] || 0) + 1;
           }
         }
       }
    });

    // הצגת התוצאות
    console.log('📈 סיכום הפידבק:');
    console.log('================');
    console.log(`סה"כ פידבקים: ${analysis.totalFeedback}`);
    
    console.log('\n🎯 פידבק לפי סוג תוכן:');
    Object.entries(analysis.byContentType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        const percentage = ((count / analysis.totalFeedback) * 100).toFixed(1);
        console.log(`  ${type}: ${count} (${percentage}%)`);
      });

    console.log('\n👍👎 פידבק לפי דירוג:');
    Object.entries(analysis.byFeedback)
      .sort(([,a], [,b]) => b - a)
      .forEach(([feedback, count]) => {
        const percentage = ((count / analysis.totalFeedback) * 100).toFixed(1);
        const emoji = feedback === 'מצוין' ? '🟢' : feedback === 'טוב' ? '🟡' : '🔴';
        console.log(`  ${emoji} ${feedback}: ${count} (${percentage}%)`);
      });

         console.log('\n⚠️ דפוסים בפידבק:');
     if (Object.keys(analysis.commonIssues).length === 0) {
       console.log('  לא נמצאו דפוסים בפידבק');
     } else {
       // הפרדה בין בעיות והצלחות
       const issues = {};
       const successes = {};
       
       Object.entries(analysis.commonIssues).forEach(([key, value]) => {
         if (key.includes('בעיות') || !key.includes('הצלחות')) {
           issues[key] = value;
         } else {
           successes[key] = value;
         }
       });
       
       if (Object.keys(issues).length > 0) {
         console.log('\n🔴 בעיות נפוצות:');
         Object.entries(issues)
           .sort(([,a], [,b]) => b - a)
           .forEach(([issue, count]) => {
             console.log(`  • ${issue}: ${count} פעמים`);
           });
       }
       
       if (Object.keys(successes).length > 0) {
         console.log('\n🟢 הצלחות נפוצות:');
         Object.entries(successes)
           .sort(([,a], [,b]) => b - a)
           .forEach(([success, count]) => {
             console.log(`  • ${success}: ${count} פעמים`);
           });
       }
     }

    // המלצות לשיפור הפרומפט
    console.log('\n💡 המלצות לשיפור הפרומפט:');
    console.log('=====================================');

         const negativePercentage = ((analysis.byFeedback['dislike'] || 0) / analysis.totalFeedback) * 100;
     const positivePercentage = ((analysis.byFeedback['like'] || 0) / analysis.totalFeedback) * 100;
    
    if (negativePercentage > 30) {
      console.log('🚨 שיעור גבוה של פידבק שלילי - נדרש שיפור משמעותי');
      
      // המלצות ספציפיות לפי הבעיות הנפוצות
      Object.entries(analysis.commonIssues)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3) // 3 הבעיות הנפוצות ביותר
        .forEach(([issue, count]) => {
          switch(issue) {
            case 'בעיות בכותרות':
              console.log('📝 שפר הוראות לכותרות: הוסף דגשים על סקרנות, מילות מפתח, ואורך אופטימלי');
              break;
            case 'בעיות בתיאורים':
              console.log('📄 שפר הוראות לתיאורים: הוסף דגשים על קריאה לפעולה וקישור למהדורה');
              break;
            case 'בעיות בתמונות thumbnail':
              console.log('🖼️ שפר בחירת רגעים ויזואליים: הוסף הוראות לבחירת רגעים דרמטיים ומעניינים');
              break;
            case 'תוכן קצר מדי':
              console.log('📏 הוסף הוראות להארכת התוכן ופרטים נוספים');
              break;
            case 'תוכן ארוך מדי':
              console.log('✂️ הוסף הוראות לקיצור ומיקוד בעיקר');
              break;
            case 'תוכן לא רלוונטי':
              console.log('🎯 הוסף הוראות למיקוד בתוכן הרלוונטי לערוץ החדשות');
              break;
          }
        });
    } else if (negativePercentage > 15) {
      console.log('⚠️ יש מקום לשיפור - התמקד בבעיות הנפוצות ביותר');
    } else {
      console.log('✅ הפרומפט עובד טוב! המשך לעקוב ולשפר בהדרגה');
    }

    // פרטי פידבק שלילי לבדיקה ידנית
    const negativeFeedback = records.filter(record => 
      record.fields['Feedback'] === 'לא מספק' && record.fields['Explanation']
    );

    if (negativeFeedback.length > 0) {
      console.log(`\n🔍 דוגמאות פידבק שלילי (${Math.min(5, negativeFeedback.length)} אחרונות):`);
      negativeFeedback.slice(0, 5).forEach((record, index) => {
        const fields = record.fields;
        console.log(`\n${index + 1}. סוג תוכן: ${fields['Content Type']}`);
        console.log(`   תוכן: "${fields['Content Text']?.substring(0, 100)}..."`);
        console.log(`   הסבר: "${fields['Explanation']}"`);
        console.log(`   תאריך: ${new Date(fields['Timestamp']).toLocaleDateString('he-IL')}`);
      });
    }

    console.log('\n📋 מוצע לבדוק את הפידבק המפורט בהזמנה ולעדכן את הפרומפט בהתאם');
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח נתוני Airtable:', error);
  }
}

// הפעלת הניתוח
if (require.main === module) {
  analyzeFeedback();
}

module.exports = { analyzeFeedback }; 