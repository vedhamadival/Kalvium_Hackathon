"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Add Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Scenario {
  id: number;
  title: string;
  context: string;
  difficulty: string;
  initialPrompt: string;
  suggestedResponses: string[];
  tips: string[];
}

interface ConversationTurn {
  speaker: "user" | "bot";
  text: string;
  timestamp: number;
}

interface Props {
  onConversationComplete: (metrics: {
    duration: number;
    wordCount: number;
    hesitationCount: number;
    confidenceScore: number;
    clarityScore: number;
    relevanceScore: number;
    overallScore: number;
    improvements: string[];
    strengths: string[];
  }) => void;
}

const VoiceBot: React.FC<Props> = ({ onConversationComplete }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [botResponse, setBotResponse] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(60); // 60 seconds timer
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(Date.now());
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  const initializeSpeechRecognition = () => {
    if (typeof window !== "undefined") {
      try {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setError(
            "Speech recognition is not supported in this browser. Please use Chrome or Edge."
          );
          return;
        }

        // Clean up previous instance if it exists
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current.removeEventListener(
            "result",
            handleRecognitionResult
          );
          recognitionRef.current.removeEventListener(
            "end",
            handleRecognitionEnd
          );
          recognitionRef.current.removeEventListener(
            "error",
            handleRecognitionError
          );
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;

        recognition.addEventListener("result", handleRecognitionResult);
        recognition.addEventListener("end", handleRecognitionEnd);
        recognition.addEventListener("error", handleRecognitionError);

        recognitionRef.current = recognition;
        synthRef.current = window.speechSynthesis;
      } catch (err) {
        setError("Failed to initialize speech recognition.");
      }
    }
  };

  const handleRecognitionResult = (event: any) => {
    try {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      if (transcript.trim()) {
        setLastSpeechTime(Date.now()); // Update last speech time
        setTranscript((prev) => {
          const newTranscript = prev ? `${prev} ${transcript}` : transcript;
          return newTranscript.trim();
        });

        // Reset pause detection
        if (pauseTimeoutRef.current) {
          clearTimeout(pauseTimeoutRef.current);
        }

        // Set new pause detection timeout
        pauseTimeoutRef.current = setTimeout(() => {
          if (transcript.trim()) {
            handlePause();
          }
        }, 1000); // 1 second pause detection
      }
    } catch (err) {
      console.error("Error processing speech result:", err);
    }
  };

  const handleRecognitionEnd = () => {
    if (isListening) {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        setIsListening(false);
        setError("Speech recognition was interrupted. Please try again.");
      }
    }
  };

  const handleRecognitionError = (event: any) => {
    switch (event.error) {
      case "no-speech":
        setError(
          "No speech was detected. Please try speaking again or check your microphone."
        );
        break;
      case "audio-capture":
        setError(
          "No microphone was found. Please check your microphone connection."
        );
        break;
      case "not-allowed":
        setError(
          "Microphone access was denied. Please allow microphone access in your browser settings."
        );
        break;
      case "network":
        setError(
          "Network error occurred. Please check your internet connection."
        );
        break;
      default:
        setError(`Speech recognition error: ${event.error}`);
    }
    setIsListening(false);
  };

  const handlePause = () => {
    if (!isListening || isBotSpeaking || !transcript.trim()) return;

    // Stop listening temporarily
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Process user's speech
    const userText = transcript.trim();
    addToConversation("user", userText);
    setTranscript("");

    // Get and speak bot's response
    const botResponse = getBotResponse(userText);
    addToConversation("bot", botResponse);
    speak(botResponse);

    // Resume listening after bot finishes speaking
    const utterance = new SpeechSynthesisUtterance(botResponse);
    utterance.onend = () => {
      if (!isSessionComplete && timeLeft > 0) {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          console.error("Error restarting recognition:", err);
        }
      }
    };
  };

  useEffect(() => {
    initializeSpeechRecognition();

    // Load scenarios when component mounts
    const loadScenarios = async () => {
      try {
        const defaultScenarios = [
          {
            id: 1,
            title: "Small Talk",
            context: "You're at a social gathering and meeting someone new.",
            difficulty: "Easy",
            initialPrompt:
              "Hi! I heard you recently moved to this area. How are you liking it so far?",
            suggestedResponses: [
              "I'm really enjoying exploring the neighborhood",
              "It's been a great experience so far",
              "I'm still getting used to the area",
            ],
            tips: [
              "Share a specific detail about what you like",
              "Ask them about their favorite local spots",
              "Mention something unique about the area",
            ],
          },
          {
            id: 2,
            title: "Job Interview",
            context: "You're interviewing for your dream job.",
            difficulty: "Medium",
            initialPrompt:
              "Tell me about a challenging situation you've faced and how you handled it.",
            suggestedResponses: [
              "In my previous role, I encountered...",
              "I once had to deal with...",
              "A significant challenge I faced was...",
            ],
            tips: [
              "Use the STAR method: Situation, Task, Action, Result",
              "Focus on positive outcomes",
              "Highlight your problem-solving skills",
            ],
          },
          {
            id: 3,
            title: "Networking Event",
            context: "You're at a professional networking event.",
            difficulty: "Hard",
            initialPrompt:
              "What brings you to this industry? I'd love to hear about your journey.",
            suggestedResponses: [
              "I've always been passionate about...",
              "My journey started when...",
              "What drew me to this field was...",
            ],
            tips: [
              "Share your genuine interest in the field",
              "Ask about their experience too",
              "Mention any relevant recent industry trends",
            ],
          },
        ];
        setScenarios(defaultScenarios);
      } catch (error) {
        console.error("Error loading scenarios:", error);
        setError("Failed to load scenarios. Please refresh the page.");
      }
    };

    loadScenarios();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current.removeEventListener(
          "result",
          handleRecognitionResult
        );
        recognitionRef.current.removeEventListener("end", handleRecognitionEnd);
        recognitionRef.current.removeEventListener(
          "error",
          handleRecognitionError
        );
      }
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom of conversation
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Add timer functionality
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          endConversationSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endConversationSession = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setIsListening(false);
    setIsSessionComplete(true);

    // Process any remaining transcript
    if (transcript.trim()) {
      addToConversation("user", transcript.trim());
    }

    // Add final bot message
    addToConversation(
      "bot",
      "Great conversation! Let's look at your results and see how you did."
    );

    // Calculate final metrics
    const duration = Date.now() - startTimeRef.current;
    const wordCount = conversation
      .filter((turn) => turn.speaker === "user")
      .reduce((count, turn) => count + turn.text.split(/\s+/).length, 0);
    const hesitations = conversation
      .filter((turn) => turn.speaker === "user")
      .reduce(
        (count, turn) =>
          count + (turn.text.match(/um|uh|er|ah/gi) || []).length,
        0
      );

    // Calculate scores
    const confidenceScore = Math.min(10, Math.max(1, 10 - hesitations));
    const clarityScore = Math.min(10, Math.max(1, (wordCount / 60) * 5)); // words per second * 5
    const relevanceScore = 8;
    const overallScore = Math.round(
      (confidenceScore + clarityScore + relevanceScore) / 3
    );

    // Generate feedback
    const improvements: string[] = [];
    const strengths: string[] = [];

    if (hesitations > 2) {
      improvements.push('Try to reduce filler words like "um" and "uh"');
    } else {
      strengths.push("Good job minimizing filler words!");
    }

    if (wordCount < 30) {
      improvements.push("Try to elaborate more in your responses");
    } else {
      strengths.push("Good level of detail in your responses");
    }

    if (conversation.filter((turn) => turn.speaker === "user").length < 3) {
      improvements.push("Try to engage more in the conversation");
    } else {
      strengths.push("Great engagement in the conversation!");
    }

    // Complete the conversation with metrics
    onConversationComplete({
      duration,
      wordCount,
      hesitationCount: hesitations,
      confidenceScore,
      clarityScore,
      relevanceScore,
      overallScore,
      improvements,
      strengths,
    });
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startListening = async () => {
    if (!micPermission) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission(true);
      } catch (err) {
        setError("Please allow microphone access to use voice chat.");
        return;
      }
    }

    initializeSpeechRecognition();
    setError("");
    setIsListening(true);
    setTranscript("");
    startTimeRef.current = Date.now();
    setLastSpeechTime(Date.now());
    startTimer();

    try {
      await recognitionRef.current?.start();
      addToConversation(
        "bot",
        "I'm listening... Speak clearly into your microphone."
      );
    } catch (err) {
      console.error("Start listening error:", err);
      setError("Failed to start recording. Please try again.");
      setIsListening(false);
    }
  };

  const stopListening = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);

      if (transcript.trim()) {
        addToConversation("user", transcript.trim());
        analyzeResponse();
      } else {
        setError("No speech was detected. Please try speaking again.");
      }
    } catch (err) {
      console.error("Stop listening error:", err);
      setError("Error stopping recording. Please refresh the page.");
    }
  };

  const speak = (text: string) => {
    if (synthRef.current) {
      setIsBotSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);

      utterance.onend = () => {
        setIsBotSpeaking(false);
        // Resume listening after bot finishes speaking
        if (currentScenario && !isSessionComplete && timeLeft > 0) {
          try {
            recognitionRef.current?.start();
          } catch (err) {
            console.error("Error restarting recognition:", err);
          }
        }
      };

      utterance.onerror = () => {
        setError("Failed to speak. Please check your audio settings.");
        setIsBotSpeaking(false);
      };

      synthRef.current.speak(utterance);
    }
  };

  const addToConversation = (speaker: "user" | "bot", text: string) => {
    setConversation((prev) => [
      ...prev,
      {
        speaker,
        text,
        timestamp: Date.now(),
      },
    ]);
  };

  const getContextualResponse = (userText: string): string => {
    const userTextLower = userText.toLowerCase();
    const words = userTextLower.split(" ");

    // Follow-up questions based on user's response
    if (words.length < 5) {
      return "I'd love to hear more about that. Could you elaborate a bit?";
    }

    if (
      userTextLower.includes("difficult") ||
      userTextLower.includes("hard") ||
      userTextLower.includes("nervous")
    ) {
      return "I understand this might feel challenging. Remember, it's okay to feel nervous. What specific part makes you most uncomfortable?";
    }

    if (
      userTextLower.includes("don't know") ||
      userTextLower.includes("not sure")
    ) {
      return "That's perfectly fine to be unsure. Let's break this down together. What's the first thing that comes to mind?";
    }

    if (userTextLower.includes("help") || userTextLower.includes("advice")) {
      return "I'm here to help! Let's work through this together. Would you like some specific suggestions for this situation?";
    }

    return null;
  };

  const getBotResponse = (userText: string): string => {
    if (!currentScenario) return "Let's start with a scenario first!";

    const userTextLower = userText.toLowerCase();

    // Scenario-specific responses
    if (currentScenario.title === "Small Talk") {
      if (userTextLower.includes("like") || userTextLower.includes("enjoy")) {
        return "That's wonderful! I'm curious, what's your favorite spot in the area so far?";
      }
      if (userTextLower.includes("still") || userTextLower.includes("new")) {
        return "I remember when I first moved here too. Have you had a chance to try any of the local restaurants?";
      }
      if (
        userTextLower.includes("restaurant") ||
        userTextLower.includes("food")
      ) {
        return "Oh, you should definitely check out the downtown area! What kind of cuisine do you prefer?";
      }
    }

    // First check for contextual responses
    const contextualResponse = getContextualResponse(userText);
    if (contextualResponse) return contextualResponse;

    // Check for hesitation or uncertainty
    if (
      userTextLower.includes("um") ||
      userTextLower.includes("uh") ||
      userTextLower.includes("like")
    ) {
      return "I notice some hesitation, which is completely natural! Would you like to try again? Remember, this is a safe space to practice.";
    }

    // Check if user is using suggested responses
    const usingSuggested = currentScenario.suggestedResponses.some((response) =>
      userTextLower.includes(response.toLowerCase())
    );

    if (usingSuggested) {
      const followUp = [
        "That's a great approach! How would you handle it if they responded negatively?",
        "Excellent response! What would you say next to keep the conversation going?",
        "Well done! Now, let's try a slightly different variation. How else might you express that?",
      ];
      return followUp[Math.floor(Math.random() * followUp.length)];
    }

    // Generate dynamic response based on scenario context
    const responses = [
      `That's an interesting perspective! How would you feel if someone responded with "${currentScenario.suggestedResponses[0]}"?`,
      "I like your approach! Let's explore this further. What would be your next step?",
      `You're doing great! Here's a tip: ${
        currentScenario.tips[
          Math.floor(Math.random() * currentScenario.tips.length)
        ]
      }. Would you like to try incorporating that?`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  };

  const startNewScenario = () => {
    if (scenarios.length === 0) {
      setError("No scenarios available. Please try refreshing the page.");
      return;
    }

    const randomScenario =
      scenarios[Math.floor(Math.random() * scenarios.length)];
    setCurrentScenario(randomScenario);
    setConversation([]);
    const introText = `Let's practice this scenario: ${randomScenario.context}. ${randomScenario.initialPrompt}`;
    addToConversation("bot", introText);
    setIsBotSpeaking(true); // Set bot as speaking before starting speech
    speak(introText);
  };

  const analyzeResponse = () => {
    if (!transcript || !currentScenario) return;

    const botResponse = getBotResponse(transcript.trim());
    addToConversation("bot", botResponse);
    speak(botResponse);

    setTranscript("");

    const duration = Date.now() - startTimeRef.current;

    // Calculate metrics
    const wordCount = transcript.split(/\s+/).length;
    const hesitations = (transcript.match(/um|uh|er|ah/gi) || []).length;

    // Simple scoring algorithm
    const confidenceScore = Math.min(10, Math.max(1, 10 - hesitations * 2));
    const clarityScore = Math.min(
      10,
      Math.max(1, (wordCount / (duration / 1000)) * 2)
    );
    const relevanceScore = 8; // Placeholder - would need more complex analysis

    const overallScore = Math.round(
      (confidenceScore + clarityScore + relevanceScore) / 3
    );

    // Generate feedback
    const improvements: string[] = [];
    const strengths: string[] = [];

    if (hesitations > 2) {
      improvements.push('Try to reduce filler words like "um" and "uh"');
    } else {
      strengths.push("Good job minimizing filler words!");
    }

    if (wordCount < 10) {
      improvements.push("Try to elaborate more in your responses");
    } else {
      strengths.push("Good level of detail in your response");
    }

    if (duration < 5000) {
      improvements.push("Take more time to develop your response");
    } else {
      strengths.push("Good pace of speech");
    }

    // Complete the conversation
    onConversationComplete({
      duration,
      wordCount,
      hesitationCount: hesitations,
      confidenceScore,
      clarityScore,
      relevanceScore,
      overallScore,
      improvements,
      strengths,
    });
  };

  const handleStartNewConversation = () => {
    // Clean up current recognition instance
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Reset states
    setCurrentScenario(null);
    setConversation([]);
    setTranscript("");
    setError("");
    setIsListening(false);
    setBotResponse("");
    setTimeLeft(60); // Reset timer
    setIsSessionComplete(false); // Reset session completion state

    // Request microphone permission immediately
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(() => {
        setMicPermission(true);
        // Reinitialize speech recognition
        initializeSpeechRecognition();
        // Start new scenario after cleanup
        setTimeout(() => {
          startNewScenario();
        }, 100);
      })
      .catch((err) => {
        setError("Please allow microphone access to use voice chat.");
      });
  };

  // Clean up pause detection on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-6">ConvoBoost</h1>

        {/* Timer Display */}
        {timeLeft < 60 && !isSessionComplete && (
          <div className="text-center mb-4">
            <div className="text-2xl font-bold text-blue-600">
              {timeLeft} seconds remaining
            </div>
          </div>
        )}

        {/* Error Display with Help Text */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg">
            <p className="text-red-700 mb-2">{error}</p>
            <p className="text-sm text-gray-600">
              Tips: Speak clearly into your microphone, make sure your
              microphone is working, and check your browser permissions.
            </p>
          </div>
        )}

        {/* Scenario Display */}
        {currentScenario && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">
              {currentScenario.title}
            </h2>
            <p className="text-gray-700 mb-2">{currentScenario.context}</p>
            <p className="text-blue-600">{currentScenario.initialPrompt}</p>
          </div>
        )}

        {/* Conversation History */}
        <div className="mb-6 max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
          {conversation.map((turn, index) => (
            <motion.div
              key={turn.timestamp}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 ${
                turn.speaker === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block p-3 rounded-lg ${
                  turn.speaker === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                } max-w-[80%]`}
              >
                {turn.text}
              </div>
            </motion.div>
          ))}
          <div ref={conversationEndRef} />
        </div>

        {/* Voice Controls */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex justify-center space-x-4 mb-6">
            {!isSessionComplete ? (
              <>
                <button
                  onClick={handleStartNewConversation}
                  disabled={isBotSpeaking}
                  className={`px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${
                    isBotSpeaking ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  New Scenario
                </button>
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isBotSpeaking || !currentScenario || timeLeft === 0}
                  className={`px-6 py-2 ${
                    isListening
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  } text-white rounded-lg transition-colors ${
                    isBotSpeaking || !currentScenario || timeLeft === 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isListening ? "Stop Recording" : "Start Recording"}
                </button>
              </>
            ) : (
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                View Results
              </button>
            )}
          </div>

          {/* Status Messages */}
          {isBotSpeaking && (
            <div className="flex items-center space-x-2 justify-center mt-4">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Bot is speaking...</span>
            </div>
          )}
          {isListening && (
            <div className="flex items-center space-x-2 justify-center mt-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">
                Recording...{" "}
                {transcript ? "Speech detected" : "Waiting for speech"}
              </span>
            </div>
          )}
        </div>

        {/* Current Input Display */}
        {isListening && transcript && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">{transcript}</p>
          </div>
        )}

        {botResponse && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Bot Response:</h3>
            <p className="text-gray-700">{botResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceBot;
