import 'server-only';

/** Only operational identifiers enter logs. Never include a database error message. */
const DATABASE_CODES = new Set(['PGRST202', 'PGRST204', 'PGRST301', '42P01', '42703', '42501', '23505', '23503', '57014']);
export function logEmailFailure(stage: string, error?: unknown, correlationId = crypto.randomUUID()) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  console.error('[email] pipeline_failed', {
    stage, correlationId,
    ...(typeof code === 'string' && DATABASE_CODES.has(code) ? { databaseCode: code } : {}),
  });
}
