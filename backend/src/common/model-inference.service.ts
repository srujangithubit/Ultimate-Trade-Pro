import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

interface OllamaChatResponse {
  message: { role: string; content: string };
}

@Injectable()
export class ModelInferenceService {
  private readonly logger = new Logger(ModelInferenceService.name);
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly timeout: number;
  private inflightAbort: AbortController | null = null;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'MODEL_BASE_URL',
      'http://localhost:11434',
    );
    this.modelName = this.configService.get<string>(
      'MODEL_NAME',
      'qwen2.5vl:3b',
    );
    this.timeout = this.configService.get<number>('MODEL_TIMEOUT', 600000);
    this.logger.log(
      `Model inference configured: ${this.modelName} @ ${this.baseUrl}`,
    );
  }

  async generateText(
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    return this.callOllama(messages, 2048, 1024);
  }

  async generateWithImage(
    systemPrompt: string,
    userMessage: string,
    base64Image: string,
  ): Promise<string> {
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage, images: [base64Image] },
    ];
    return this.callOllama(messages, 2048, 1024);
  }

  parseJson<T = unknown>(raw: string): T {
    let cleaned = raw.trim();
    // Strip markdown fences
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    // Extract first JSON object if surrounded by text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    return JSON.parse(cleaned) as T;
  }

  private async callOllama(
    messages: OllamaMessage[],
    numCtx: number,
    numPredict: number,
  ): Promise<string> {
    // Cancel any in-flight request to avoid parallel model loads
    if (this.inflightAbort) {
      this.inflightAbort.abort();
    }
    const controller = new AbortController();
    this.inflightAbort = controller;
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseUrl}/api/chat`;
      const body = JSON.stringify({
        model: this.modelName,
        messages,
        stream: false,
        options: {
          temperature: 0.1,
          num_ctx: numCtx,
          num_predict: numPredict,
          num_gpu: 99,
        },
      });

      this.logger.log(
        `Calling ${this.modelName} — payload: ${(body.length / 1024).toFixed(0)}KB, ctx: ${numCtx}, maxTokens: ${numPredict}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(
          `Ollama returned ${response.status}: ${errText.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as OllamaChatResponse;
      const content = data.message?.content ?? '';

      if (!content) {
        throw new Error('Model returned empty response');
      }

      return content;
    } finally {
      clearTimeout(timer);
      if (this.inflightAbort === controller) {
        this.inflightAbort = null;
      }
    }
  }
}
