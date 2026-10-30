import { z } from "zod";

export const certificateNameSchema = z.string().trim().min(2).max(60)
  .regex(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u).transform(s=>s.normalize("NFC"));
export const CERTIFICATE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function certificateNumber(now = new Date()): string {
  let suffix = "";
  // Rejection sampling avoids modulo bias.
  while (suffix.length < 8) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < Math.floor(256 / CERTIFICATE_ALPHABET.length) * CERTIFICATE_ALPHABET.length) {
        suffix += CERTIFICATE_ALPHABET[byte % CERTIFICATE_ALPHABET.length];
        if (suffix.length === 8) break;
      }
    }
  }
  return `FARO-${now.getUTCFullYear()}-${suffix}`;
}
export interface Certificate {
  id: string; user_id: string; course_id: string; enrollment_id: string | null;
  certificate_number: string; student_name: string; course_title: string; instructor_name: string;
  content_hours: number; issued_at: string; revoked_at: string | null; revoked_reason?: string | null;
  email_sent_at?: string | null;
  signature_name: string; signature_title: string; signature_image_path: string | null;
  courses?: { slug: string; cover_url: string | null; instructor_id?: string | null };
}
export interface CertificateSettings { signature_name: string; signature_title: string; signature_image_path: string | null }
export interface CertificateEligibility { eligible: boolean; completed: number; total: number; required: number; certificate: Certificate | null }
export type PublicCertificate = { status: "not_found" } | { status: "revoked"; revoked_at: string } |
 { status: "valid"; student_name: string; course_title: string; issued_at: string; instructor_name: string };
export function publicCertificate(row: Certificate | null): PublicCertificate {
  if (!row) return { status: "not_found" };
  if (row.revoked_at) return { status: "revoked", revoked_at: row.revoked_at };
  return { status: "valid", student_name: row.student_name, course_title: row.course_title, issued_at: row.issued_at, instructor_name: row.instructor_name };
}
export function verificationUrl(base: string, number: string) {
  return `${base.replace(/\/$/, "")}/fr/verification/${encodeURIComponent(number)}`;
}
export function canDownloadCertificate(user: { id: string; role: string }, cert: Certificate) {
  return user.id === cert.user_id || user.role === "admin";
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
}
