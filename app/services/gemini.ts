import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";

// Create conversation history types
export type ConversationHistory = {
  role: 'user' | 'bot';
  content: string;
  timestamp: number;
  scenario?: string;
}[];

export type ConversationStorage = {
  currentTranscript: string;
  lastUserResponse: string;
  conversationHistory: ConversationHistory;
  previousResponses: string[];
};

export class GeminiService {
  private model: ChatGoogleGenerativeAI;
  private memory: BufferMemory;
  private chain: ConversationChain;
  private history: ConversationHistory = [];
  private currentScenarioContext: string = '';
  private previousResponses: Set<string> = new Set();
  private currentTranscript: string = '';
  private lastUserResponse: string = '';
  
  private systemPrompt = `You are an advanced AI conversation partner helping users practice their speaking skills. Your goal is to create a natural, engaging dialogue while providing constructive feedback.

  Core Guidelines:
  1. Never repeat previous responses
  2. Maintain conversation context
  3. Provide specific, relevant feedback
  4. Ask insightful follow-up questions
  5. Adapt your tone to the scenario

  For job interviews:
  - Focus on candidate's achievements and growth
  - Ask about specific examples and metrics
  - Explore problem-solving approaches
  - Discuss leadership and teamwork experiences
  - Guide towards highlighting unique skills
  
  For small talk:
  - Create comfortable, natural flow
  - Share relevant personal anecdotes
  - Explore common interests
  - Show genuine curiosity
  - Keep the tone light and friendly
  
  For networking:
  - Focus on professional experiences
  - Explore industry trends
  - Discuss career development
  - Share valuable insights
  - Build meaningful connections`;

