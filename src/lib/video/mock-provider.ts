import type { VideoProvider } from "./types";
import { checkLessonAccess } from "./access";

export class MockVideoProvider implements VideoProvider {
  async getPlaybackUrl(lessonId: string, userId: string): Promise<string> {
    const access = await checkLessonAccess(lessonId, userId);

    if (!access.canAccess) {
      throw new Error(
        "Accès refusé : vous devez être inscrit à cette formation pour visionner cette leçon."
      );
    }

    // Mock video stream (HLS test stream or educational placeholder)
    return `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4#lesson=${lessonId}&mock_access=granted`;
  }
}
