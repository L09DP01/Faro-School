import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffOnline } from "@/lib/messaging/presence";
import { getMockEscalationsStore, getMockMessagesStore, getMockConversationsStore } from "@/lib/messaging/data";

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}

async function handleCron(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET || "faro-cron-secret-key";

  const isAuthorized =
    authHeader === `Bearer ${expectedSecret}` ||
    cronSecretHeader === expectedSecret ||
    process.env.NODE_ENV !== "production";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized cron call" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  let processedCount = 0;
  let sentCount = 0;

  const bilingualNotice =
    "Le formateur n'est pas en ligne pour le moment. Reviens plus tard, quand il sera en ligne. Tu recevras une notification dès sa réponse.\n\nFòmatè a pa an liy pou kounye a. Retounen pita lè l an liy. W ap resevwa yon notifikasyon le l reponn.";

  // 1. Supabase Query
  try {
    const supabase = await createClient();
    const { data: escalations } = await supabase
      .from("escalations")
      .select(`
        id,
        conversation_id,
        deadline_at,
        created_at,
        conversations (
          id,
          staff_id,
          student_id
        )
      `)
      .is("resolved_at", null)
      .is("followup_sent_at", null)
      .lte("deadline_at", nowIso);

    if (escalations && escalations.length > 0) {
      for (const esc of escalations) {
        processedCount++;
        const staffId = (esc.conversations as any)?.staff_id;
        const convId = esc.conversation_id;

        // Check if staff is still offline
        const staffOnline = await isStaffOnline(staffId);
        if (!staffOnline) {
          // Check if staff has already replied
          const { data: staffMsgs } = await supabase
            .from("messages")
            .select("id")
            .eq("conversation_id", convId)
            .eq("sender_type", "staff")
            .gte("created_at", esc.created_at)
            .limit(1);

          if (!staffMsgs || staffMsgs.length === 0) {
            // Post system message
            await supabase.from("messages").insert({
              conversation_id: convId,
              sender_type: "system",
              body: bilingualNotice,
              created_at: nowIso,
            });

            // Mark followup_sent_at to guarantee it is NEVER sent twice
            await supabase
              .from("escalations")
              .update({ followup_sent_at: nowIso })
              .eq("id", esc.id);

            sentCount++;
          }
        }
      }
    }
  } catch {}

  // 2. Mock store checking (for test scenarios and local runtime)
  const mockEscalations = getMockEscalationsStore();
  const mockMessagesMap = getMockMessagesStore();
  const mockConvs = getMockConversationsStore();

  for (const esc of mockEscalations) {
    if (!esc.resolvedAt && !esc.followupSentAt && new Date(esc.deadlineAt) <= now) {
      processedCount++;
      const conv = mockConvs.find((c) => c.id === esc.conversationId);
      const staffOnline = conv ? await isStaffOnline(conv.staffId) : false;

      if (!staffOnline) {
        const msgs = mockMessagesMap.get(esc.conversationId) || [];
        const hasStaffReply = msgs.some(
          (m) => m.senderType === "staff" && new Date(m.createdAt) >= new Date(esc.createdAt)
        );

        if (!hasStaffReply) {
          msgs.push({
            id: `msg-cron-${Date.now()}`,
            conversationId: esc.conversationId,
            senderType: "system",
            senderName: "Faro School",
            body: bilingualNotice,
            createdAt: nowIso,
          });
          esc.followupSentAt = nowIso;
          sentCount++;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    processedCount,
    sentCount,
    timestamp: nowIso,
  });
}
