"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ConversationHistory {
  id: string;
  date: string;
  scenario: string;
  duration: number;
  overallScore: number;
  confidenceScore: number;
  clarityScore: number;
  relevanceScore: number;
}

interface AssessmentScores {
  socialScore: number;
  emotionalScore: number;
  communicationScore: number;
  overallScore: number;
  date: string;
}

interface Props {
  initialAssessment: AssessmentScores;
  conversationHistory: ConversationHistory[];
}

const Dashboard: React.FC<Props> = ({
  initialAssessment,
  conversationHistory,
}) => {
  const calculateAverageScores = () => {
    if (conversationHistory.length === 0) return 0;
    return (
      conversationHistory.reduce((acc, curr) => acc + curr.overallScore, 0) /
      conversationHistory.length
    );
  };

  const getProgressStatus = () => {
    const averageScore = calculateAverageScores();
    if (averageScore >= 8)
      return { text: "Excellent Progress", color: "text-green-600" };
    if (averageScore >= 6)
      return { text: "Good Progress", color: "text-yellow-600" };
    return { text: "Needs Improvement", color: "text-red-600" };
  };

  const progressStatus = getProgressStatus();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Your Progress Dashboard</h1>

      {/* Initial Assessment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Initial Assessment</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Social Score:</span>
              <span className="font-semibold">
                {initialAssessment.socialScore}/10
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Emotional Score:</span>
              <span className="font-semibold">
                {initialAssessment.emotionalScore}/10
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Communication Score:</span>
              <span className="font-semibold">
                {initialAssessment.communicationScore}/10
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span>Overall Score:</span>
              <span className="font-semibold">
                {initialAssessment.overallScore}/10
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <h2 className="text-xl font-semibold mb-4">Progress Summary</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Conversations Completed:</span>
              <span className="font-semibold">
                {conversationHistory.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Average Score:</span>
              <span className="font-semibold">
                {calculateAverageScores().toFixed(1)}/10
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Status:</span>
              <span className={`font-semibold ${progressStatus.color}`}>
                {progressStatus.text}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Progress Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6 mb-8"
      >
        <h2 className="text-xl font-semibold mb-4">Progress Over Time</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={conversationHistory}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="overallScore"
                stroke="#3B82F6"
                name="Overall Score"
              />
              <Line
                type="monotone"
                dataKey="confidenceScore"
                stroke="#10B981"
                name="Confidence"
              />
              <Line
                type="monotone"
                dataKey="clarityScore"
                stroke="#6366F1"
                name="Clarity"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent Conversations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <h2 className="text-xl font-semibold mb-4">Recent Conversations</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scenario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {conversationHistory.map((conversation) => (
                <tr key={conversation.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {conversation.date}
                  </td>
                  <td className="px-6 py-4">{conversation.scenario}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {Math.round(conversation.duration / 1000)}s
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold">
                    {conversation.overallScore}/10
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
