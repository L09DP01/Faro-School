import type { VideoProvider, DirectUploadResult } from "./types";
import { checkLessonAccess } from "./access";
import { sha256Hex } from "./crypto";

export class BunnyStreamProvider implements VideoProvider {
  private libraryId: string;
  private apiKey: string;
  private tokenAuthKey: string;
  private pullZoneHostname: string;

  constructor() {
    this.libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || "";
    this.apiKey = process.env.BUNNY_STREAM_API_KEY || "";
    this.tokenAuthKey = process.env.BUNNY_STREAM_TOKEN_AUTH_KEY || "";
    this.pullZoneHostname =
      process.env.BUNNY_STREAM_HOSTNAME || "video.faroschool.com";
  }

  /**
   * Generates a signed token playback URL for a lesson.
   * Enforces:
   * 1. Access verification (free preview or enrolled student / admin)
   * 2. Path-style token authentication for HLS
   * 3. Expiry under 2 hours (default 3600 seconds = 1 hour)
   */
  async getPlaybackUrl(
    lessonId: string,
    userId: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const access = await checkLessonAccess(lessonId, userId);

    if (!access.canAccess || !access.videoId) {
      throw new Error(
        "Accès refusé : vous devez être inscrit à cette formation ou la leçon doit être un aperçu gratuit."
      );
    }

    // Expiry must be under 2 hours (7200s) as per security rules
    const safeExpiresIn = Math.min(expiresInSeconds, 7199);
    const expires = Math.floor(Date.now() / 1000) + safeExpiresIn;

    // Bunny Stream token authentication hash:
    // Format: SHA256(tokenAuthKey + videoId + expires)
    const rawSignature = `${this.tokenAuthKey}${access.videoId}${expires}`;
    const token = await sha256Hex(rawSignature);

    // Return signed HLS playback playlist URL or signed Bunny iframe embed URL
    // Bunny embed player with token authentication:
    return `https://iframe.mediadelivery.net/embed/${this.libraryId}/${access.videoId}?token=${token}&expires=${expires}`;
  }

  /**
   * Generates a direct browser upload signature so students or instructors
   * can upload video directly to Bunny Stream without sending heavy files through the web server.
   */
  async createDirectUpload(
    title: string,
    expiresInSeconds: number = 3600
  ): Promise<DirectUploadResult> {
    if (!this.libraryId || !this.apiKey) {
      throw new Error("Bunny Stream credentials not configured");
    }

    // Step 1: Create video entry in Bunny Stream Library
    const createRes = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos`,
      {
        method: "POST",
        headers: {
          AccessKey: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ title }),
      }
    );

    if (!createRes.ok) {
      throw new Error("Bunny video creation failed");
    }

    const videoData = (await createRes.json()) as { guid: string };
    const videoId = videoData.guid;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId))throw Error("Bunny video response invalid");

    // Step 2: Generate authorization signature for direct TUS / HTTP upload
    // Bunny signature format: SHA256(libraryId + apiKey + expirationTime + videoId)
    const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const rawSignature = `${this.libraryId}${this.apiKey}${expirationTime}${videoId}`;
    const authorizationSignature = await sha256Hex(rawSignature);

    const uploadUrl = "https://video.bunnycdn.com/tusupload";

    return {
      videoId,
      uploadUrl,
      authorizationSignature,
      authorizationExpire: expirationTime,
      libraryId: this.libraryId,
    };
  }
}
