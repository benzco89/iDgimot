import { useState } from 'react'
import InputForm from './components/InputForm'
import OutputDisplay from './components/OutputDisplay'
import './App.css'

interface FormData {
  video: File | null
  reporterName: string
  videoDate: string
}

interface ApiResponse {
  success: boolean
  content: string
  reporterName: string
  videoDate: string
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

      // Stage 2: Uploading
      setProgress({ stage: 'upload', percentage: 30, message: 'מעלה קובץ לשרת...' })

      const response = await fetch('http://localhost:3001/api/generate', {
        method: 'POST',
        body: submitData,
      })

      // Stage 3: Processing
      setProgress({ stage: 'processing', percentage: 60, message: 'מנתח סרטון עם Gemini Pro...' })

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

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-hebrew">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            עוזר התוכן של כאן חדשות
          </h1>
          <p className="text-gray-600">
            מנתח סרטונים ומייצר הצעות תוכן מותאמות לערוץ היוטיוב עם Gemini Pro
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Input Form - 2 columns */}
          <div className="lg:col-span-2">
            <InputForm 
              onSubmit={handleFormSubmit} 
              isLoading={isLoading}
              error={error}
              videoFile={currentVideoFile}
              progress={progress}
            />
          </div>
          
          {/* Results - 3 columns */}
          <div className="lg:col-span-3">
            {result && <OutputDisplay result={result} videoFile={currentVideoFile} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
