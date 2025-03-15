"use client";

import React, { useEffect, useState } from "react";
import Dashboard from "../components/Dashboard";
import { useRouter } from "next/navigation";

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

const DashboardPage = () => {
  const router = useRouter();
  const [initialAssessment, setInitialAssessment] =
    useState<AssessmentScores | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationHistory[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load data from localStorage
    const loadData = () => {
      try {
        const savedAssessment = localStorage.getItem("initialAssessment");
        const savedHistory = localStorage.getItem("conversationHistory");

        if (savedAssessment) {
          setInitialAssessment(JSON.parse(savedAssessment));
        }

        if (savedHistory) {
          setConversationHistory(JSON.parse(savedHistory));
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Redirect to assessment if not completed
  useEffect(() => {
    if (!loading && !initialAssessment) {
      router.push("/assessment");
    }
  }, [loading, initialAssessment, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!initialAssessment) {
    return null;
  }

  return (
    <Dashboard
      initialAssessment={initialAssessment}
      conversationHistory={conversationHistory}
    />
  );
};

export default DashboardPage;
