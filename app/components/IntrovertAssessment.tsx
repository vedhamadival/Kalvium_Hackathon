"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface AssessmentQuestion {
  id: number;
  question: string;
  options: {
    text: string;
    score: number;
  }[];
  category: "social" | "emotional" | "communication";
}

const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: 1,
    question: "How do you feel about starting conversations with strangers?",
    category: "social",
    options: [
      { text: "Very comfortable", score: 1 },
      { text: "Somewhat comfortable", score: 2 },
      { text: "Neutral", score: 3 },
      { text: "Somewhat uncomfortable", score: 4 },
      { text: "Very uncomfortable", score: 5 },
    ],
  },
  {
    id: 2,
    question: "How often do you avoid social situations due to anxiety?",
    category: "emotional",
    options: [
      { text: "Never", score: 1 },
      { text: "Rarely", score: 2 },
      { text: "Sometimes", score: 3 },
      { text: "Often", score: 4 },
      { text: "Always", score: 5 },
    ],
  },
  {
    id: 3,
    question: "How do you feel about speaking up in group discussions?",
    category: "communication",
    options: [
      { text: "Very confident", score: 1 },
      { text: "Somewhat confident", score: 2 },
      { text: "Neutral", score: 3 },
      { text: "Somewhat hesitant", score: 4 },
      { text: "Very hesitant", score: 5 },
    ],
  },
  {
    id: 4,
    question:
      "How often do you find yourself struggling to express your thoughts clearly?",
    category: "communication",
    options: [
      { text: "Rarely", score: 1 },
      { text: "Occasionally", score: 2 },
      { text: "Sometimes", score: 3 },
      { text: "Frequently", score: 4 },
      { text: "Almost always", score: 5 },
    ],
  },
  {
    id: 5,
    question: "How do you feel about receiving attention from others?",
    category: "emotional",
    options: [
      { text: "Very comfortable", score: 1 },
      { text: "Somewhat comfortable", score: 2 },
      { text: "Neutral", score: 3 },
      { text: "Somewhat uncomfortable", score: 4 },
      { text: "Very uncomfortable", score: 5 },
    ],
  },
];

interface AssessmentResult {
  socialScore: number;
  emotionalScore: number;
  communicationScore: number;
  overallScore: number;
  recommendations: string[];
}

interface Props {
  onComplete: (result: AssessmentResult) => void;
}

const IntrovertAssessment: React.FC<Props> = ({ onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isCompleted, setIsCompleted] = useState(false);

  const handleAnswer = (score: number) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion]: score,
    }));

    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    } else {
      calculateResults();
    }
  };

  const calculateResults = () => {
    let socialScore = 0;
    let emotionalScore = 0;
    let communicationScore = 0;
    let count = { social: 0, emotional: 0, communication: 0 };

    assessmentQuestions.forEach((q, index) => {
      const score = answers[index] || 0;
      switch (q.category) {
        case "social":
          socialScore += score;
          count.social++;
          break;
        case "emotional":
          emotionalScore += score;
          count.emotional++;
          break;
        case "communication":
          communicationScore += score;
          count.communication++;
          break;
      }
    });

    // Normalize scores to 1-10 scale
    socialScore = Math.round((socialScore / (count.social * 5)) * 10);
    emotionalScore = Math.round((emotionalScore / (count.emotional * 5)) * 10);
    communicationScore = Math.round(
      (communicationScore / (count.communication * 5)) * 10
    );
    const overallScore = Math.round(
      (socialScore + emotionalScore + communicationScore) / 3
    );

    const recommendations = generateRecommendations(
      socialScore,
      emotionalScore,
      communicationScore
    );

    setIsCompleted(true);
    onComplete({
      socialScore,
      emotionalScore,
      communicationScore,
      overallScore,
      recommendations,
    });
  };

  const generateRecommendations = (
    social: number,
    emotional: number,
    communication: number
  ): string[] => {
    const recommendations: string[] = [];

    if (social > 7) {
      recommendations.push("Focus on basic social interaction scenarios");
    }
    if (emotional > 7) {
      recommendations.push("Start with low-pressure situations");
    }
    if (communication > 7) {
      recommendations.push(
        "Practice expressing thoughts clearly in simple conversations"
      );
    }

    return recommendations;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-center mb-8">
        Introvert Assessment
      </h2>

      {!isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-lg p-6"
        >
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${
                    ((currentQuestion + 1) / assessmentQuestions.length) * 100
                  }%`,
                }}
              />
            </div>
          </div>

          <h3 className="text-xl mb-4">
            {assessmentQuestions[currentQuestion].question}
          </h3>

          <div className="space-y-3">
            {assessmentQuestions[currentQuestion].options.map(
              (option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option.score)}
                  className="w-full p-3 text-left rounded-lg hover:bg-blue-50 border border-gray-200 transition-colors"
                >
                  {option.text}
                </button>
              )
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default IntrovertAssessment;
