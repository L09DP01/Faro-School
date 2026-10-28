import { createAdminClient } from "@/lib/supabase/admin";

export interface DeviceSessionResult {
  allowed: boolean;
  activeDevicesCount: number;
  error?: string;
  sessionId?: string;
}

const MAX_OTHER_DEVICES = 2; // Maximum concurrent devices allowed

/**
 * Checks and manages playback device sessions.
 * Refuses playback if the student account already has 2 or more other active devices.
 * A session is considered active if ended_at is null and last_seen_at is within the last 90 seconds.
 */
export async function registerOrHeartbeatSession(
  userId: string,
  deviceId: string,
  userAgent?: string
): Promise<DeviceSessionResult> {
  const supabase = createAdminClient();
  const ninetySecondsAgo = new Date(Date.now() - 90 * 1000).toISOString();

  // 1. Fetch currently active sessions from OTHER devices
  const { data: otherActiveSessions } = await supabase
    .from("playback_sessions")
    .select("id, device_id, last_seen_at")
    .eq("user_id", userId)
    .neq("device_id", deviceId)
    .is("ended_at", null)
    .gt("last_seen_at", ninetySecondsAgo);

  const activeOtherCount = otherActiveSessions?.length || 0;

  // 2. If 2 or more other active devices are playing, refuse access
  if (activeOtherCount >= MAX_OTHER_DEVICES) {
    return {
      allowed: false,
      activeDevicesCount: activeOtherCount,
      error: "deviceLimitExceeded",
    };
  }

  // 3. Find existing session record for this device
  const { data: existingSession } = await supabase
    .from("playback_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingSession) {
    // Refresh heartbeat
    await supabase
      .from("playback_sessions")
      .update({
        last_seen_at: new Date().toISOString(),
        ended_at: null,
        user_agent: userAgent,
      })
      .eq("id", existingSession.id);

    return {
      allowed: true,
      activeDevicesCount: activeOtherCount + 1,
      sessionId: existingSession.id,
    };
  }

  // 4. Create new device session
  const { data: newSession, error } = await supabase
    .from("playback_sessions")
    .insert({
      user_id: userId,
      device_id: deviceId,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !newSession) {
    throw new Error(`Failed to create playback session: ${error?.message}`);
  }

  return {
    allowed: true,
    activeDevicesCount: activeOtherCount + 1,
    sessionId: newSession.id,
  };
}

/**
 * Terminates all other active playback sessions for this user,
 * keeping only the requesting device active.
 */
export async function terminateOtherSessions(
  userId: string,
  keepDeviceId: string
): Promise<{ terminatedCount: number }> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("playback_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .neq("device_id", keepDeviceId)
    .is("ended_at", null)
    .select("id");

  return {
    terminatedCount: data?.length || 0,
  };
}
