"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { GeminiService } from '../services/gemini';

// Add Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Scenario {
  id: string;
  title: string;
  context?: string;
  description: string;
  suggestedResponses: string[];
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
    userResponse: string;
    currentScenario: Scenario | null;
    analysis?: string;
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
  const geminiServiceRef = useRef<GeminiService>(new GeminiService());

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
      const result = event.results[current];
      const transcript = result[0].transcript;

      // Only update transcript if we have actual content
      if (transcript.trim()) {
        // If this is a final result, set it directly
        if (result.isFinal) {
          setTranscript(transcript.trim());
          setLastSpeechTime(Date.now());
          
          // Store the final transcript immediately
          const currentTranscript = transcript.trim();
          localStorage.setItem("currentTranscript", currentTranscript);
          localStorage.setItem("lastUserResponse", currentTranscript);

          // Reset pause detection
          if (pauseTimeoutRef.current) {
            clearTimeout(pauseTimeoutRef.current);
          }

          // Set new pause detection timeout - 0.8 seconds
          pauseTimeoutRef.current = setTimeout(() => {
            if (transcript.trim() && !isBotSpeaking) {
              handlePause();
            }
          }, 800); // 0.8 second pause detection
        } else {
          // For interim results, store them as current transcript
          setTranscript(transcript.trim());
          localStorage.setItem("currentTranscript", transcript.trim());
        }
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

  const handlePause = async () => {
    if (!isListening || isBotSpeaking || !transcript.trim()) return;

    try {
      setIsBotSpeaking(true);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);

      // Process user's speech
      const userText = transcript.trim();
      
      // Store user's response
      localStorage.setItem("lastUserResponse", userText);
      
      // Add to conversation
      addToConversation("user", userText);
      setTranscript("");

      // Get bot's response with time context
      const timeContext = timeLeft <= 15 
        ? "Please provide a brief closing response as we're near the end of our time."
        : "Keep the response focused and concise for our one-minute conversation.";
      
      const response = await geminiServiceRef.current.generateResponse(
        `[Time remaining: ${timeLeft}s] ${userText}`,
        currentScenario
      );
      
      // Add and speak bot's response
      addToConversation("bot", response);
      speak(response);
    } catch (error) {
      console.error("Error in handlePause:", error);
      setIsBotSpeaking(false);
      addToConversation("bot", "I apologize, but I encountered an error. Could you please try again?");
      
      // Restart recognition after error
      if (!isSessionComplete && timeLeft > 0) {
        try {
          recognitionRef.current?.start();
          setIsListening(true);
        } catch (err) {
          console.error("Error restarting recognition:", err);
        }
      }
    }
  };

  useEffect(() => {
    initializeSpeechRecognition();

    // Load scenarios when component mounts
    const loadScenarios = async () => {
      try {
        const defaultScenarios = [
          {
            id: "1",
            title: "Compliment Response",
            context: "A stranger at the mall says, 'I love your outfit! Where did you get it?' You now need to respond rather than just smile and walk away.",
            description: "Practice responding graciously to a compliment while engaging in brief conversation.",
            suggestedResponses: [
              "Thank you so much! I actually got this from...",
              "That's so kind of you! I found it at...",
              "I really appreciate that! It's from...",
            ],
          },
          {
            id: "2",
            title: "Queue Cutting Confrontation",
            context: "Someone cuts in front of you in line at a coffee shop. People behind you notice and are watching to see if you'll speak up.",
            description: "Handle a line-cutting situation assertively but politely.",
            suggestedResponses: [
              "Excuse me, I believe the line starts back there...",
              "I'm sorry, but there are several people waiting in line...",
              "Hi there, we've all been waiting patiently in line...",
            ],
          },
          {
            id: "3",
            title: "Wrong Order at Restaurant",
            context: "Your food arrives completely different from what you ordered. The server asks, 'Is everything okay?' as they're about to walk away.",
            description: "Address a service issue politely but firmly.",
            suggestedResponses: [
              "Actually, I ordered the... Could we please check the order?",
              "I think there might be a mix-up with my order. I had requested...",
              "I'm sorry, but this isn't what I ordered. I had the...",
            ],
          },
          {
            id: "4",
            title: "Elevator Small Talk",
            context: "A chatty coworker you barely know gets in the elevator and asks about your weekend plans, expecting a detailed response.",
            description: "Engage in impromptu small talk while keeping it professional.",
            suggestedResponses: [
              "I'm planning to... How about you?",
              "Nothing too exciting, just going to... What are your plans?",
              "I'm looking forward to... Have you ever tried that?",
            ],
          },
          {
            id: "5",
            title: "Sales Associate Interaction",
            context: "A persistent sales associate approaches with, 'What can I help you find today?' and won't take 'just looking' for an answer.",
            description: "Handle persistent sales approaches professionally.",
            suggestedResponses: [
              "I'm actually interested in... Could you tell me more about...?",
              "I'm exploring options for... What would you recommend?",
              "I'm comparing... What are your thoughts on...?",
            ],
          },
          {
            id: "6",
            title: "Birthday Spotlight",
            context: "Colleagues surprise you with a cake and everyone is staring, waiting for you to make a little speech.",
            description: "Handle unexpected attention gracefully.",
            suggestedResponses: [
              "Wow, this is such a wonderful surprise! I want to thank...",
              "I'm truly touched by this gesture. It means a lot that...",
              "This is so thoughtful of everyone! I really appreciate...",
            ],
          },
          {
            id: "7",
            title: "Neighbor Introduction",
            context: "A new neighbor knocks on your door introducing themselves and invites you to their housewarming party this weekend.",
            description: "Respond to an unexpected social invitation.",
            suggestedResponses: [
              "Welcome to the neighborhood! Thank you for the invitation...",
              "It's great to meet you! About the party...",
              "How nice to meet you! That's very kind of you to invite...",
            ],
          },
          {
            id: "8",
            title: "Project Leadership Opportunity",
            context: "Your usually quiet contribution to a meeting was so good that your boss suddenly says, 'Great idea! Why don't you lead this project?'",
            description: "Handle an unexpected professional opportunity.",
            suggestedResponses: [
              "Thank you for the opportunity. I'd be happy to...",
              "I appreciate the confidence in my idea. I would love to...",
              "That's exciting! I have some thoughts on how we could...",
            ],
          },
          {
            id: "9",
            title: "Wedding Reception Introduction",
            context: "You're seated at a table with complete strangers at a wedding who immediately ask, 'So how do you know the couple?'",
            description: "Engage in social conversation with strangers.",
            suggestedResponses: [
              "I actually know the [bride/groom] from... How about you?",
              "We met through... What's your connection to the couple?",
              "I've known [them] since... It's such a lovely celebration, isn't it?",
            ],
          },
          {
            id: "10",
            title: "Medical Appointment Mix-up",
            context: "The receptionist calls your name loudly in the waiting room, but when you approach, they say there's been a scheduling error. You need to explain and advocate for your appointment.",
            description: "Handle a scheduling conflict assertively but politely.",
            suggestedResponses: [
              "I have a confirmed appointment for... Could we please check...?",
              "I received a confirmation for today's appointment. Let me show you...",
              "There must be some confusion. I scheduled this appointment...",
            ],
          }
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

  // Add timer functionality - Start when scenario begins
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
        // Add warning when 15 seconds remain
        if (prev === 15) {
          addToConversation(
            "bot",
            "15 seconds remaining. Let's wrap up this conversation."
          );
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endConversationSession = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    setIsListening(false);
    setIsSessionComplete(true);

    // Get all user responses from conversation
    const userResponses = conversation
      .filter((turn) => turn.speaker === "user")
      .map((turn) => turn.text);

    // Get the current transcript from state and localStorage
    const currentTranscript = transcript.trim() || localStorage.getItem("currentTranscript") || "";
    
    // If there's a current transcript, add it to conversation
    if (currentTranscript) {
      addToConversation("user", currentTranscript);
      userResponses.push(currentTranscript);
    }

    // Get the final response (either the last response or the current transcript)
    const finalResponse = userResponses.length > 0 ? userResponses[userResponses.length - 1] : "";

    try {
      // Get detailed analysis from Gemini
      const analysisPrompt = `
      Analyze this ${currentScenario?.title || 'conversation'} based on the following interaction:

      SCENARIO: ${currentScenario?.title || 'General Conversation'}
      CONTEXT: ${currentScenario?.description || 'Having a natural conversation'}
      
      CONVERSATION:
      ${conversation.map(turn => `${turn.speaker.toUpperCase()}: ${turn.text}`).join('\n')}

      Please analyze:
      1. Overall communication style and effectiveness
      2. Response quality and relevance
      3. Specific strengths in the responses
      4. Areas that need improvement
      5. Provide 3 examples of better ways to phrase key responses

      FORMAT THE RESPONSE AS:
      COMMUNICATION STYLE: (2-3 sentences about overall communication approach)
      RESPONSE QUALITY: (2-3 sentences about content and relevance)
      STRENGTHS: (bullet points)
      IMPROVEMENTS NEEDED: (bullet points)
      BETTER PHRASINGS:
      1. [Original response] -> [Improved version]
      2. [Original response] -> [Improved version]
      3. [Original response] -> [Improved version]`;

      const { analysis, suggestedResponses } = await geminiServiceRef.current.analyzeConversation(
        conversation.filter(turn => turn.speaker === "user").map(turn => turn.text).join(" "),
        currentScenario
      );

      // Calculate metrics
      const duration = Date.now() - startTimeRef.current;
      const allUserText = userResponses.join(" ");
      const wordCount = allUserText.split(/\s+/).filter(word => word.length > 0).length;
      const hesitations = (allUserText.match(/um|uh|er|ah/gi) || []).length;

      // Calculate detailed scores based on analysis
      const confidenceScore = Math.min(10, Math.max(1, 10 - hesitations));
      const clarityScore = Math.round(Math.min(10, Math.max(1, (wordCount / 60) * 5)));
      const relevanceScore = 8;
      const overallScore = Math.round(
        (confidenceScore + clarityScore + relevanceScore) / 3
      );

      // Store results in localStorage for the analysis page
      const analysisData = {
        duration,
        wordCount,
        hesitationCount: hesitations,
        confidenceScore,
        clarityScore,
        relevanceScore,
        overallScore,
        improvements: [],
        strengths: [],
        userResponse: finalResponse,
        currentScenario,
        analysis,
        suggestedResponses,
        conversationHistory: conversation
      };

      localStorage.setItem('conversationAnalysis', JSON.stringify(analysisData));

      // Redirect to analysis page
      window.location.href = '/analysis';

    } catch (error) {
      console.error('Error in endConversationSession:', error);
      // Handle error and still redirect
      const duration = Date.now() - startTimeRef.current;
      const errorData = {
        duration,
        wordCount: 0,
        hesitationCount: 0,
        confidenceScore: 0,
        clarityScore: 0,
        relevanceScore: 0,
        overallScore: 0,
        improvements: ['Unable to analyze response. Please try again.'],
        strengths: [],
        userResponse: finalResponse,
        currentScenario,
        analysis: 'Analysis unavailable due to an error.',
        suggestedResponses: [],
        conversationHistory: conversation
      };

      localStorage.setItem('conversationAnalysis', JSON.stringify(errorData));
      window.location.href = '/analysis';
    }
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

    try {
      initializeSpeechRecognition();
      setError("");
      setIsListening(true);
      setTranscript("");
      startTimeRef.current = Date.now();
      setLastSpeechTime(Date.now());

      if (recognitionRef.current) {
        recognitionRef.current.start();
        addToConversation(
          "bot",
          "I'm listening... Speak clearly into your microphone."
        );
      } else {
        throw new Error("Speech recognition not initialized");
      }
    } catch (err) {
      console.error("Start listening error:", err);
      setError("Failed to start recording. Please try again.");
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);

      if (transcript.trim()) {
        // Store the current response immediately
        const currentResponse = transcript.trim();
        localStorage.setItem("currentTranscript", currentResponse);
        localStorage.setItem("lastUserResponse", currentResponse);

        // Add user's response to conversation
        addToConversation("user", currentResponse);

        // Get immediate bot response using Gemini API
        const botResponse = await getBotResponse(currentResponse);
        addToConversation("bot", botResponse);
        speak(botResponse);

        // Calculate quick metrics for immediate feedback
        const wordCount = currentResponse.split(/\s+/).filter(word => word.length > 0).length;
        const hesitations = (currentResponse.match(/um|uh|er|ah/gi) || []).length;
        const duration = Date.now() - startTimeRef.current;

        // Calculate scores for immediate feedback
        const confidenceScore = Math.min(10, Math.max(1, 10 - hesitations));
        const clarityScore = Math.round(Math.min(10, Math.max(1, (wordCount / 10) * 2)));
        const relevanceScore = 8;

        // Show quick feedback in conversation
        const quickFeedback = [];
        if (hesitations > 2) {
          quickFeedback.push("Try to reduce filler words in your next response.");
        }
        if (wordCount < 10) {
          quickFeedback.push("Consider providing more details in your response.");
        }
        if (quickFeedback.length > 0) {
          addToConversation("bot", "Quick feedback: " + quickFeedback.join(" "));
        }

        setTranscript("");
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
        // Automatically start listening after bot finishes speaking
        if (currentScenario && !isSessionComplete && timeLeft > 0) {
          try {
            recognitionRef.current?.start();
            setIsListening(true);
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

  const getBotResponse = async (userText: string): Promise<string> => {
    if (!currentScenario) return "Let's start with a scenario first!";

    try {
      const response = await geminiServiceRef.current.generateResponse(userText, currentScenario);
      return response;
    } catch (error) {
      console.error('Error getting bot response:', error);
      return "I apologize, but I encountered an error. Could you please try again?";
    }
  };

  const startNewScenario = async (selectedScenario?: Scenario) => {
    if (scenarios.length === 0) {
      setError("No scenarios available. Please try refreshing the page.");
      return;
    }

    const scenarioToUse = selectedScenario || scenarios[Math.floor(Math.random() * scenarios.length)];
    setCurrentScenario(scenarioToUse);
    setConversation([]);

    // Initialize Gemini with the new scenario
    await geminiServiceRef.current.startNewConversation(scenarioToUse);
    
    const introText = `Let's practice this ${scenarioToUse.title} scenario. ${scenarioToUse.description}. ${scenarioToUse.context}`;
    addToConversation("bot", introText);
    setIsBotSpeaking(true);
    speak(introText);

    // Start the timer when bot starts speaking the intro
    startTimer();
    startTimeRef.current = Date.now();
  };

  const analyzeResponse = async () => {
    if (!transcript || !currentScenario) return;

    try {
      const botResponse = await getBotResponse(transcript.trim());
    addToConversation("bot", botResponse);
    speak(botResponse);

      // Store the current response immediately
      const currentResponse = transcript.trim();
      localStorage.setItem("currentTranscript", currentResponse);
      localStorage.setItem("lastUserResponse", currentResponse);

      // Get all user responses including the current transcript
      const userResponses = conversation
        .filter((turn) => turn.speaker === "user")
        .map((turn) => turn.text);
      userResponses.push(currentResponse);

      // Join all responses for analysis
      const allUserText = userResponses.join(" ");

    // Calculate metrics
      const wordCount = allUserText.split(/\s+/).filter(word => word.length > 0).length;
      const hesitations = (allUserText.match(/um|uh|er|ah/gi) || []).length;
      const duration = Date.now() - startTimeRef.current;

      // Calculate scores
      const confidenceScore = Math.min(10, Math.max(1, 10 - hesitations));
      const clarityScore = Math.round(Math.min(
      10,
      Math.max(1, (wordCount / (duration / 1000)) * 2)
      ));
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

      // Complete the conversation with the current response
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
        userResponse: currentResponse,
        currentScenario,
        analysis: undefined
      });

      setTranscript("");
    } catch (error) {
      console.error("Error analyzing response:", error);
      setError("Failed to analyze response. Please try again.");
    }
  };

  const handleStartNewConversation = async () => {
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
    setTimeLeft(60);
    setIsSessionComplete(false);

    // Reset Gemini conversation
    await geminiServiceRef.current.clearHistory();

    // Request microphone permission and start new scenario
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission(true);
      initializeSpeechRecognition();
      startNewScenario();
    } catch (err) {
      setError("Please allow microphone access to use voice chat.");
    }
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
        <h1 className="text-3xl font-bold text-center mb-6">SoloraAI</h1>

        {/* Main Practice Screen with Direct Scenario Selection */}
        {!currentScenario && !isSessionComplete && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4 text-center">Choose a Practice Scenario:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              {scenarios.map((scenario) => (
                <motion.div
                  key={scenario.id}
                  whileHover={{ scale: 1.02 }}
                  className="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200"
                  onClick={() => startNewScenario(scenario)}
                >
                  <h3 className="font-semibold text-lg mb-2 text-blue-700">{scenario.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                  <div className="bg-white p-3 rounded-md mt-2">
                    <p className="text-xs text-gray-500">{scenario.context}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

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
            <p className="text-gray-700 mb-2">{currentScenario.description}</p>
          </div>
        )}

        {/* Current Input Display */}
        {isListening && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">
                {transcript ? "Speaking detected" : "Waiting for speech..."}
              </span>
            </div>
            {transcript && (
              <p className="text-gray-600 mt-2">{transcript}</p>
            )}
          </div>
        )}

        {/* Bot Speaking Indicator */}
        {isBotSpeaking && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-600">Bot is speaking...</span>
            </div>
          </div>
        )}

        {/* Voice Controls */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex justify-center space-x-4">
            {!isSessionComplete && (
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
                {currentScenario && (
                  <>
                    <button
                      onClick={startListening}
                      disabled={isListening || isBotSpeaking}
                      className={`px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors ${
                        isListening || isBotSpeaking ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Start Recording
                    </button>
                    <button
                      onClick={stopListening}
                      disabled={!isListening || isBotSpeaking}
                      className={`px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors ${
                        !isListening || isBotSpeaking ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      Stop Recording
                    </button>
                  </>
                )}
              </>
            )}
            {isSessionComplete && (
              <button
                onClick={() => (window.location.href = "/analysis")}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                View Analysis
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceBot;
