import Anthropic from '@anthropic-ai/sdk';

export interface TextGenerator { readonly model: string; generate(system: string, user: string, maxTokens: number): Promise<string> }
export const AI_GENERATOR = 'AI_GENERATOR';

/** Text-only generation through the Claude API. No tools are exposed to the model. */
export class AnthropicGenerator implements TextGenerator {
  private client: Anthropic;
  constructor(apiKey: string, readonly model: string) { this.client = new Anthropic({ apiKey }); }

  async generate(system: string, user: string, maxTokens: number) {
    const res = await this.client.messages.create({ model: this.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
    return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  }
}
