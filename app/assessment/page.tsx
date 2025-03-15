"use client";

import React from "react";
import { useRouter } from "next/navigation";
import IntrovertAssessment from "../components/IntrovertAssessment";

interface AssessmentResult {
  socialScore: number;
  emotionalScore: number;
  communicationScore: number;
  overallScore: number;
  recommendations: string[];
}

const AssessmentPage = () => {
  const router = useRouter();

  const handleAssessmentComplete = (result: AssessmentResult) => {
    // Store assessment results with timestamp
    const assessmentWithDate = {
      ...result,
      date: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(
      "initialAssessment",
      JSON.stringify(assessmentWithDate)
    );

    // Initialize conversation history if it doesn't exist
    if (!localStorage.getItem("conversationHistory")) {
      localStorage.setItem("conversationHistory", JSON.stringify([]));
    }

    // Redirect to dashboard
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Let's Understand Your Communication Style
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Complete this quick assessment to help us personalize your
          conversation practice experience.
        </p>
        <IntrovertAssessment onComplete={handleAssessmentComplete} />
      </div>
    </div>
  );
};

export default AssessmentPage;