  constructor() {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    
    // Initialize the model with configuration
    this.model = new ChatGoogleGenerativeAI({
      apiKey: API_KEY,
      modelName: "gemini-1.5-pro-latest",
      maxOutputTokens: 2048,
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
    });

    // Initialize memory and conversation chain
    this.memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      inputKey: "input",
      outputKey: "output",
    });

    this.chain = new ConversationChain({
      llm: this.model,
      memory: this.memory,
    });

    this.loadConversationFromStorage();
  }

  private loadConversationFromStorage() {
    try {
      if (typeof window !== 'undefined') {
        const savedData = localStorage.getItem('conversationData');
        if (savedData) {
          const parsedData: ConversationStorage = JSON.parse(savedData);
          this.currentTranscript = parsedData.currentTranscript || '';
          this.lastUserResponse = parsedData.lastUserResponse || '';
          this.history = parsedData.conversationHistory || [];
          this.previousResponses = new Set(parsedData.previousResponses || []);
          this.restoreConversationHistory();
        }
      }
    } catch (error) {
      console.error('Error loading conversation from storage:', error);
    }
  }

  private async restoreConversationHistory() {
    try {
      await this.memory.clear();
      
      // Convert history to LangChain message format and add to memory
      for (const msg of this.history) {
        if (msg.role === 'user') {
          await this.memory.chatHistory.addMessage(
            new HumanMessage({ content: msg.content })
          );
        } else {
          await this.memory.chatHistory.addMessage(
            new AIMessage({ content: msg.content })
          );
        }
      }
    } catch (error) {
      console.error('Error restoring conversation history:', error);
    }
  }

  private saveConversationToStorage() {
    try {
      if (typeof window !== 'undefined') {
        const conversationData: ConversationStorage = {
          currentTranscript: this.currentTranscript,
          lastUserResponse: this.lastUserResponse,
          conversationHistory: this.history,
          previousResponses: Array.from(this.previousResponses)
        };
        localStorage.setItem('conversationData', JSON.stringify(conversationData));
      }
    } catch (error) {
      console.error('Error saving conversation to storage:', error);
    }
  }

  async generateResponse(userInput: string, currentScenario?: { title: string; description: string }): Promise<string> {
    try {
      this.currentTranscript = userInput;
      this.lastUserResponse = userInput;

      // Format the conversation context
      const conversationContext = this.history
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');

      // Create the full prompt with context and time awareness
      const fullPrompt = `
      ${this.systemPrompt}

      IMPORTANT TIME CONSTRAINT: This is a 1-minute conversation practice session. Keep responses concise and focused.

      CURRENT SCENARIO: ${currentScenario?.title || 'General Conversation'}
      SCENARIO CONTEXT: ${currentScenario?.description || 'Having a natural conversation'}
      
      CONVERSATION HISTORY:
      ${conversationContext}
      
      CURRENT USER INPUT: "${userInput}"
      
      Instructions for 1-minute conversation:
      1. Keep responses brief but meaningful (15-20 words)
      2. Focus on the most relevant points
      3. Ask focused follow-up questions
      4. Maintain natural conversation flow
      5. Stay strictly on topic
      6. Guide user towards scenario objectives
      7. Ensure responses can be spoken in 5-7 seconds

      Previous responses to avoid:
      ${Array.from(this.previousResponses).join('\n')}

      YOUR RESPONSE (keep it concise):`;

      // Create message array for the model
      const messages = [
        new SystemMessage(fullPrompt),
        new HumanMessage(userInput)
      ];

      // Get model response
      const result = await this.model.invoke(messages);
      let botMessage = String(result.content || '');

      // Ensure response is concise
      if (botMessage.length > 150) {
        botMessage = botMessage.split('.')[0] + '.';
      }

      if (!botMessage) {
        throw new Error('Empty response from Gemini API');
      }

      // Update conversation history
      const currentTime = Date.now();
      this.history.push({
        role: 'user',
        content: userInput,
        timestamp: currentTime,
        scenario: currentScenario?.title
      });

      this.history.push({
        role: 'bot',
        content: botMessage,
        timestamp: currentTime + 1,
        scenario: currentScenario?.title
      });

      // Update memory
      await this.memory.chatHistory.addMessage(new HumanMessage({ content: userInput }));
      await this.memory.chatHistory.addMessage(new AIMessage({ content: botMessage }));

      // Store the response and save state
      this.previousResponses.add(botMessage);
      this.saveConversationToStorage();

      return botMessage;
    } catch (error) {
      console.error('Error generating response:', error);
      return this.getFallbackResponse(currentScenario?.title);
    }
  }

  private getFallbackResponse(scenarioType: string = 'General'): string {
    const fallbackResponses = {
      'Job Interview': [
        "Tell me about your most relevant experience.",
        "What specific skills would you bring to this role?",
        "How do you handle challenges in your work?",
        "What interests you about this position?"
      ],
      'Small Talk': [
        "What brings you here today?",
        "How are you finding the event so far?",
        "What's your take on this?",
        "Tell me more about that."
      ],
      'Networking Event': [
        "What's your current role?",
        "What industry trends interest you?",
        "How did you enter this field?",
        "What projects are you working on?"
      ]
    };

    const responses = fallbackResponses[scenarioType as keyof typeof fallbackResponses] || [
      "Could you elaborate on that?",
      "What's your perspective on this?",
      "Tell me more about your experience.",
      "How do you approach that?"
    ];

    const unusedResponses = responses.filter(r => !this.previousResponses.has(r));
    const fallbackResponse = unusedResponses.length > 0 
      ? unusedResponses[Math.floor(Math.random() * unusedResponses.length)]
      : responses[Math.floor(Math.random() * responses.length)];

    this.previousResponses.add(fallbackResponse);
    return fallbackResponse;
  }

  async clearHistory(): Promise<void> {
    this.history = [];
    this.previousResponses.clear();
    this.currentTranscript = '';
    this.lastUserResponse = '';
    
    await this.memory.clear();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('conversationData');
    }
  }

  async startNewConversation(scenario?: { title: string; description: string }): Promise<void> {
    await this.clearHistory();
    
    if (scenario) {
      const introMessage = `Let's practice this scenario: ${scenario.title}. I'll be your conversation partner. ${scenario.description}`;
      
      this.history.push({
        role: 'bot',
        content: introMessage,
        timestamp: Date.now(),
        scenario: scenario.title
      });
      
      this.currentScenarioContext = scenario.description || '';
      await this.memory.chatHistory.addMessage(new SystemMessage(this.systemPrompt));
      await this.memory.chatHistory.addMessage(new AIMessage(introMessage));
      
      this.saveConversationToStorage();
    }
  }

  // Getter methods
  getCurrentTranscript(): string {
    return this.currentTranscript;
  }

  getLastUserResponse(): string {
    return this.lastUserResponse;
  }

  getConversationHistory(): ConversationHistory {
    return this.history;
  }

  getPreviousResponses(): string[] {
    return Array.from(this.previousResponses);
  }

  getCompleteConversationData(): ConversationStorage {
    return {
      currentTranscript: this.currentTranscript,
      lastUserResponse: this.lastUserResponse,
      conversationHistory: this.history,
      previousResponses: Array.from(this.previousResponses)
    };
  }

  async analyzeConversation(userResponse: string, currentScenario?: { title: string; description: string }): Promise<{ analysis: string; suggestedResponses: string[] }> {
    try {
      const analysisPrompt = `
      You are an expert conversation analyst. Analyze the following response in the context of ${currentScenario?.title || 'general conversation'}.
      
      SCENARIO: ${currentScenario?.title || 'General Conversation'}
      CONTEXT: ${currentScenario?.description || 'Having a natural conversation'}
      USER RESPONSE: "${userResponse}"

      Provide a detailed analysis of:
      1. Content relevance
      2. Communication clarity
      3. Engagement level
      4. Areas for improvement
      5. Specific strengths

      FORMAT YOUR RESPONSE AS A NATURAL PARAGRAPH WITHOUT BULLET POINTS.
      `;

      const suggestionsPrompt = `
      Based on the following conversation context:
      
      SCENARIO: ${currentScenario?.title || 'General Conversation'}
      CONTEXT: ${currentScenario?.description || 'Having a natural conversation'}
      USER RESPONSE: "${userResponse}"

      Generate 3 alternative responses that would be highly effective in this scenario. Each response should:
      1. Be natural and conversational
      2. Demonstrate best practices for ${currentScenario?.title || 'conversation'}
      3. Show different approaches to the same situation
      4. Be specific and detailed
      
      FORMAT EACH RESPONSE AS A COMPLETE SENTENCE OR PARAGRAPH.
      `;

      // Get analysis
      const analysisResult = await this.model.invoke([
        new SystemMessage(analysisPrompt),
        new HumanMessage(userResponse)
      ]);
      
      // Get suggested responses
      const suggestionsResult = await this.model.invoke([
        new SystemMessage(suggestionsPrompt),
        new HumanMessage(userResponse)
      ]);

      const analysis = String(analysisResult.content || '');
      const suggestionsText = String(suggestionsResult.content || '');
      
      // Split suggestions into array and clean up
      const suggestedResponses = suggestionsText
        .split(/\d+\.|\n\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 3);

      return {
        analysis: analysis,
        suggestedResponses: suggestedResponses
      };
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return {
        analysis: 'Unable to generate analysis at this time.',
        suggestedResponses: this.getDefaultSuggestedResponses(currentScenario?.title)
      };
    }
  }

  private getDefaultSuggestedResponses(scenarioType: string = 'General'): string[] {
    const defaultResponses = {
      'Job Interview': [
        "I have extensive experience leading cross-functional teams and delivering successful projects. For example, in my last role, I managed a team of 5 developers to launch a new product feature that increased user engagement by 40%.",
        "My approach to problem-solving involves breaking down complex issues into manageable components and collaborating with team members to find innovative solutions. I recently used this method to optimize our deployment process, reducing deployment time by 60%.",
        "I believe in continuous learning and growth. I regularly attend industry conferences, participate in workshops, and mentor junior developers to stay current with technology trends and improve my leadership skills."
      ],
      'Small Talk': [
        "That's fascinating! I recently read an article about that topic. What got you interested in it initially?",
        "I've had similar experiences in my travels. The cultural differences really make you think about how diverse our perspectives can be.",
        "It's amazing how technology is changing the way we live and work. I'm particularly excited about the potential impact of AI on everyday life."
      ],
      'Networking Event': [
        "I've been working on implementing AI solutions in healthcare, focusing on improving patient care through predictive analytics. What areas of innovation are you most excited about?",
        "The recent shifts in remote work have really transformed how teams collaborate. I'd love to hear about how your organization has adapted to these changes.",
        "I'm always looking to connect with professionals who share an interest in sustainable technology. Have you been involved in any green tech initiatives?"
      ]
    };

    return defaultResponses[scenarioType as keyof typeof defaultResponses] || [
      "Could you elaborate more on your perspective? I'm particularly interested in your thought process.",
      "That's an interesting approach. How did you develop that strategy?",
      "Your experience sounds valuable. What key lessons would you say you've learned from it?"
    ];
  }
} 