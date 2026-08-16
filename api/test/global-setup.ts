// Global test setup — runs once before all tests
// Ensures a clean SQLite file for the test run.
import { unlinkSync } from 'fs';

const dbPath = `${process.cwd()}/test.db`;
try {
  unlinkSync(dbPath);
} catch {
  // ignore
}