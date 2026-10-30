export type EmailCategory = 'config_missing' | 'suppression_lookup_failed' | 'suppressed' | 'provider_auth' | 'provider_rate_limited' | 'provider_validation' | 'provider_unavailable' | 'timeout' | 'network' | 'unknown';
export interface EmailResult {
 status: 'accepted' | 'failed' | 'skipped' | 'queued'; category: EmailCategory | null;
 httpStatus: number | null; messageId: string | null; correlationId: string; retryAfterSeconds?: number;
 /** Compatibility: true means provider accepted, never delivered. */
 success: boolean; error?: string; id?: string;
}
export const emailAccepted = (r: EmailResult) => r.status === 'accepted';
export function maskRecipient(value: string) {const [name,domain]=value.split('@');return domain ? name.slice(0,1)+'***@'+domain : '***';}
