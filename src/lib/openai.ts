import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// Lazy proxy - avoids instantiation at build time when env vars aren't available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const openai = new Proxy({} as OpenAI, {
  get(_, prop: string | symbol) {
    return (getOpenAI() as any)[prop];
  },
});
