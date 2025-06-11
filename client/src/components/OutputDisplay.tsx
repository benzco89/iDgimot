import { useState } from 'react';

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
  success: boolean;
  content: ContentData;
  reporterName: string;
  videoDate: string;
}

interface OutputDisplayProps {
  result: ApiResponse;
  videoFile?: File;
}

// רכיב פידבק נפרד כדי למנוע re-creation
const FeedbackComponent: React.FC<{
  itemKey: string;
  contentType: string;
  contentText: string;
  feedbackStates: {[key: string]: {
    feedback: 'like' | 'dislike' | null;
    showExplanation: boolean;
    explanation: string;
    isSubmitting: boolean;
  }};
  onFeedback: (key: string, contentType: string, contentText: string, feedbackType: 'like' | 'dislike') => void;
  onExplanationChange: (key: string, explanation: string) => void;
  onSubmitFeedback: (key: string, contentType: string, contentText: string) => void;
  onCancelFeedback: (key: string) => void;
}> = ({ 
  itemKey, 
  contentType, 
  contentText, 
  feedbackStates, 
  onFeedback, 
  onExplanationChange, 
  onSubmitFeedback, 
  onCancelFeedback 
}) => {
  const feedbackState = feedbackStates[itemKey] || {
    feedback: null,
    showExplanation: false,
    explanation: '',
    isSubmitting: false
  };

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      {!feedbackState.showExplanation ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">איך זה?</span>
          <button
            onClick={() => onFeedback(itemKey, contentType, contentText, 'like')}
            className="text-lg hover:bg-green-100 p-1 rounded transition-colors"
            title="טוב"
          >
            👍
          </button>
          <button
            onClick={() => onFeedback(itemKey, contentType, contentText, 'dislike')}
            className="text-lg hover:bg-red-100 p-1 rounded transition-colors"
            title="לא טוב"
          >
            👎
          </button>
        </div>
      ) : (
        <div className="space-y-2 bg-gray-50 p-3 rounded border">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {feedbackState.feedback === 'like' ? '👍 למה זה טוב?' : '👎 למה זה לא טוב?'}
            </span>
          </div>
          <textarea
            key={`textarea-${itemKey}`}
            value={feedbackState.explanation}
            onChange={(e) => onExplanationChange(itemKey, e.target.value)}
            placeholder="הסבר קצר (אופציונלי)..."
            className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
            rows={2}
            disabled={feedbackState.isSubmitting}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSubmitFeedback(itemKey, contentType, contentText)}
              disabled={feedbackState.isSubmitting}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                feedbackState.isSubmitting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {feedbackState.isSubmitting ? 'שולח...' : 'שלח פידבק'}
            </button>
            <button
              onClick={() => onCancelFeedback(itemKey)}
              disabled={feedbackState.isSubmitting}
              className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const OutputDisplay: React.FC<OutputDisplayProps> = ({ result, videoFile }) => {
  const [copiedText, setCopiedText] = useState<string>('');
  const [thumbnails, setThumbnails] = useState<{[key: string]: string}>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<{[key: string]: boolean}>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<{[key: string]: string}>({});
  const [isEditing, setIsEditing] = useState<{[key: string]: boolean}>({});
  
  // State לניהול פידבק
  const [feedbackStates, setFeedbackStates] = useState<{[key: string]: {
    feedback: 'like' | 'dislike' | null;
    showExplanation: boolean;
    explanation: string;
    isSubmitting: boolean;
  }}>({});

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const extractThumbnail = async (timestamp: string) => {
    if (!videoFile) return;
    
    setLoadingThumbnails(prev => ({...prev, [timestamp]: true}));
    
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('timestamp', timestamp);

      // Use environment-aware API URL
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/extract-thumbnail` : '/api/extract-thumbnail';

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        const thumbnailUrl = apiBaseUrl ? `${apiBaseUrl}${data.thumbnailUrl}` : data.thumbnailUrl;
        setThumbnails(prev => ({
          ...prev, 
          [timestamp]: thumbnailUrl
        }));
      }
    } catch (error) {
      console.error('Error extracting thumbnail:', error);
    } finally {
      setLoadingThumbnails(prev => ({...prev, [timestamp]: false}));
    }
  };

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  const startEditing = (key: string, text: string) => {
    setIsEditing({...isEditing, [key]: true});
    setEditingText({...editingText, [key]: text});
  };

  const saveEdit = (key: string) => {
    setIsEditing({...isEditing, [key]: false});
    copyToClipboard(editingText[key]);
  };

  const cancelEdit = (key: string) => {
    setIsEditing({...isEditing, [key]: false});
    setEditingText({...editingText, [key]: ''});
  };

  // פונקציות לניהול פידבק
  const handleFeedback = (key: string, contentType: string, contentText: string, feedbackType: 'like' | 'dislike') => {
    setFeedbackStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        feedback: feedbackType,
        showExplanation: true,
        explanation: prev[key]?.explanation || '',
        isSubmitting: false
      }
    }));
  };

  const handleExplanationChange = (key: string, explanation: string) => {
    setFeedbackStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        explanation
      }
    }));
  };

  const submitFeedback = async (key: string, contentType: string, contentText: string) => {
    const feedbackState = feedbackStates[key];
    if (!feedbackState?.feedback) return;

    setFeedbackStates(prev => ({
      ...prev,
      [key]: { ...prev[key], isSubmitting: true }
    }));

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/feedback` : '/api/feedback';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contentType,
          contentText,
          feedback: feedbackState.feedback,
          explanation: feedbackState.explanation,
          reporter: result.reporterName,
          videoDate: result.videoDate
        })
      });

      if (!response.ok) {
        throw new Error('שגיאה בשליחת פידבק');
      }

      // Success - hide the explanation form
      setFeedbackStates(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          showExplanation: false,
          isSubmitting: false
        }
      }));

      console.log('✅ פידבק נשלח בהצלחה');

    } catch (error) {
      console.error('❌ שגיאה בשליחת פידבק:', error);
      setFeedbackStates(prev => ({
        ...prev,
        [key]: { ...prev[key], isSubmitting: false }
      }));
    }
  };

  const cancelFeedback = (key: string) => {
    setFeedbackStates(prev => ({
      ...prev,
      [key]: {
        feedback: null,
        showExplanation: false,
        explanation: '',
        isSubmitting: false
      }
    }));
  };



  const renderStructuredContent = (content: ContentData) => {
    if (content.rawContent) {
      // Fallback for non-JSON content
      return (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800 text-sm mb-2">תוכן לא מובנה - הוחזר כטקסט:</p>
            <pre className="whitespace-pre-wrap text-gray-700">{content.rawContent}</pre>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary */}
        {content.summary && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">תקציר הכתבה</h3>
            <p className="text-blue-700">{content.summary}</p>
          </div>
        )}

        {/* Titles */}
        {content.titles && content.titles.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">הצעות לכותרת</h3>
            <div className="space-y-2">
              {content.titles.map((title, index) => {
                const key = `title-${index}`;
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    {isEditing[key] ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText[key]}
                          onChange={(e) => setEditingText({...editingText, [key]: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(key)}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            שמור והעתק
                          </button>
                          <button
                            onClick={() => cancelEdit(key)}
                            className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <p className="text-gray-700 flex-1">{index + 1}. {title}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditing(key, title)}
                              className="mr-2 px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                            >
                              ערוך
                            </button>
                            <button
                              onClick={() => copyToClipboard(title)}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                copiedText === title 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {copiedText === title ? 'הועתק!' : 'העתק'}
                            </button>
                          </div>
                        </div>
                        <FeedbackComponent 
                          itemKey={key}
                          contentType="title"
                          contentText={title}
                          feedbackStates={feedbackStates}
                          onFeedback={handleFeedback}
                          onExplanationChange={handleExplanationChange}
                          onSubmitFeedback={submitFeedback}
                          onCancelFeedback={cancelFeedback}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Descriptions */}
        {content.descriptions && content.descriptions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">הצעות לתיאור</h3>
            <div className="space-y-3">
              {content.descriptions.map((description, index) => {
                const key = `description-${index}`;
                return (
                  <div key={index} className="bg-gray-50 p-3 rounded">
                    {isEditing[key] ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText[key]}
                          onChange={(e) => setEditingText({...editingText, [key]: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(key)}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            שמור והעתק
                          </button>
                          <button
                            onClick={() => cancelEdit(key)}
                            className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            ביטול
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-gray-700 flex-1">{description}</p>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditing(key, description)}
                              className="mr-2 px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                            >
                              ערוך
                            </button>
                            <button
                              onClick={() => copyToClipboard(description)}
                              className={`px-3 py-1 text-xs rounded transition-colors ${
                                copiedText === description 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                            >
                              {copiedText === description ? 'הועתק!' : 'העתק'}
                            </button>
                          </div>
                        </div>
                        <FeedbackComponent 
                          itemKey={key}
                          contentType="description"
                          contentText={description}
                          feedbackStates={feedbackStates}
                          onFeedback={handleFeedback}
                          onExplanationChange={handleExplanationChange}
                          onSubmitFeedback={submitFeedback}
                          onCancelFeedback={cancelFeedback}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Thumbnails */}
        {content.thumbnails && content.thumbnails.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">הצעות לת'מבנייל</h3>
            <div className="space-y-4">
              {content.thumbnails.map((thumbnail, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-gray-700 font-medium">טיימקוד: {thumbnail.timestamp}</p>
                        <p className="text-gray-600 text-sm">{thumbnail.description}</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${thumbnail.timestamp} - ${thumbnail.description}`)}
                        className={`mr-2 px-3 py-1 text-xs rounded transition-colors ${
                          copiedText === `${thumbnail.timestamp} - ${thumbnail.description}` 
                            ? 'bg-green-500 text-white' 
                            : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                      >
                        {copiedText === `${thumbnail.timestamp} - ${thumbnail.description}` ? 'הועתק!' : 'העתק'}
                      </button>
                    </div>
                    <FeedbackComponent 
                      itemKey={`thumbnail-${index}`}
                      contentType="thumbnail"
                      contentText={`${thumbnail.timestamp} - ${thumbnail.description}`}
                      feedbackStates={feedbackStates}
                      onFeedback={handleFeedback}
                      onExplanationChange={handleExplanationChange}
                      onSubmitFeedback={submitFeedback}
                      onCancelFeedback={cancelFeedback}
                    />
                  </div>
                  
                  {/* Thumbnail extraction */}
                  <div className="border-t border-gray-200 pt-3">
                    {!thumbnails[thumbnail.timestamp] && (
                      <button
                        onClick={() => extractThumbnail(thumbnail.timestamp)}
                        disabled={loadingThumbnails[thumbnail.timestamp]}
                        className={`px-4 py-2 rounded text-sm ${
                          loadingThumbnails[thumbnail.timestamp]
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                        }`}
                      >
                        {loadingThumbnails[thumbnail.timestamp] ? 'מחלץ תמונה...' : 'הצג תמונת ת\'מבנייל'}
                      </button>
                    )}
                    
                                         {thumbnails[thumbnail.timestamp] && (
                        <div className="mt-2">
                          <div 
                            className="cursor-pointer max-w-xs"
                            onClick={() => setSelectedImage(thumbnails[thumbnail.timestamp])}
                          >
                            <img 
                              src={thumbnails[thumbnail.timestamp]} 
                              alt={`ת'מבנייל בזמן ${thumbnail.timestamp}`}
                              className="max-w-xs rounded-md shadow-md hover:shadow-lg transition-shadow"
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">טיימקוד: {thumbnail.timestamp}</p>
                            <button
                              onClick={() => downloadImage(
                                thumbnails[thumbnail.timestamp], 
                                `thumbnail-${thumbnail.timestamp.replace(/:/g, '-')}.jpg`
                              )}
                              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              הורד תמונה
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">תוצאות מומלצות</h2>
        <div className="text-sm text-gray-600">
          <p><strong>כתב/ת:</strong> {result.reporterName}</p>
          <p><strong>תאריך:</strong> {result.videoDate}</p>
        </div>
      </div>

      <div className="space-y-6">
        {result.content ? (
          <>
            {renderStructuredContent(result.content)}
            
            {/* Copy entire content button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => copyToClipboard(JSON.stringify(result.content, null, 2))}
                className={`w-full py-2 px-4 rounded-md transition-colors ${
                  copiedText === JSON.stringify(result.content, null, 2)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                {copiedText === JSON.stringify(result.content, null, 2) ? 'כל התוכן הועתק!' : 'העתק את כל התוכן'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">עדיין לא נוצרו הצעות תוכן</p>
          </div>
        )}
      </div>
    </div>

    {/* Image Modal */}
    {selectedImage && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
        onClick={() => setSelectedImage(null)}
      >
        <div className="relative max-w-4xl max-h-full p-4">
          <img 
            src={selectedImage} 
            alt="תמונה מוגדלת"
            className="max-w-full max-h-full rounded-md shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-2 right-2 bg-white text-black rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-200"
          >
            ✕
          </button>
        </div>
      </div>
    )}
  </>
  );
};

export default OutputDisplay; 