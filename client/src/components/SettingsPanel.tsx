import { useState, useEffect } from 'react';

interface WatcherSettings {
  watchFolder: string;
  isEnabled: boolean;
  processedFilesCount: number;
  selectedModel?: string;
}

interface WatcherStatus {
  isRunning: boolean;
  isEnabled: boolean;
  watchFolder: string;
  processedFilesCount: number;
  lastProcessedFiles: string[];
  selectedModel?: string;
}

interface ProcessingLog {
  timestamp: string;
  filename: string;
  filePath: string;
  decision: 'processed' | 'skipped' | 'error';
  reason: string;
}

interface ProcessingLogs {
  logs: ProcessingLog[];
  stats: {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
    duplicates: number;
  };
  date: string;
}

interface SettingsPanelProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

interface Model {
  name: string;
  description: string;
  speed: string;
  quality: string;
  cost: string;
  recommended: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isMinimized, onToggleMinimize }) => {
  const [settings, setSettings] = useState<WatcherSettings>({
    watchFolder: '',
    isEnabled: false,
    processedFilesCount: 0,
    selectedModel: 'gemini-3-pro-preview' // Default to Gemini 3.0
  });
  const [status, setStatus] = useState<WatcherStatus | null>(null);
  const [logs, setLogs] = useState<ProcessingLogs | null>(null);
  const [tempWatchFolder, setTempWatchFolder] = useState('');
  const [tempSelectedModel, setTempSelectedModel] = useState('gemini-3-pro-preview');
  const [availableModels, setAvailableModels] = useState<Record<string, Model>>({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // API Key test state
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [apiTestMessage, setApiTestMessage] = useState('');
  const [gemini3TestStatus, setGemini3TestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [gemini3TestMessage, setGemini3TestMessage] = useState('');

  // Load settings and status on component mount
  useEffect(() => {
    loadSettings();
    loadStatus();
    loadLogs();
    loadModels();
    
    // Refresh status and logs every 5 seconds
    const interval = setInterval(() => {
      loadStatus();
      loadLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadModels = async () => {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();
      
      if (data.success) {
        setAvailableModels(data.models);
      }
    } catch (error) {
      console.error('שגיאה בטעינת מודלים:', error);
    } finally {
      setModelsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/watcher/settings');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.settings);
        setTempWatchFolder(data.settings.watchFolder);
        setTempSelectedModel(data.settings.selectedModel || 'gemini-3-pro-preview');
      }
    } catch (error) {
      console.error('שגיאה בטעינת הגדרות:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch('/api/watcher/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error('שגיאה בטעינת סטטוס:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/watcher/logs');
      const data = await response.json();
      
      if (data.success) {
        setLogs(data);
      }
    } catch (error) {
      console.error('שגיאה בטעינת לוגים:', error);
    }
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/watcher/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          watchFolder: tempWatchFolder,
          isEnabled: settings.isEnabled,
          selectedModel: tempSelectedModel
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSettings({
          ...settings,
          watchFolder: tempWatchFolder,
          selectedModel: tempSelectedModel
        });
        setMessage({ type: 'success', text: 'הגדרות נשמרו בהצלחה' });
        loadStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: data.error || 'שגיאה בשמירת הגדרות' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'שגיאה בתקשורת עם השרת' });
    } finally {
      setIsLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const toggleWatcher = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/watcher/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isEnabled: !settings.isEnabled
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSettings({
          ...settings,
          isEnabled: !settings.isEnabled
        });
        setMessage({ 
          type: 'success', 
          text: !settings.isEnabled ? 'מעקב קבצים הופעל' : 'מעקב קבצים הופסק' 
        });
        loadStatus(); // Refresh status
      } else {
        setMessage({ type: 'error', text: data.error || 'שגיאה בעדכון מעקב קבצים' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'שגיאה בתקשורת עם השרת' });
    } finally {
      setIsLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Test API Key function
  const testApiKey = async () => {
    setApiTestStatus('testing');
    setApiTestMessage('בודק את מפתח ה-API...');
    
    try {
      const response = await fetch('/api/test-api-key');
      const data = await response.json();
      
      if (data.success) {
        setApiTestStatus('success');
        setApiTestMessage(data.message);
      } else {
        setApiTestStatus('error');
        setApiTestMessage(data.message);
      }
    } catch (error) {
      setApiTestStatus('error');
      setApiTestMessage('שגיאה בחיבור לשרת');
    }
    
    // Reset after 5 seconds
    setTimeout(() => {
      setApiTestStatus('idle');
      setApiTestMessage('');
    }, 5000);
  };

  // Test Gemini 3.0 function
  const testGemini3 = async () => {
    setGemini3TestStatus('testing');
    setGemini3TestMessage('בודק את Gemini 3.0...');
    
    try {
      const response = await fetch('/api/test-gemini3');
      const data = await response.json();
      
      if (data.success) {
        setGemini3TestStatus('success');
        setGemini3TestMessage(data.message);
      } else {
        setGemini3TestStatus('error');
        setGemini3TestMessage(data.message);
      }
    } catch (error) {
      setGemini3TestStatus('error');
      setGemini3TestMessage('שגיאה בחיבור לשרת');
    }
    
    // Reset after 5 seconds
    setTimeout(() => {
      setGemini3TestStatus('idle');
      setGemini3TestMessage('');
    }, 5000);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          הגדרות מעקב קבצים
        </h2>
        <button
          onClick={onToggleMinimize}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={isMinimized ? "הרחב הגדרות" : "מזער הגדרות"}
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
        <div className="space-y-6">
          {/* Status Display */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 mb-3">סטטוס מעקב קבצים</h3>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ml-2 ${status?.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{status?.isRunning ? 'פעיל' : 'לא פעיל'}</span>
            </div>
          </div>

          {/* API Key Test Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
            <h3 className="font-medium text-gray-700 mb-3 flex items-center">
              <svg className="w-5 h-5 ml-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              בדיקת מפתחות API
            </h3>
            
            <div className="flex flex-wrap gap-3">
              {/* Test Standard API Key */}
              <div className="flex-1 min-w-[200px]">
                <button
                  onClick={testApiKey}
                  disabled={apiTestStatus === 'testing'}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
                    apiTestStatus === 'testing' 
                      ? 'bg-gray-300 cursor-wait text-gray-600' 
                      : apiTestStatus === 'success'
                      ? 'bg-green-500 text-white shadow-md'
                      : apiTestStatus === 'error'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm hover:shadow-md'
                  }`}
                >
                  {apiTestStatus === 'testing' ? (
                    <>
                      <svg className="animate-spin h-4 w-4 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      בודק...
                    </> 
                  ) : apiTestStatus === 'success' ? (
                    <>✅ תקין!</>
                  ) : apiTestStatus === 'error' ? (
                    <>❌ שגיאה</>
                  ) : (
                    <>🔑 בדוק API Key</>
                  )}
                </button>
                {apiTestMessage && (
                  <p className={`mt-2 text-xs text-center ${
                    apiTestStatus === 'success' ? 'text-green-600' : 
                    apiTestStatus === 'error' ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {apiTestMessage}
                  </p>
                )}
              </div>

              {/* Test Gemini 3.0 */}
              <div className="flex-1 min-w-[200px]">
                <button
                  onClick={testGemini3}
                  disabled={gemini3TestStatus === 'testing'}
                  className={`w-full px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center justify-center ${
                    gemini3TestStatus === 'testing' 
                      ? 'bg-gray-300 cursor-wait text-gray-600' 
                      : gemini3TestStatus === 'success'
                      ? 'bg-green-500 text-white shadow-md'
                      : gemini3TestStatus === 'error'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-purple-500 text-white hover:bg-purple-600 shadow-sm hover:shadow-md'
                  }`}
                >
                  {gemini3TestStatus === 'testing' ? (
                    <>
                      <svg className="animate-spin h-4 w-4 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      בודק...
                    </> 
                  ) : gemini3TestStatus === 'success' ? (
                    <>✅ Gemini 3.0 תקין!</>
                  ) : gemini3TestStatus === 'error' ? (
                    <>⚠️ לא זמין</>
                  ) : (
                    <>🚀 בדוק Gemini 3.0</>
                  )}
                </button>
                {gemini3TestMessage && (
                  <p className={`mt-2 text-xs text-center ${
                    gemini3TestStatus === 'success' ? 'text-green-600' : 
                    gemini3TestStatus === 'error' ? 'text-orange-600' : 
                    'text-gray-600'
                  }`}>
                    {gemini3TestMessage}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Watch Folder Setting */}
          <div>
            <label htmlFor="watchFolder" className="block text-sm font-medium text-gray-700 mb-2">
              נתיב תיקיית מעקב
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="watchFolder"
                value={tempWatchFolder}
                onChange={(e) => setTempWatchFolder(e.target.value)}
                placeholder="C:\Users\Username\Videos\..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                dir="ltr"
              />
              <button
                onClick={saveSettings}
                disabled={isLoading || (tempWatchFolder === settings.watchFolder && tempSelectedModel === settings.selectedModel)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {isLoading ? 'שומר...' : 'שמור'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              השרת יאזין לתיקייה זו ויעבד קבצי MP4 שמתחילים ב-"20_vtr" ובאורך של יותר מדקה
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label htmlFor="selectedModel" className="block text-sm font-medium text-gray-700 mb-2">
              מודל AI למעקב אוטומטי
            </label>
            {modelsLoading ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 text-sm">
                טוען מודלים זמינים...
              </div>
            ) : Object.keys(availableModels).length === 0 ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-600 text-sm">
                שגיאה: לא נמצאו מודלים זמינים
              </div>
            ) : (
              <>
                <select
                  id="selectedModel"
                  value={tempSelectedModel}
                  onChange={(e) => setTempSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  {Object.entries(availableModels).map(([modelKey, model]) => (
                    <option key={modelKey} value={modelKey}>
                      {model.name} - {model.description}
                    </option>
                  ))}
                </select>
                
                {/* Model Details */}
                {tempSelectedModel && availableModels[tempSelectedModel] && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md border">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-gray-700">מהירות:</span>
                        <div className="text-gray-600">{availableModels[tempSelectedModel].speed}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">איכות:</span>
                        <div className="text-gray-600">{availableModels[tempSelectedModel].quality}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">עלות:</span>
                        <div className="text-gray-600">{availableModels[tempSelectedModel].cost}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">מומלץ:</span>
                        <div className="text-gray-600">{availableModels[tempSelectedModel].recommended}</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* אזהרת בטא ל-Gemini 3.0 */}
                {tempSelectedModel === 'gemini-3-pro-preview' && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-md">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-600 text-lg">⚠️</span>
                      <div className="text-xs text-amber-800">
                        <strong>מודל בטא - לא יציב!</strong>
                        <p className="mt-1">
                          Gemini 3.0 נמצא בשלב Preview ונתקל לעיתים בבעיות קיבולת בשרתי Google.
                          אם הניתוח נכשל, נסה מודל אחר.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="mt-1 text-xs text-gray-500">
              מודל זה ישמש לניתוח אוטומטי של קבצים שמתגלים במעקב
            </p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-700">הפעלת מעקב קבצים</h3>
              <p className="text-sm text-gray-500">האם לאזין לקבצים חדשים ולעבד אותם אוטומטית</p>
            </div>
            <button
              onClick={toggleWatcher}
              disabled={isLoading || !settings.watchFolder.trim()}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.isEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.isEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`p-3 rounded-md text-sm ${
              message.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4 text-sm">
            <h3 className="font-medium text-blue-800 mb-2">הוראות שימוש:</h3>
            <ul className="text-blue-700 space-y-1 list-disc list-inside">
              <li>הכנס נתיב מלא לתיקייה שבה יופיעו קבצי הוידאו</li>
              <li>הקבצים חייבים להתחיל ב-"20_vtr" ולהיות באורך של יותר מדקה</li>
              <li>הקבצים יעובדו אוטומטית עם המודל הנבחר</li>
              <li>הניתוחים יישמרו בקובץ היומי עם התאריך הנוכחי</li>
              <li>רק קבצים חדשים יעובדו - לא קבצים קיימים</li>
              <li>הניתוח האחרון יופיע ראשון ברשימה</li>
            </ul>
          </div>

          {/* Processing Logs */}
          {logs && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-700 mb-3">לוגי עיבוד - {logs.date}</h3>
              
              {/* Stats Summary */}
              <div className="grid grid-cols-5 gap-3 mb-4 text-sm">
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-medium text-gray-800">{logs.stats.total}</div>
                  <div className="text-xs text-gray-600">סה"כ</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                  <div className="font-medium text-green-700">{logs.stats.processed}</div>
                  <div className="text-xs text-green-600">עובד</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                  <div className="font-medium text-yellow-700">{logs.stats.skipped}</div>
                  <div className="text-xs text-yellow-600">דולג</div>
                </div>
                <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                  <div className="font-medium text-red-700">{logs.stats.errors}</div>
                  <div className="text-xs text-red-600">שגיאות</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded border border-blue-200">
                  <div className="font-medium text-blue-700">{logs.stats.duplicates}</div>
                  <div className="text-xs text-blue-600">כפילות</div>
                </div>
              </div>

              {/* Recent Logs */}
              {logs.logs.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-600 mb-2">לוגים אחרונים:</div>
                  {logs.logs.slice(0, 10).map((log, index) => (
                    <div key={index} className="bg-white rounded p-2 text-xs border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-700">
                          {log.filename}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.decision === 'processed' ? 'bg-green-100 text-green-700' :
                            log.decision === 'skipped' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {log.decision === 'processed' ? 'עובד' :
                             log.decision === 'skipped' ? 'דולג' : 'שגיאה'}
                          </span>
                          <span className="text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString('he-IL')}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-600">{log.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  אין לוגי עיבוד היום
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPanel; 