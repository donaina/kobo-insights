// Test environment setup — runs once per test file
// Keeps the optional AI layer off by default unless a test explicitly enables it.
process.env.AI_ENABLED = 'false';
process.env.ANTHROPIC_API_KEY = '';
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.DATABASE_URL = 'file:./test.db';
process.env.KOBO_CATEGORIZE_MODEL = 'claude-haiku-4-5';
process.env.KOBO_ASK_MODEL = 'claude-sonnet-5';
process.env.MAX_UPLOAD_ROWS = '5000';