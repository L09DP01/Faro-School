import { getContactEmail, getWhatsAppNumber, getPublicEnv } from "@/lib/env.public";

export const contactConfig = {
  email: getContactEmail(),
  phone: getPublicEnv().NEXT_PUBLIC_SUPPORT_PHONE,
  whatsapp: getWhatsAppNumber(),
  address: getPublicEnv().NEXT_PUBLIC_COMPANY_ADDRESS,
};
