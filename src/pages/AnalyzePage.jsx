import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { triageMessage } from '../utils/llmHelper'
import { shouldEscalate } from '../utils/templates'

function AnalyzePage() {
  const [message, setMessage] = useState('')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedDraft, setCopiedDraft] = useState(false)

  useEffect(() => {
    // Check for example message from home page
    const exampleMessage = localStorage.getItem('exampleMessage')
    if (exampleMessage) {
      setMessage(exampleMessage)
      localStorage.removeItem('exampleMessage')
    }
  }, [])

  const handleAnalyze = async () => {
    if (!message.trim()) {
      alert('Please enter a message to analyze')
      return
    }

    setIsLoading(true)
    setResults(null)
    setCopiedDraft(false)
    
    try {
      // Run unified multi-dimensional triage
      const triage = await triageMessage(message)
      const isEscalated = shouldEscalate(triage.category, triage.urgency, message)
      
      const analysisResult = {
        message,
        category: triage.category,
        urgency: triage.urgency,
        department: triage.department,
        slaTarget: triage.slaTarget,
        recommendedAction: triage.recommendedAction,
        draftReply: triage.draftReply,
        reasoning: triage.reasoning,
        isEscalated,
        timestamp: new Date().toISOString()
      }

      setResults(analysisResult)

      // Save to history
      const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
      history.push(analysisResult)
      localStorage.setItem('triageHistory', JSON.stringify(history))
    } catch (error) {
      console.error('Error analyzing message:', error)
      alert('Error analyzing message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setMessage('')
    setResults(null)
    setCopiedDraft(false)
  }

  const handleCopyDraft = () => {
    if (results?.draftReply) {
      navigator.clipboard.writeText(results.draftReply)
      setCopiedDraft(true)
      setTimeout(() => setCopiedDraft(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Analyze Customer Message</h1>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-1 rounded-full">
              Relay AI Triage Engine v2.0
            </span>
          </div>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to automatically categorize, evaluate urgency, route to the right department, and generate a draft response.
          </p>

          {/* Input Section */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here (e.g. 'Database connection lost', 'Could you add dark mode?', etc.)..."
              className="w-full border border-gray-300 rounded-lg p-3 h-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Triaging Message...
                </span>
              ) : (
                '⚡ Triage Message'
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-xl font-bold text-gray-900">Triage & Routing Results</h2>
              {results.isEscalated && (
                <span className="inline-flex items-center bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                  🚨 Escalated Ticket
                </span>
              )}
            </div>

            {/* Top Metrics Row: Category, Urgency, Department, SLA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Category</div>
                <div className="text-sm font-bold text-blue-950">
                  {results.category}
                </div>
              </div>

              <div className={`border rounded-lg p-3 ${
                results.urgency === 'Critical' ? 'bg-red-50 border-red-200' :
                results.urgency === 'High' ? 'bg-orange-50 border-orange-200' :
                results.urgency === 'Medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200'
              }`}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1 text-gray-600">Urgency Level</div>
                <div className={`text-sm font-bold ${
                  results.urgency === 'Critical' ? 'text-red-700' :
                  results.urgency === 'High' ? 'text-orange-700' :
                  results.urgency === 'Medium' ? 'text-yellow-800' :
                  'text-green-700'
                }`}>
                  {results.urgency === 'Critical' && '🔥 '}
                  {results.urgency}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Assigned Department</div>
                <div className="text-sm font-bold text-purple-950">
                  📍 {results.department}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Target SLA</div>
                <div className="text-sm font-bold text-emerald-950">
                  ⏱️ {results.slaTarget}
                </div>
              </div>
            </div>

            {/* Recommended Action */}
            <div>
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Recommended Operational Action
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-gray-800 text-sm">
                {results.recommendedAction}
              </div>
            </div>

            {/* AI Draft Response Card */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Suggested Customer Reply (1-Click Draft)
                </div>
                <button
                  onClick={handleCopyDraft}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <span>{copiedDraft ? '✅ Copied to clipboard!' : '📋 Copy Draft'}</span>
                </button>
              </div>
              <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3.5 text-gray-800 text-sm italic">
                "{results.draftReply}"
              </div>
            </div>

            {/* AI Reasoning */}
            <div>
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                Classification Reasoning
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5 text-xs text-gray-700">
                <ReactMarkdown>
                  {results.reasoning}
                </ReactMarkdown>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => {
                  const summary = `[Relay AI Triage Summary]\nCategory: ${results.category}\nUrgency: ${results.urgency}\nDepartment: ${results.department}\nSLA: ${results.slaTarget}\nAction: ${results.recommendedAction}\nDraft: "${results.draftReply}"\nReasoning: ${results.reasoning}`
                  navigator.clipboard.writeText(summary)
                  alert('Full triage summary copied to clipboard!')
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-semibold"
              >
                📋 Copy Full Triage Summary
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage
