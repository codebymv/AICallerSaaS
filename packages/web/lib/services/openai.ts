import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI;
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    this.client = new OpenAI({ apiKey });
  }
  
  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature: number = 0.7
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature,
        max_tokens: 150, // Keep responses concise for voice
      });
      
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('[OpenAI] Error:', error);
      throw error;
    }
  }
  
  async generateStreamingResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    onChunk: (text: string) => void,
    temperature: number = 0.7
  ): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature,
        max_tokens: 150,
        stream: true,
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('[OpenAI] Streaming error:', error);
      throw error;
    }
  }
  
  async countTokens(text: string): Promise<number> {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
