
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  raw: unknown;
}

const AI_API_URL = process.env.EXPO_PUBLIC_AI_API_URL;

export async function askAI(
  prompt: string,
  options?: {
    systemPrompt?: string;
    history?: AIMessage[];
  },
): Promise<AIResponse> {
  const question = prompt.trim();

  if (!question) {
    throw new Error('Pertanyaan AI tidak boleh kosong.');
  }

  if (!AI_API_URL) {
    throw new Error(
      'AI belum dikonfigurasi. Atur EXPO_PUBLIC_AI_API_URL ke endpoint backend AI milikmu.',
    );
  }

  const messages: AIMessage[] = [
    ...(options?.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }]
      : []),
    ...(options?.history ?? []),
    { role: 'user', content: question },
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Permintaan AI gagal (HTTP ${response.status}).`);
    }

    const raw: unknown = await response.json();

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('Respons AI tidak memiliki format yang benar.');
    }

    const data = raw as Record<string, unknown>;

    // Mendukung format respons sederhana dari backend:
    // { "text": "..." } atau { "reply": "..." }
    // serta format choices[0].message.content yang umum digunakan.
    let text: string | undefined;

    if (typeof data.text === 'string') {
      text = data.text;
    } else if (typeof data.reply === 'string') {
      text = data.reply;
    } else if (Array.isArray(data.choices)) {
      const first = data.choices[0];

      if (typeof first === 'object' && first !== null) {
        const choice = first as Record<string, unknown>;
        const message = choice.message;

        if (typeof message === 'object' && message !== null) {
          const content = (message as Record<string, unknown>).content;
          if (typeof content === 'string') text = content;
        }
      }
    }

    if (!text) {
      throw new Error('Respons AI tidak berisi teks jawaban.');
    }

    return { text, raw };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Permintaan AI melewati batas waktu 30 detik.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function askRantauAssistant(
  question: string,
  history: AIMessage[] = [],
): Promise<string> {
  const result = await askAI(question, {
    systemPrompt:
      'Kamu adalah asisten Rantau Yuk. Jawab dalam bahasa Indonesia, ' +
      'jelas, praktis, dan ramah. Jangan mengarang data pengguna.',
    history,
  });

  return result.text;
}
