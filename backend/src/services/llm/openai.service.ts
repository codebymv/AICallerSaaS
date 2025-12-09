// ============================================
// OpenAI LLM Service - Conversation Logic
// ============================================

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ResponseWithTools {
  content: string | null;
  toolCalls: ToolCall[] | null;
}

// Calendar tools for appointment scheduling
export const CALENDAR_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_calendar_availability',
      description: 'Check available appointment time slots for a specific date. Use this when a caller asks about availability or wants to book an appointment.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'The date to check availability for, in YYYY-MM-DD format. If the caller says "tomorrow", "next Monday", etc., convert it to the actual date.',
          },
        },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment at a specific time. Use this after the caller has selected a time slot and provided their contact information.',
      parameters: {
        type: 'object',
        properties: {
          datetime: {
            type: 'string',
            description: 'The datetime for the appointment in ISO 8601 format (e.g., 2024-12-10T14:00:00)',
          },
          name: {
            type: 'string',
            description: 'The full name of the person booking the appointment',
          },
          email: {
            type: 'string',
            description: 'Email address for confirmation',
          },
          phone: {
            type: 'string',
            description: 'Phone number for the appointment',
          },
          notes: {
            type: 'string',
            description: 'Any additional notes or reason for the appointment',
          },
        },
        required: ['datetime', 'name'],
      },
    },
  },
];

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number = 0.7,
    maxTokens: number = 150
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('[OpenAI] Error:', error);
      throw error;
    }
  }

  async *streamResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number = 0.7,
    maxTokens: number = 150
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ],
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      logger.error('[OpenAI] Streaming error:', error);
      throw error;
    }
  }

  /**
   * Stream response and emit complete sentences for TTS
   * This is optimized for voice - we want to start TTS as soon as we have a complete sentence
   */
  async *streamSentences(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number = 0.7,
    maxTokens: number = 150
  ): AsyncGenerator<{ sentence: string; isComplete: boolean }, void, unknown> {
    let buffer = '';
    const sentenceEnders = /([.!?])\s/g;

    for await (const chunk of this.streamResponse(messages, systemPrompt, temperature, maxTokens)) {
      buffer += chunk;

      // Check for complete sentences
      let match;
      let lastIndex = 0;
      sentenceEnders.lastIndex = 0;

      while ((match = sentenceEnders.exec(buffer)) !== null) {
        const sentence = buffer.slice(lastIndex, match.index + 1).trim();
        if (sentence) {
          yield { sentence, isComplete: false };
        }
        lastIndex = match.index + match[0].length;
      }

      // Keep remaining text in buffer
      if (lastIndex > 0) {
        buffer = buffer.slice(lastIndex);
      }
    }

    // Emit any remaining text
    if (buffer.trim()) {
      yield { sentence: buffer.trim(), isComplete: true };
    }
  }

  /**
   * Generate response with tool/function calling support
   * Used when AI needs to interact with external services (calendar, etc.)
   */
  async generateResponseWithTools(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    tools: OpenAI.Chat.ChatCompletionTool[],
    temperature: number = 0.7,
    maxTokens: number = 300
  ): Promise<ResponseWithTools> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'tool',
            content: m.content,
          })),
        ],
        tools,
        tool_choice: 'auto',
        temperature,
        max_tokens: maxTokens,
      });

      const message = response.choices[0]?.message;

      // Parse tool calls if present
      let toolCalls: ToolCall[] | null = null;
      if (message?.tool_calls && message.tool_calls.length > 0) {
        toolCalls = message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        }));
      }

      return {
        content: message?.content || null,
        toolCalls,
      };
    } catch (error) {
      logger.error('[OpenAI] Tool calling error:', error);
      throw error;
    }
  }

  /**
   * Continue conversation after tool execution
   * Provides tool results back to the model to generate a natural response
   */
  async continueAfterToolCall(
    messages: Array<{ role: string; content: string; tool_call_id?: string; name?: string }>,
    systemPrompt: string,
    toolCallId: string,
    toolName: string,
    toolResult: string,
    temperature: number = 0.7,
    maxTokens: number = 200
  ): Promise<string> {
    try {
      // Build messages including the tool response
      const fullMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => {
          if (m.role === 'tool') {
            return {
              role: 'tool' as const,
              content: m.content,
              tool_call_id: m.tool_call_id!,
            };
          }
          return {
            role: m.role as 'user' | 'assistant',
            content: m.content,
          };
        }),
        {
          role: 'tool',
          content: toolResult,
          tool_call_id: toolCallId,
        },
      ];

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: fullMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('[OpenAI] Continue after tool error:', error);
      throw error;
    }
  }
}
