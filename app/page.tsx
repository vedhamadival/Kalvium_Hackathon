"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceBot from "./components/VoiceBot";
import ConversationReport from "./components/ConversationReport";
import { saveConversationResult } from "./utils/conversationStorage";

interface Scenario {
  id: string;
  title: string;
  context?: string;
  description: string;
  suggestedResponses: string[];
}

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
  userResponse: string;
  currentScenario: Scenario | null;
}

const scenarios = [
  {
    id: "small-talk",
    title: "Small Talk Practice",
    description: "Practice casual conversations about everyday topics.",
    suggestedResponses: [
      "I'm really enjoying exploring the neighborhood, especially the local parks and cafes.",
      "It's been a great experience so far, I've met some friendly neighbors.",
      "I'm still getting used to the area, but I love discovering new places.",
    ]
  },
  {
    id: "job-interview",
    title: "Job Interview",
    description: "Practice common job interview questions and responses.",
    suggestedResponses: [
      "In my previous role, I successfully led a team project that increased efficiency by 30%.",
      "I believe my experience in project management and problem-solving makes me a strong fit.",
      "I'm particularly drawn to this position because it aligns with my career goals in technology.",
    ]
  },
  {
    id: "social-event",
    title: "Social Event",
    description: "Practice conversations you might have at social gatherings.",
    suggestedResponses: [
      "I've always been passionate about technology and its impact on society.",
      "My journey started when I discovered my interest in solving complex problems.",
      "What drew me to this field was the opportunity to create meaningful solutions.",
    ]
  },
];

export default function Home() {
  const router = useRouter();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [conversationMetrics, setConversationMetrics] =
    useState<ConversationMetrics | null>(null);
  const [currentUserResponse, setCurrentUserResponse] = useState<string>("");

  useEffect(() => {
    // Check if assessment is completed
    const assessment = localStorage.getItem("initialAssessment");
    if (!assessment) {
      router.push("/assessment");
    }
  }, [router]);

  const handleConversationComplete = (metrics: ConversationMetrics) => {
    setConversationMetrics(metrics);
    setCurrentUserResponse(metrics.userResponse);
    setShowReport(true);

    if (selectedScenario) {
      // Save conversation result
      saveConversationResult(selectedScenario, metrics);
    }
  };

  const handleStartNewConversation = () => {
    setSelectedScenario(null);
    setShowReport(false);
    setConversationMetrics(null);
  };

  if (showReport && conversationMetrics && selectedScenario) {
    const scenario = scenarios.find((s) => s.id === selectedScenario);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <ConversationReport
          metrics={conversationMetrics}
          scenario={scenario?.title || selectedScenario}
          userResponse={currentUserResponse}
          suggestedResponses={scenario?.suggestedResponses || []}
        />
        <div className="mt-8 text-center">
          <button
            onClick={handleStartNewConversation}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Conversation
          </button>
        </div>
      </div>
    );
  }

  if (selectedScenario) {
    return (
      <div className="container mx-auto px-4 py-8">
        <VoiceBot onConversationComplete={handleConversationComplete} />
        <button
          onClick={() => setSelectedScenario(null)}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          ← Choose Different Scenario
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Choose a Scenario</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => setSelectedScenario(scenario.id)}
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">{scenario.title}</h2>
            <p className="text-gray-600">{scenario.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
