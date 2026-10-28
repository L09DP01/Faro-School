import { createClient } from "@/lib/supabase/server";
import { sha256Base64Url } from "./crypto";

export class BunnyStorage {
  private cdnHostname: string;
  private tokenSecurityKey: string;

  constructor() {
    this.cdnHostname =
      process.env.BUNNY_STORAGE_CDN_HOSTNAME || "cdn.faroschool.com";
    this.tokenSecurityKey =
      process.env.BUNNY_STORAGE_TOKEN_KEY || "mock-storage-token-key";
  }

  /**
   * Generates public CDN URL for non-sensitive assets (e.g. course cover images).
   */
  getPublicUrl(path: string): string {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `https://${this.cdnHostname}/${cleanPath}`;
  }

  /**
   * Generates a signed CDN URL with token authentication for downloadable lesson resources.
   * Enforces that the user is enrolled in the course (or is an admin) before generating the signed URL.
   */
  async getSignedResourceUrl(
    resourcePath: string,
    userId: string,
    courseId: string,
    expiresInSeconds: number = 3600
  ): Promise<string> {
    const supabase = await createClient();

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    const isAdmin = profile?.role === "admin";

    if (!isAdmin) {
      // Check enrollment
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .single();

      if (!enrollment) {
        throw new Error(
          "Accès refusé : vous devez être inscrit à la formation pour télécharger cette ressource."
        );
      }
    }

    const cleanPath = resourcePath.startsWith("/")
      ? resourcePath
      : `/${resourcePath}`;
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

    // Bunny CDN token authentication signature:
    // Format: base64_url_safe(SHA256(securityKey + path + expires))
    const rawString = `${this.tokenSecurityKey}${cleanPath}${expires}`;
    const token = await sha256Base64Url(rawString);

    return `https://${this.cdnHostname}${cleanPath}?token=${token}&expires=${expires}`;
  }
}
