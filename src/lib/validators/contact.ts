import { z } from "zod";

export const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "nameRequired" })
    .max(100),
  contact: z
    .string()
    .trim()
    .min(5, { message: "contactRequired" })
    .max(150),
  message: z
    .string()
    .trim()
    .min(10, { message: "messageRequired" })
    .max(2500),
  hp: z.string().optional(), // Honeypot anti-spam field
});

export type ContactInput = z.infer<typeof contactSchema>;
