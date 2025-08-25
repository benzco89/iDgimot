import { useState, useEffect } from 'react';

interface Analysis {
  id: string;
  timestamp: string;
  reporterName: string;
  videoDate: string;
  modelUsed: string;
  videoSize: string;
  processingTime: number;
  content: {
    summary: string;
    titles: string[];
    descriptions: string[];
    thumbnails: Array<{
      timestamp: string;
      description: string;
    }>;
  };
  status: 'pending' | 'completed';
  completedAt: string | null;
  originalFilename?: string;
  filename?: string;
  fileSize?: string;
}

interface DailyAnalysesResponse {
  success: boolean;
  date: string;
  analyses: Analysis[];
  totalCount: number;
  pendingCount: number;
  completedCount: number;
}

interface AvailableDate {
  date: string;
  displayDate: string;
  analysisCount: number;
  lastModified: string;
}

interface AnalysisListProps {
  onAnalysisSelect: (analysis: Analysis) => void;
  selectedAnalysisId?: string;
  refreshTrigger?: number; // To trigger refresh when new analysis is added
}

const AnalysisList: React.FC<AnalysisListProps> = ({ 
  onAnalysisSelect, 
  selectedAnalysisId, 
  refreshTrigger 
}) => {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalCount: 0, pendingCount: 0, completedCount: 0 });
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());



  // Load available dates
  const loadAvailableDates = async () => {
    try {
      setDatesLoading(true);
      
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/available-dates` : '/api/available-dates';

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('שגיאה בטעינת תאריכים');
      }

      const data = await response.json();
      
      if (data.success) {
        // Calculate one week ago
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(today.getDate() - 7);
        
        // Filter dates to show only last week
        const filteredDates = data.dates.filter((dateInfo: AvailableDate) => {
          const analysisDate = new Date(dateInfo.date);
          return analysisDate >= oneWeekAgo;
        });
        
        setAvailableDates(filteredDates);
        setCurrentDate(data.currentDate);
        // Set selected date to current date if not already set
        if (!selectedDate) {
          setSelectedDate(data.currentDate);
        }
      }
    } catch (err) {
      console.error('Error loading available dates:', err);
    } finally {
      setDatesLoading(false);
    }
  };

  // Load analyses from server
  const loadAnalyses = async (dateToLoad?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Use environment-aware API URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      let apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/daily-analyses` : '/api/daily-analyses';
      
      // Add date parameter if specified
      if (dateToLoad) {
        apiUrl += `?date=${dateToLoad}`;
      }

      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('שגיאה בטעינת ניתוחים');
      }

      const data: DailyAnalysesResponse = await response.json();
      
      if (data.success) {
        setAnalyses(data.analyses);
        setStats({
          totalCount: data.totalCount,
          pendingCount: data.pendingCount,
          completedCount: data.completedCount
        });
        setCurrentDate(data.date);
        setLastRefreshTime(new Date());
      } else {
        throw new Error('שגיאה בטעינת נתונים');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה');
      console.error('Error loading analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete analysis
  const deleteAnalysis = async (analysisId: string, analysisName: string) => {
    console.log('🗑️ מתחיל מחיקת ניתוח:', analysisId, analysisName);
    
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הניתוח "${analysisName}"?`)) {
      console.log('❌ מחיקה בוטלה על ידי המשתמש');
      return;
    }

    try {
      // Use environment-aware API URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/analysis/${analysisId}` : `/api/analysis/${analysisId}`;
      
      console.log('🔗 שולח בקשת מחיקה ל:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'DELETE',
      });

      console.log('📡 תגובת שרת:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ שגיאה בתגובה:', errorData);
        throw new Error(`שגיאה במחיקת ניתוח: ${response.status}`);
      }

      const data = await response.json();
      console.log('📄 נתוני תגובה:', data);
      
      if (data.success) {
        console.log('✅ מחיקה הצליחה, מעדכן state מקומי');
        
        // Remove from local state
        setAnalyses(prev => {
          const newAnalyses = prev.filter(analysis => analysis.id !== analysisId);
          console.log('📊 רשימה לפני מחיקה:', prev.length, 'אחרי מחיקה:', newAnalyses.length);
          return newAnalyses;
        });
        
        // Update stats
        const deletedAnalysis = analyses.find(a => a.id === analysisId);
        if (deletedAnalysis) {
          console.log('📈 מעדכן סטטיסטיקות לאחר מחיקה');
          setStats(prev => ({
            totalCount: prev.totalCount - 1,
            pendingCount: prev.pendingCount - (deletedAnalysis.status === 'pending' ? 1 : 0),
            completedCount: prev.completedCount - (deletedAnalysis.status === 'completed' ? 1 : 0)
          }));
        }
        
        console.log('✅ ניתוח נמחק בהצלחה:', data.message);
        alert('ניתוח נמחק בהצלחה!');
      } else {
        console.error('❌ שרת החזיר success: false');
        throw new Error(data.message || 'מחיקה נכשלה');
      }
    } catch (err) {
      console.error('❌ שגיאה במחיקת ניתוח:', err);
      alert('שגיאה במחיקת הניתוח. נסה שוב. ' + (err instanceof Error ? err.message : ''));
    }
  };



  // Update analysis status
  const updateAnalysisStatus = async (analysisId: string, newStatus: 'pending' | 'completed') => {
    try {
      // Use environment-aware API URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/analysis/${analysisId}/status` : `/api/analysis/${analysisId}/status`;

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('שגיאה בעדכון סטטוס');
      }

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setAnalyses(prev => prev.map(analysis => 
          analysis.id === analysisId 
            ? { ...analysis, status: newStatus, completedAt: data.analysis.completedAt }
            : analysis
        ));
        
        // Update stats
        setStats(prev => ({
          ...prev,
          pendingCount: prev.pendingCount + (newStatus === 'pending' ? 1 : -1),
          completedCount: prev.completedCount + (newStatus === 'completed' ? 1 : -1)
        }));
      }
    } catch (err) {
      console.error('Error updating analysis status:', err);
      // You might want to show a toast notification here
    }
  };

  // Handle date selection change
  const handleDateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    loadAnalyses(newDate);
  };

  // Load available dates on component mount
  useEffect(() => {
    loadAvailableDates();
  }, []);

  // Load analyses when selectedDate changes or refreshTrigger changes
  useEffect(() => {
    if (selectedDate) {
      loadAnalyses(selectedDate);
    }
  }, [selectedDate, refreshTrigger]);

  // Auto-refresh every 3-5 minutes to avoid disrupting user experience
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedDate) {
        // Refresh every 3 minutes if there are pending analyses, every 5 minutes if not
        loadAnalyses(selectedDate);
      }
    }, stats.pendingCount > 0 ? 180000 : 300000); // 3 minutes or 5 minutes
    return () => clearInterval(interval);
  }, [selectedDate, stats.pendingCount]);

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('he-IL', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Format file size for display
  const formatFileSize = (fileSize?: string) => {
    if (!fileSize) return '';
    const size = parseFloat(fileSize);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="mr-2 text-gray-600">טוען ניתוחים...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className="text-4xl mb-3">⚠️</div>
          <h4 className="text-lg font-medium text-gray-700 mb-2">בעיה בטעינת הניתוחים</h4>
          <p className="text-base text-gray-500 mb-4">נסה לרענן או בדוק את החיבור</p>
          <button
            onClick={() => loadAnalyses(selectedDate)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            🔄 נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold text-gray-800">
              ניתוחים יומיים
            </h2>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isMinimized ? "הרחב רשימה" : "מזער רשימה"}
          >
            {isMinimized ? (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
        {!isMinimized && (
          <div className="mb-4">
            <p className="text-gray-600 text-sm mb-2">
              תאריך הניתוחים:
            </p>
            {datesLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                טוען תאריכים...
              </div>
            ) : (
              <select
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {availableDates.map((dateInfo) => {
                  const today = new Date().toISOString().split('T')[0];
                  return (
                    <option key={dateInfo.date} value={dateInfo.date}>
                      {dateInfo.displayDate} ({dateInfo.analysisCount} ניתוחים)
                      {dateInfo.date === today ? ' - היום' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        )}
        
        {/* Stats */}
        {!isMinimized && (
          <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-2xl font-bold text-blue-600">{stats.totalCount}</div>
            <div className="text-xs text-blue-600">סה״כ</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2">
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
            <div className="text-xs text-yellow-600">ממתין</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-2xl font-bold text-green-600">{stats.completedCount}</div>
            <div className="text-xs text-green-600">בוצע</div>
          </div>
          </div>
        )}
      </div>

      {/* Analyses List */}
      {!isMinimized && (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {analyses.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-3">📊</div>
            <h4 className="text-lg font-medium text-gray-700 mb-2">אין ניתוחים עדיין</h4>
            <p className="text-base text-gray-500">הניתוחים יופיעו כאן אוטומטיקלי</p>
          </div>
        ) : (
          analyses.map((analysis) => (
            <div
              key={analysis.id}
              className={`p-3 border border-gray-200 rounded-md transition-colors ${
                selectedAnalysisId === analysis.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
              }`}
            >
              {/* Main content row */}
              <div className="flex items-center justify-between mb-1.5">
                <div 
                  className="flex items-center flex-1 cursor-pointer"
                  onClick={() => onAnalysisSelect(analysis)}
                >
                  <span className="font-medium text-gray-800 text-sm">
                    {analysis.originalFilename || analysis.filename || `קובץ_${analysis.id.split('_')[1]}`}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-gray-500">
                    {formatFileSize(analysis.fileSize)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnalysis(analysis.id, analysis.originalFilename || analysis.filename || `קובץ_${analysis.id.split('_')[1]}`);
                    }}
                    className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="מחק ניתוח"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Status and controls row */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="text-gray-500">
                    {formatTime(analysis.timestamp)}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500">
                    {analysis.modelUsed}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded text-xs ${
                    analysis.reporterName === 'עיבוד אוטומטי'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}>
                    {analysis.reporterName === 'עיבוד אוטומטי'
                      ? '🤖'
                      : '👤'
                    }
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* תיבת סימון לסטטוס */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newStatus = analysis.status === 'completed' ? 'pending' : 'completed';
                      updateAnalysisStatus(analysis.id, newStatus);
                    }}
                    className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-all duration-200 hover:scale-105 ${
                      analysis.status === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-white border-gray-400 hover:border-gray-600'
                    }`}
                    title={analysis.status === 'completed' ? 'בוצע - לחץ לסמן כממתין' : 'ממתין - לחץ לסמן כבוצע'}
                  >
                    {analysis.status === 'completed' && (
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    )}
                  </button>
                  
                  {/* תווית סטטוס */}
                  <span className={`text-xs ${
                    analysis.status === 'completed' 
                      ? 'text-green-600' 
                      : 'text-yellow-600'
                  }`}>
                    {analysis.status === 'completed' ? 'בוצע' : 'ממתין'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={() => loadAnalyses(selectedDate)}
          className="w-full px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
        >
          🔄 רענן רשימה
        </button>
        <p className="text-xs text-gray-400 text-center mt-1">
          עדכון אחרון: {lastRefreshTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>


    </div>
  );
};

export default AnalysisList; 