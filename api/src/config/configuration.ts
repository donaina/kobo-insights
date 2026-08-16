export interface AppConfig {
  port: number;
  // AI is an optional upgrade. It is only "enabled" when the flag is on AND a
  // key is present, so a misconfigured flag can never half-enable it.
  aiEnabled: boolean;
  anthropicApiKey: string;
  categorizeModel: string;
  askModel: string;
  maxUploadRows: number;
}

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(): AppConfig {
  const key = process.env.ANTHROPIC_API_KEY || '';
  return {
    port: toInt(process.env.PORT, 3001),
    aiEnabled: process.env.AI_ENABLED === 'true' && key.length > 0,
    anthropicApiKey: key,
    categorizeModel: process.env.KOBO_CATEGORIZE_MODEL || 'claude-haiku-4-5',
    askModel: process.env.KOBO_ASK_MODEL || 'claude-sonnet-5',
    maxUploadRows: toInt(process.env.MAX_UPLOAD_ROWS, 5000),
  };
}

export const CONFIG = Symbol('APP_CONFIG');
