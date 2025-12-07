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
}
