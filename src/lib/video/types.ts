export interface VideoProvider {
  /**
   * Retrieves a signed playback URL for a lesson.
   * Enforces enrollment or free preview verification before returning the URL.
   */
  getPlaybackUrl(lessonId: string, userId: string): Promise<string>;
}

export interface DirectUploadResult {
  videoId: string;
  uploadUrl: string;
  authorizationSignature: string;
  authorizationExpire: number;
  libraryId: string;
}

export interface BunnyStreamConfig {
  libraryId: string;
  apiKey: string;
  tokenAuthKey: string;
  cdnHostname?: string;
}
