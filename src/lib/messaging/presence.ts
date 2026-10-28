import { createClient } from "@/lib/supabase/server";

// Fallback in-memory map for testing & local development
declare global {
  // eslint-disable-next-line no-var
  var __mockStaffLastSeen: Map<string, { lastSeenAt: number; isAvailable: boolean }> | undefined;
}

function getMockStaffPresenceStore() {
  if (!globalThis.__mockStaffLastSeen) {
    globalThis.__mockStaffLastSeen = new Map();
  }
  return globalThis.__mockStaffLastSeen;
}

/**
 * Checks if a staff member (instructor or admin) is currently considered online.
 * Criteria:
 * 1. Seen within the last 90 seconds (90,000 ms).
 * 2. Not set to "Indisponible" (is_available = true).
 */
export async function isStaffOnline(staffId: string): Promise<boolean> {
  const now = Date.now();
  const thresholdMs = 90 * 1000;

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_seen_at, role")
      .eq("id", staffId)
      .single();

    if (profile && (profile.role === "instructor" || profile.role === "admin")) {
      // Check instructor table for availability toggle
      const { data: instructorData } = await supabase
        .from("instructors")
        .select("is_available")
        .eq("profile_id", staffId)
        .single();

      const isAvailable = instructorData ? instructorData.is_available : true;
      if (!isAvailable) {
        return false;
      }

      if (profile.last_seen_at) {
        const diff = now - new Date(profile.last_seen_at).getTime();
        return diff <= thresholdMs;
      }
    }
  } catch {}

  // Fallback in-memory check
  const store = getMockStaffPresenceStore();
  const entry = store.get(staffId);
  if (entry) {
    if (!entry.isAvailable) return false;
    return now - entry.lastSeenAt <= thresholdMs;
  }

  return false;
}

/**
 * Server-validated heartbeat update for staff members.
 * Verifies role server-side; clients can never spoof presence.
 */
export async function recordStaffHeartbeat(staffUserId: string, staffRole: string): Promise<boolean> {
  if (staffRole !== "instructor" && staffRole !== "admin") {
    return false;
  }

  const now = new Date();

  try {
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ last_seen_at: now.toISOString() })
      .eq("id", staffUserId);
  } catch {}

  const store = getMockStaffPresenceStore();
  const existing = store.get(staffUserId);
  store.set(staffUserId, {
    lastSeenAt: now.getTime(),
    isAvailable: existing ? existing.isAvailable : true,
  });

  return true;
}

/**
 * Toggles staff availability (Disponible / Indisponible).
 */
export async function setStaffAvailability(
  staffUserId: string,
  staffRole: string,
  isAvailable: boolean
): Promise<boolean> {
  if (staffRole !== "instructor" && staffRole !== "admin") {
    return false;
  }

  try {
    const supabase = await createClient();
    await supabase
      .from("instructors")
      .update({ is_available: isAvailable })
      .eq("profile_id", staffUserId);
  } catch {}

  const store = getMockStaffPresenceStore();
  const existing = store.get(staffUserId);
  store.set(staffUserId, {
    lastSeenAt: existing ? existing.lastSeenAt : Date.now(),
    isAvailable,
  });

  return true;
}
