import { useState } from 'react'
import InputForm from './components/InputForm'
import OutputDisplay from './components/OutputDisplay'
import AnalysisList from './components/AnalysisList'
import SettingsPanel from './components/SettingsPanel'
import './App.css'

interface FormData {
  video: File | null
  reporterName: string
  videoDate: string
  selectedModel: string
}

interface ContentData {
  summary?: string;
  titles?: string[];
  descriptions?: string[];
  thumbnails?: Array<{
    timestamp: string;
    description: string;
  }>;
  rawContent?: string;
}

interface ApiResponse {
  success: boolean
  content: ContentData
  reporterName: string
  videoDate: string
  analysisId?: string
}

interface Analysis {
  id: string;
  timestamp: string;
  reporterName: string;
  videoDate: string;
  modelUsed: string;
  videoSize: string;
  processingTime: number;
  content: ContentData;
  status: 'pending' | 'completed';
  completedAt: string | null;
}

function App() {
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentVideoFile, setCurrentVideoFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<{
    stage: string;
    percentage: number;
    message: string;
  }>({ stage: '', percentage: 0, message: '' })
  
  // States for analysis list
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  
  // States for settings panel
  const [isSettingsMinimized, setIsSettingsMinimized] = useState(true)

  const handleFormSubmit = async (formData: FormData) => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      // Stage 1: Preparing upload
      setProgress({ stage: 'upload', percentage: 10, message: 'מכין את הקובץ להעלאה...' })
      
      // Create FormData for file upload
      const submitData = new FormData()
      if (formData.video) {
        submitData.append('video', formData.video)
      }
      submitData.append('reporterName', formData.reporterName)
      submitData.append('videoDate', formData.videoDate)
      submitData.append('selectedModel', formData.selectedModel)

      // Stage 2: Uploading
      setProgress({ stage: 'upload', percentage: 30, message: 'מעלה קובץ לשרת...' })

      // Use environment-aware API URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/generate` : '/api/generate';

      // Get custom API key from localStorage if available
      const customApiKey = localStorage.getItem('gemini_api_key');
      
      // Build headers - include custom API key if available
      const headers: HeadersInit = {};
      if (customApiKey) {
        headers['X-API-Key'] = customApiKey;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: submitData,
      })

      // Stage 3: Processing
      setProgress({ stage: 'processing', percentage: 60, message: `מנתח סרטון עם ${formData.selectedModel}...` })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'שגיאה בחיבור לשרת')
      }

      // Stage 4: Finalizing
      setProgress({ stage: 'finalizing', percentage: 90, message: 'מסיים עיבוד ומכין תוצאות...' })

      const data: ApiResponse = await response.json()
      
      // Stage 5: Complete
      setProgress({ stage: 'complete', percentage: 100, message: 'הושלם בהצלחה!' })
      
      setResult(data)
      setCurrentVideoFile(formData.video)
      
      // Trigger refresh of analysis list
      setRefreshTrigger(prev => prev + 1)
      
      // Clear progress after a short delay
      setTimeout(() => {
        setProgress({ stage: '', percentage: 0, message: '' })
      }, 2000)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה לא ידועה')
      setProgress({ stage: 'error', percentage: 0, message: 'התרחשה שגיאה בעיבוד' })
    } finally {
      setIsLoading(false)
    }
  }

  // Handle analysis selection from list
  const handleAnalysisSelect = (analysis: Analysis) => {
    setSelectedAnalysis(analysis)
    
    // Convert analysis to ApiResponse format for OutputDisplay
    const analysisAsResult: ApiResponse = {
      success: true,
      content: analysis.content,
      reporterName: analysis.reporterName,
      videoDate: analysis.videoDate,
      analysisId: analysis.id
    }
    
    setResult(analysisAsResult)
    setCurrentVideoFile(null) // Clear current video file when selecting from history
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 font-hebrew">
      <div className="max-w-none mx-auto px-2">
        <header className="text-center mb-8">
          <h1 className="text-6xl font-bold text-gray-800 mb-4">
            עוזר התוכן של כאן חדשות
          </h1>
          <p className="text-xl text-gray-600 mb-3">
            מנתח סרטונים ומייצר הצעות תוכן מותאמות לערוץ היוטיוב עם מודלי Gemini החדשים
          </p>
          <p className="text-base text-gray-400">
            💡 בחר ניתוח מהיסטוריה או העלה סרטון חדש
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Right sidebar - 3 columns (רשימה וטופס) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Analysis List - ניתוחים יומיים למעלה */}
            <AnalysisList 
              onAnalysisSelect={handleAnalysisSelect}
              selectedAnalysisId={selectedAnalysis?.id}
              refreshTrigger={refreshTrigger}
            />
            
            {/* Input Form - העלאה ידנית */}
            <InputForm 
              onSubmit={handleFormSubmit} 
              isLoading={isLoading}
              error={error}
              videoFile={currentVideoFile}
              progress={progress}
            />
            
            {/* Settings Panel - הגדרות מעקב קבצים למטה */}
            <SettingsPanel 
              isMinimized={isSettingsMinimized}
              onToggleMinimize={() => setIsSettingsMinimized(!isSettingsMinimized)}
            />
          </div>
          
          {/* Results - 9 columns (תוצאות מולצות) */}
          <div className="lg:col-span-9">
            {result ? (
              <OutputDisplay result={result} videoFile={currentVideoFile || undefined} />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <div className="mb-6">
                  <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-medium text-gray-800 mb-4">
                  בחר ניתוח מהרשימה או העלה סרטון חדש
                </h3>
                <p className="text-xl text-gray-600 leading-relaxed">
                  הניתוחים היומיים מתעדכנים אוטומטית,<br />
                  או שתוכל להעלות ולנתח סרטון בעצמך
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
