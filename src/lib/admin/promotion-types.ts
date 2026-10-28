import { z } from "zod";

export interface CouponItem {
  id: string;
  code: string;
  discountType: "percent" | "amount";
  discountValue: number;
  percentOff: number | null;
  amountOffHtg: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export const couponFormSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .min(3, "Le code doit comporter au moins 3 caractères")
    .max(30, "Le code ne peut dépasser 30 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code ne doit contenir que des majuscules, chiffres et tirets"),
  discountType: z.enum(["percent", "amount"]),
  discountValue: z.number().int().positive("La valeur de réduction doit être positive"),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.discountType === "percent") {
      return data.discountValue >= 1 && data.discountValue <= 100;
    }
    return data.discountValue > 0;
  },
  {
    message: "Le pourcentage de réduction doit être compris entre 1% et 100%",
    path: ["discountValue"],
  }
);

export type CouponFormData = z.infer<typeof couponFormSchema>;
