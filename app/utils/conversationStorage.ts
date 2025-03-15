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
}

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

export const saveConversationResult = (
  scenario: string,
  metrics: ConversationMetrics
): void => {
  try {
    // Get existing history
    const existingHistory = localStorage.getItem("conversationHistory");
    const history: ConversationHistory[] = existingHistory
      ? JSON.parse(existingHistory)
      : [];

    // Create new conversation record
    const newConversation: ConversationHistory = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      scenario,
      duration: metrics.duration,
      overallScore: metrics.overallScore,
      confidenceScore: metrics.confidenceScore,
      clarityScore: metrics.clarityScore,
      relevanceScore: metrics.relevanceScore,
    };

    // Add to history
    history.unshift(newConversation); // Add to beginning of array

    // Keep only last 10 conversations
    const updatedHistory = history.slice(0, 10);

    // Save updated history
    localStorage.setItem("conversationHistory", JSON.stringify(updatedHistory));
  } catch (error) {
    console.error("Error saving conversation result:", error);
  }
};

export const getConversationHistory = (): ConversationHistory[] => {
  try {
    const history = localStorage.getItem("conversationHistory");
    return history ? JSON.parse(history) : [];
  } catch (error) {
    console.error("Error getting conversation history:", error);
    return [];
  }
};

export const clearConversationHistory = (): void => {
  try {
    localStorage.setItem("conversationHistory", JSON.stringify([]));
  } catch (error) {
    console.error("Error clearing conversation history:", error);
  }
};
