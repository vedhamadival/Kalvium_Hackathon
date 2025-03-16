"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface ConversationAnalysis {
  duration: number;
  wordCount: number;
  hesitationCount: number;
  confidenceScore: number;
  clarityScore: number;
  relevanceScore: number;
  overallScore: number;
  improvements: string[];
  strengths: string[];
  userResponse: string;
  currentScenario: {
    title: string;
    description: string;
  } | null;
  analysis: string;
  suggestedResponses: string[];
  conversationHistory: Array<{
    speaker: 'user' | 'bot';
    text: string;
    timestamp: number;
  }>;
}

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load analysis data from localStorage
    const savedAnalysis = localStorage.getItem('conversationAnalysis');
    if (savedAnalysis) {
      setAnalysis(JSON.parse(savedAnalysis));
    }
  }, []);

  if (!analysis) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds} seconds`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">Conversation Analysis</h1>
          <p className="text-gray-600">
            Scenario: {analysis.currentScenario?.title || 'General Conversation'}
          </p>
        </div>

        {/* Conversation History */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Conversation History</h2>
          <div className="space-y-4">
            {analysis.conversationHistory.map((turn, index) => (
              <div
                key={turn.timestamp}
                className={`p-4 rounded-lg ${
                  turn.speaker === 'user' ? 'bg-blue-50 ml-12' : 'bg-gray-50 mr-12'
                }`}
              >
                <p className="font-semibold mb-1">{turn.speaker === 'user' ? 'You' : 'Bot'}</p>
                <p className="text-gray-700">{turn.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">AI Analysis</h2>
          <div className="prose max-w-none">
            <p className="text-gray-700 mb-6">{analysis.analysis}</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Duration</h3>
              <p>{formatDuration(analysis.duration)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Words Used</h3>
              <p>{analysis.wordCount} words</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Hesitations</h3>
              <p>{analysis.hesitationCount} detected</p>
            </div>
          </div>

          {/* Scores */}
          <div className="space-y-4">
            {[
              { label: "Confidence", score: analysis.confidenceScore },
              { label: "Clarity", score: analysis.clarityScore },
              { label: "Relevance", score: analysis.relevanceScore },
              { label: "Overall", score: analysis.overallScore },
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center">
                <span className="w-24">{label}:</span>
                <div className="flex-1 mx-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                </div>
                <span className={`${getScoreColor(score)} font-semibold`}>
                  {score}/10
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Suggested Responses */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Suggested Responses</h2>
          <div className="space-y-4">
            {analysis.suggestedResponses.map((response, index) => (
              <div key={index} className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-700">{response}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center space-x-4">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Try Another Conversation
          </button>
        </div>
      </motion.div>
    </div>
  );
} 