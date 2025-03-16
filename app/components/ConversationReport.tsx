"use client";

import React from "react";
import { motion } from "framer-motion";

interface ConversationMetrics {
  duration: number;
  wordCount: number;
  hesitationCount: number;
  confidenceScore: number;
  clarityScore: number;
  relevanceScore: number;
  overallScore: number;
  improvements: string[];
  strengths: string[];
  analysis?: string;
}

interface Props {
  metrics: ConversationMetrics;
  scenario: string;
  userResponse: string;
  suggestedResponses: string[];
}

const ConversationReport: React.FC<Props> = ({
  metrics,
  scenario,
  userResponse,
  suggestedResponses,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600";
    if (score >= 6) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds} seconds`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto"
    >
      <h2 className="text-2xl font-bold mb-6">Conversation Analysis</h2>

      {/* Time and Basic Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Duration</h3>
          <p>{formatDuration(metrics.duration)}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Words Used</h3>
          <p>{metrics.wordCount} words</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Hesitations</h3>
          <p>{metrics.hesitationCount} detected</p>
        </div>
      </div>

      {/* Detailed Scores */}
      <div className="mb-6">
        <h3 className="font-semibold mb-4">Performance Scores</h3>
        <div className="space-y-4">
          {[
            { label: "Confidence", score: metrics.confidenceScore },
            { label: "Clarity", score: metrics.clarityScore },
            { label: "Relevance", score: metrics.relevanceScore },
            { label: "Overall", score: metrics.overallScore },
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

      {/* Response Analysis */}
      <div className="mb-6">
        <h3 className="font-semibold mb-4">Response Analysis</h3>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Your Response:</h4>
            <p className="text-gray-700">{userResponse}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">AI Analysis:</h4>
            <p className="text-gray-700 mb-4">{metrics.analysis || 'No analysis available.'}</p>
            <h4 className="font-medium mb-2">Suggested Responses:</h4>
            <ul className="list-disc list-inside space-y-2">
              {suggestedResponses.map((response, index) => (
                <li key={index} className="text-gray-700">
                  {response}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Improvements and Strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-4 text-red-600">
            Areas for Improvement
          </h3>
          <ul className="list-disc list-inside space-y-2">
            {metrics.improvements.map((improvement, index) => (
              <li key={index} className="text-gray-700">
                {improvement}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-4 text-green-600">Strengths</h3>
          <ul className="list-disc list-inside space-y-2">
            {metrics.strengths.map((strength, index) => (
              <li key={index} className="text-gray-700">
                {strength}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default ConversationReport;
