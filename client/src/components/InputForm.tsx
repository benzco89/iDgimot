import { useState, useEffect } from 'react';

interface Model {
  name: string;
  description: string;
  speed: string;
  quality: string;
  cost: string;
  recommended: string;
  default?: boolean;
}

interface FormData {
  video: File | null;
  reporterName: string;
  videoDate: string;
  selectedModel: string;
}

interface InputFormProps {
  onSubmit: (formData: FormData) => void;
  isLoading: boolean;
  error: string | null;
  videoFile?: File | null;
  progress?: {
    stage: string;
    percentage: number;
    message: string;
  };
}

const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, error, videoFile, progress }) => {
  const [formData, setFormData] = useState<FormData>({
    video: null,
    reporterName: '',
    videoDate: '',
    selectedModel: '' // Will be set by server response
  });
  
  const [availableModels, setAvailableModels] = useState<Record<string, Model>>({});
  const [modelsLoading, setModelsLoading] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);

  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        console.log('🔄 מנסה לטעון מודלים מ-/api/models');
        const response = await fetch('/api/models');
        console.log('📡 תשובה התקבלה:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        console.log('📄 תוכן התשובה הגולמי:', responseText);
        
        const data = JSON.parse(responseText);
        console.log('✅ נתוני מודלים:', data);
        
        if (data.success) {
          setAvailableModels(data.models);
          console.log('✅ מודלים נטענו:', Object.keys(data.models));
          // Always set the default model from server
          if (data.defaultModel) {
            setFormData(prev => ({ ...prev, selectedModel: data.defaultModel }));
            console.log('✅ מודל ברירת מחדל נבחר:', data.defaultModel);
          }
        } else {
          console.error('❌ שגיאה בתשובה:', data);
        }
      } catch (error) {
        console.error('❌ שגיאה בטעינת מודלים:', error);
        // Fallback to Pro if server is not available
        setFormData(prev => ({ ...prev, selectedModel: 'gemini-2.5-pro' }));
        console.log('⚠️ נקבע fallback למודל Pro');
      } finally {
        setModelsLoading(false);
        console.log('✅ טעינת מודלים הושלמה');
      }
    };

    fetchModels();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.video && formData.reporterName.trim() && formData.videoDate.trim()) {
      onSubmit(formData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({
        ...formData,
        video: file
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-4xl font-bold text-gray-800">ניתוח ידני</h2>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title={isMinimized ? "הרחב טופס" : "מזער טופס"}
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
        <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="video" className="block text-lg font-medium text-gray-700 mb-3">
            העלאת סרטון לניתוח
          </label>
          <div className="mt-1 flex justify-center px-6 pt-6 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
            <div className="space-y-2 text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-lg text-gray-600">
                <label
                  htmlFor="video"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                >
                  <span>העלה סרטון</span>
                  <input
                    id="video"
                    name="video"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="sr-only"
                    required
                  />
                </label>
                <p className="pr-1">או גרור ושחרר כאן</p>
              </div>
              <p className="text-base text-gray-500">
                MP4, MOV, AVI עד 100MB • הניתוח יארך כ-2-3 דקות
              </p>
              {formData.video && (
                <div className="mt-3 text-base text-green-600">
                  <p>✓ {formData.video.name}</p>
                  <p>גודל: {formatFileSize(formData.video.size)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Preview */}
        {formData.video && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">תצוגה מקדימה של הסרטון</h3>
            <video 
              controls 
              className="w-full max-h-64 rounded-md shadow-sm"
              src={URL.createObjectURL(formData.video)}
            >
              הדפדפן שלך לא תומך בנגן וידאו.
            </video>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reporterName" className="block text-lg font-medium text-gray-700 mb-3">
              שם הכתב/ת <span className="text-base text-gray-500">• יופיע בתיאור</span>
            </label>
            <input
              type="text"
              id="reporterName"
              name="reporterName"
              value={formData.reporterName}
              onChange={handleChange}
              placeholder="לדוגמה: מיכל רשף"
              className="w-full px-4 py-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              required
            />
          </div>

          <div>
            <label htmlFor="videoDate" className="block text-lg font-medium text-gray-700 mb-3">
              תאריך השידור <span className="text-base text-gray-500"></span>
            </label>
            <input
              type="text"
              id="videoDate"
              name="videoDate"
              value={formData.videoDate}
              onChange={handleChange}
              placeholder="15 במרץ 2024"
              className="w-full px-4 py-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              required
            />
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label htmlFor="selectedModel" className="block text-lg font-medium text-gray-700 mb-3">
            בחירת מודל AI לניתוח <span className="text-base text-gray-500">• Flash = מהיר, Pro = מדויק יותר</span>
          </label>
          {modelsLoading ? (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
              טוען מודלים זמינים...
            </div>
          ) : Object.keys(availableModels).length === 0 ? (
            <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-600">
              שגיאה: לא נמצאו מודלים זמינים
            </div>
          ) : (
            <select
              id="selectedModel"
              name="selectedModel"
              value={formData.selectedModel}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(availableModels).map(([modelKey, model]) => (
                <option key={modelKey} value={modelKey}>
                  {model.name} - {model.description}
                </option>
              ))}
            </select>
          )}
          
          {/* Model Details */}
          {formData.selectedModel && availableModels[formData.selectedModel] && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="font-medium text-gray-700">מהירות:</span>
                  <div className="text-gray-600">{availableModels[formData.selectedModel].speed}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">איכות:</span>
                  <div className="text-gray-600">{availableModels[formData.selectedModel].quality}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">עלות:</span>
                  <div className="text-gray-600">{availableModels[formData.selectedModel].cost}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-700">מומלץ:</span>
                  <div className="text-gray-600">{availableModels[formData.selectedModel].recommended}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Progress Bar */}
        {isLoading && progress && progress.percentage > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-blue-800">מתקדם בעיבוד...</h3>
              <span className="text-sm text-blue-600">{progress.percentage}%</span>
            </div>
            
            <div className="w-full bg-blue-100 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            
            <div className="flex items-center text-sm text-blue-700">
              <div className="flex items-center ml-2">
                {progress.stage === 'upload' && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="8" />
                  </svg>
                )}
                {progress.stage === 'processing' && (
                  <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                )}
                {progress.stage === 'finalizing' && (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                )}
                {progress.stage === 'complete' && (
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                )}
              </div>
              <span>{progress.message}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !formData.video || !formData.reporterName.trim() || !formData.videoDate.trim()}
          className="w-full bg-blue-600 text-white py-5 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-xl"
        >
          {isLoading ? 'מנתח סרטון ומייצר הצעות, נא להמתין...' : 'נתח סרטון והפק הצעות'}
        </button>
        </form>
      )}
    </div>
  );
};

export default InputForm; 