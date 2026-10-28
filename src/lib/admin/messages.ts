import { createClient } from "@/lib/supabase/server";
export * from "./message-types";
import type { ContactMessageItem } from "./message-types";

declare global {
  // eslint-disable-next-line no-var
  var __mockMessagesStore: ContactMessageItem[] | undefined;
}

function initializeFallbackMessages(): ContactMessageItem[] {
  if (!globalThis.__mockMessagesStore) {
    globalThis.__mockMessagesStore = [
      {
        id: "msg-1",
        name: "Jean-Baptiste Dorval",
        contact: "+50941445566",
        message:
          "Bonjou ekip Faro School, mwen sot voye 3 800 HTG sou kont NatCash machann nan pou fòmasyon Anglais des Affaires. Kòd SMS mwen se NAT-TX-776622. Èske nou ka aktive kou a pou mwen tanpri ?",
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: "msg-2",
        name: "Wideline Saintil",
        contact: "wideline.saintil@gmail.com",
        message:
          "Bonjour, j'aimerais savoir si le certificat délivré après la formation Marketing Digital est reconnu par les entreprises ou s'il comporte un code de vérification officiel ?",
        read: false,
        readAt: null,
        createdAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
      },
      {
        id: "msg-3",
        name: "Pierre-Louis Guerrier",
        contact: "+50937223344",
        message:
          "Kou a vrèman bon ! Mwen fin gade tout videyo Excel yo. Eske n ap soti yon dezyèm nivo avanse byento ?",
        read: true,
        readAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
      },
      {
        id: "msg-4",
        name: "Marie-Flore Baptiste",
        contact: "marieflore.b@yahoo.fr",
        message:
          "Bonjour, je rencontre un problème de connexion lors de la lecture des vidéos sur mon smartphone Digicel. La page charge un peu lentement. Avez-vous une option de basse résolution ?",
        read: true,
        readAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 52 * 3600 * 1000).toISOString(),
      },
    ];
  }
  return globalThis.__mockMessagesStore;
}

export function toggleFallbackMessageRead(id: string, read: boolean): void {
  const store = initializeFallbackMessages();
  const msg = store.find((m) => m.id === id);
  if (msg) {
    msg.read = read;
    msg.readAt = read ? new Date().toISOString() : null;
  }
}

export function deleteFallbackMessage(id: string): void {
  const store = initializeFallbackMessages();
  const idx = store.findIndex((m) => m.id === id);
  if (idx >= 0) {
    store.splice(idx, 1);
  }
}

export async function getAdminMessagesList(): Promise<ContactMessageItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contact_messages")
      .select("id, name, contact, message, read, read_at, created_at")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((m: any) => ({
        id: m.id,
        name: m.name,
        contact: m.contact,
        message: m.message,
        read: m.read === true,
        readAt: m.read_at || null,
        createdAt: m.created_at,
      }));
    }
  } catch (err) {
    console.warn("Using fallback messages store:", err);
  }

  return initializeFallbackMessages();
}
