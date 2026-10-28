"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  saveLessonProgressAction,
  saveLessonNoteAction,
  heartbeatSessionAction,
  terminateOtherSessionsAction,
} from "@/app/actions/video";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  Check,
  CheckCircle2,
  FileText,
  Download,
  BookOpen,
  HelpCircle,
  MessageSquare,
  Edit3,
  Loader2,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

/**
 * SECURITY NOTICE:
 * The dynamic floating watermark (student name + phone number) and disabled context menus
 * provide visual deterrence and social accountability against unauthorized redistribution.
 * However, we state honestly that client-side watermarking and DRM cannot make dedicated
 * screen recording or external camera capture impossible, as anything rendered on an
 * analog/digital display can technically be re-recorded.
 */

interface ResourceItem {
  id: string;
  name: string;
  file_url: string;
}

interface LessonItem {
  id: string;
  title: string;
  position: number;
  duration_sec: number;
  is_free_preview: boolean;
}

interface ModuleItem {
  id: string;
  title: string;
  position: number;
  lessons: LessonItem[];
}

interface LessonPlayerClientProps {
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonDescription: string;
  posterUrl?: string | null;
  modules: ModuleItem[];
  resources: ResourceItem[];
  completedLessonIds: string[];
  initialPositionSec: number;
  user: {
    name: string;
    phone: string;
  };
  locale: string;
}

export function LessonPlayerClient({
  courseSlug,
  courseTitle,
  lessonId,
  lessonTitle,
  lessonDescription,
  posterUrl,
  modules,
  resources,
  completedLessonIds: initialCompletedIds,
  initialPositionSec,
  user,
  locale,
}: LessonPlayerClientProps) {
  const t = useTranslations("player");
  const router = useRouter();

  // Video and container refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Video State
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialPositionSec);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-device Limit State
  const [deviceBlocked, setDeviceBlocked] = useState(false);
  const [terminatingOthers, setTerminatingOthers] = useState(false);

  // Completion & Progress State
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompletedIds);
  const [autoCompleteTriggered, setAutoCompleteTriggered] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [courseCompletedCertCode, setCourseCompletedCertCode] = useState<string | null>(null);

  // Tabs & Notes State
  const [activeTab, setActiveTab] = useState<"description" | "resources" | "questions" | "notes">("description");
  const [notesContent, setNotesContent] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Mobile drawer state
  const [curriculumDrawerOpen, setCurriculumDrawerOpen] = useState(false);

  // Dynamic Floating Watermark State (changes position every 15-30s)
  const [watermarkPos, setWatermarkPos] = useState({ top: 25, left: 30 });

  // Flattened lessons list to find next/previous and current module info
  const allLessons: LessonItem[] = [];
  let currentModuleIndex = 0;
  let currentLessonIndexInModule = 0;

  for (let mIdx = 0; mIdx < modules.length; mIdx++) {
    const mod = modules[mIdx];
    for (let lIdx = 0; lIdx < mod.lessons.length; lIdx++) {
      const l = mod.lessons[lIdx];
      allLessons.push(l);
      if (l.id === lessonId) {
        currentModuleIndex = mIdx;
        currentLessonIndexInModule = lIdx;
      }
    }
  }

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const isCurrentCompleted = completedIds.includes(lessonId);
  const totalCompletedCount = completedIds.length;
  const courseProgressPercent =
    allLessons.length > 0 ? Math.round((totalCompletedCount / allLessons.length) * 100) : 0;

  // Initials for avatar
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "ET";

  // 1. Device ID Helper
  const getOrCreateDeviceId = useCallback(() => {
    if (typeof document === "undefined") return "dev_ssr";
    const cookies = document.cookie.split("; ");
    for (const cookie of cookies) {
      const [name, val] = cookie.split("=");
      if (name === "faro_device_id" && val) return val;
    }
    const newId = `dev_${Math.random().toString(36).substring(2, 12)}_${Date.now()}`;
    document.cookie = `faro_device_id=${newId}; path=/; max-age=31536000; SameSite=Lax`;
    return newId;
  }, []);

  // 2. Dynamic Watermark Movement (moves every 15-30 seconds)
  useEffect(() => {
    const moveWatermark = () => {
      const top = Math.floor(15 + Math.random() * 65);
      const left = Math.floor(10 + Math.random() * 60);
      setWatermarkPos({ top, left });
    };

    moveWatermark();
    const intervalTime = (15 + Math.random() * 15) * 1000;
    const interval = setInterval(moveWatermark, intervalTime);

    return () => clearInterval(interval);
  }, []);

  // 3. Heartbeat & Session Management (every 30s via Server Action)
  useEffect(() => {
    const deviceId = getOrCreateDeviceId();

    const sendHeartbeat = async () => {
      try {
        const res = await heartbeatSessionAction(deviceId);
        if (!res.allowed) {
          setDeviceBlocked(true);
        } else {
          setDeviceBlocked(false);
        }
      } catch {
        // Silently continue
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(heartbeatInterval);
  }, [getOrCreateDeviceId]);

  // 4. Terminate other sessions action via Server Action
  const handleTerminateOtherSessions = async () => {
    setTerminatingOthers(true);
    const deviceId = getOrCreateDeviceId();
    try {
      const res = await terminateOtherSessionsAction(deviceId);
      if (res.success) {
        setDeviceBlocked(false);
        router.refresh();
      }
    } catch {
      // Ignore
    } finally {
      setTerminatingOthers(false);
    }
  };

  // 5. Fetch Playback URL & Silent Token Renewal
  const fetchPlaybackUrl = useCallback(async () => {
    setLoadingVideo(true);
    setVideoError(null);
    try {
      const res = await fetch(`/api/video/playback?lessonId=${lessonId}`);
      const data = await res.json();

      if (!res.ok || !data.playbackUrl) {
        throw new Error(data.error || t("errors.loadFailed"));
      }

      setPlaybackUrl(data.playbackUrl);
    } catch (err: any) {
      setVideoError(err.message || t("errors.loadFailed"));
    } finally {
      setLoadingVideo(false);
    }
  }, [lessonId, t]);

  useEffect(() => {
    fetchPlaybackUrl();
    const tokenRefresh = setInterval(fetchPlaybackUrl, 45 * 60 * 1000);
    return () => clearInterval(tokenRefresh);
  }, [fetchPlaybackUrl]);

  // 6. Resume playback from saved position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (initialPositionSec > 0 && initialPositionSec < video.duration - 5) {
        video.currentTime = initialPositionSec;
        setCurrentTime(initialPositionSec);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [initialPositionSec, playbackUrl]);

  // 7. Save Playback Progress via Server Action
  const saveProgress = useCallback(
    async (posSec: number, markCompleted: boolean = false) => {
      try {
        const res = await saveLessonProgressAction(lessonId, posSec, markCompleted);
        if (res.certificateIssued && res.certificateCode) {
          setCourseCompletedCertCode(res.certificateCode);
        }
      } catch {
        // Silently catch network blips
      }
    },
    [lessonId]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Auto-complete at 90% watched
      if (
        video.duration > 0 &&
        video.currentTime / video.duration >= 0.9 &&
        !autoCompleteTriggered &&
        !isCurrentCompleted
      ) {
        setAutoCompleteTriggered(true);
        setCompletedIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]));
        saveProgress(video.currentTime, true);

        if (nextLesson) {
          setCountdown(5);
        }
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      saveProgress(video.currentTime, false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setHasStartedPlaying(true);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("pause", handlePause);
    video.addEventListener("play", handlePlay);

    const interval = setInterval(() => {
      if (video && !video.paused) {
        saveProgress(video.currentTime, false);
      }
    }, 10000);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("play", handlePlay);
      clearInterval(interval);
    };
  }, [autoCompleteTriggered, isCurrentCompleted, lessonId, nextLesson, saveProgress]);

  // 8. Countdown Timer for Next Lesson
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        if (nextLesson) {
          router.push(`/dashboard/learn/${courseSlug}/${nextLesson.id}`);
        }
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, nextLesson, router, courseSlug]);

  // 9. Manual "Mark as Complete" Action
  const handleToggleComplete = async () => {
    const shouldMark = !isCurrentCompleted;
    if (shouldMark) {
      setCompletedIds((prev) => [...prev, lessonId]);
    } else {
      setCompletedIds((prev) => prev.filter((id) => id !== lessonId));
    }
    const currentPos = videoRef.current ? videoRef.current.currentTime : currentTime;
    await saveProgress(currentPos, shouldMark);
  };

  // 10. Fetch & Save Notes
  useEffect(() => {
    let isMounted = true;
    const fetchNotes = async () => {
      try {
        const res = await fetch(`/api/video/notes?lessonId=${lessonId}`);
        const data = await res.json();
        if (isMounted && data.content !== undefined) {
          setNotesContent(data.content);
        }
      } catch {
        // Silently ignore
      }
    };
    fetchNotes();
    return () => {
      isMounted = false;
    };
  }, [lessonId]);

  const handleNotesChange = (text: string) => {
    setNotesContent(text);
    setNotesSaved(false);
  };

  useEffect(() => {
    if (!notesContent) return;
    setNotesSaving(true);
    const timeout = setTimeout(async () => {
      try {
        await saveLessonNoteAction(lessonId, notesContent);
        setNotesSaving(false);
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      } catch {
        setNotesSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [notesContent, lessonId]);

  // 11. Play/Pause toggle handler
  const handlePlayToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  // 12. Fullscreen toggle handler
  const handleFullscreenToggle = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // 13. Keyboard Shortcuts (Space, Arrows, N, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayToggle();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        video.currentTime = Math.min(video.duration, video.currentTime + 5);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleFullscreenToggle();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        video.muted = !video.muted;
        setIsMuted(video.muted);
      } else if (e.key === "n" || e.key === "N") {
        if (nextLesson) {
          e.preventDefault();
          router.push(`/dashboard/learn/${courseSlug}/${nextLesson.id}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextLesson, router, courseSlug]);

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || duration === 0) return;

    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newPercent = Math.max(0, Math.min(1, clickX / rect.width));
    video.currentTime = newPercent * duration;
    setCurrentTime(newPercent * duration);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Watermark text: Student Name + Phone Number
  const watermarkText = `${user.name || "Étudiant Faro"} • ${user.phone || ""}`.trim();

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      {/* ========================================================= */}
      {/* 1. SLIM WHITE TOP BAR                                     */}
      {/* ========================================================= */}
      <header className="h-16 border-b border-line bg-surface px-4 sm:px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-subtle">
        {/* Left: Back Arrow + Course Title + Module/Lesson Muted Line */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href="/dashboard/formations"
            className="w-9 h-9 rounded-xl border border-line bg-surface hover:bg-bg text-navy hover:text-orange flex items-center justify-center transition-colors shrink-0 shadow-sm"
            title="Retour aux formations"
            aria-label="Retour aux formations"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </Link>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-heading font-bold text-navy-deep truncate max-w-[180px] sm:max-w-xs md:max-w-md">
              {courseTitle}
            </h1>
            <p className="text-[11px] text-muted-faro font-sans truncate">
              Module {currentModuleIndex + 1} · Leçon {currentLessonIndexInModule + 1}
            </p>
          </div>
        </div>

        {/* Right: Progress bar + Percentage + Avatar + Mobile Drawer Toggle */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Contacter le formateur button */}
          <Link
            href={`/dashboard/messages` as any}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line hover:border-navy text-xs font-heading font-semibold text-navy bg-surface hover:bg-bg transition-colors shadow-subtle"
            title="Poser une question au formateur"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue" />
            <span className="hidden md:inline">Contacter le formateur</span>
          </Link>

          {/* 160px Blue Progress Bar */}
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-24 sm:w-[160px] h-2 rounded-full bg-line overflow-hidden">
              <div
                className="h-full bg-blue rounded-full transition-all"
                style={{ width: `${courseProgressPercent}%` }}
              />
            </div>
            <span className="text-xs font-heading font-bold text-blue whitespace-nowrap">
              {courseProgressPercent}%
            </span>
          </div>

          {/* Round amber-to-orange avatar */}
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange text-white font-heading font-bold flex items-center justify-center text-xs shadow-subtle border-2 border-surface shrink-0"
            title={user.name}
            aria-label="Profil"
          >
            {initials}
          </div>

          {/* Curriculum Drawer Toggle on Mobile */}
          <button
            type="button"
            onClick={() => setCurriculumDrawerOpen(true)}
            className="lg:hidden px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-bg text-xs font-heading font-bold text-navy flex items-center gap-1.5 shadow-subtle"
          >
            <BookOpen className="w-4 h-4 text-blue" />
            <span className="hidden xs:inline">Contenu du cours</span>
          </button>
        </div>
      </header>

      {/* DEVICE LIMIT BLOCK MODAL */}
      {deviceBlocked && (
        <div className="fixed inset-0 z-50 bg-navy-deep/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-[18px] border border-red/20 bg-surface p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-tint text-red mx-auto flex items-center justify-center">
              <X className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-heading font-bold text-navy-deep">
              {t("deviceLimit.title")}
            </h2>
            <p className="text-xs text-muted-faro font-sans leading-relaxed">
              {t("deviceLimit.message")}
            </p>
            <button
              type="button"
              onClick={handleTerminateOtherSessions}
              disabled={terminatingOthers}
              className="w-full py-3 px-4 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold transition-all shadow-orange disabled:opacity-50"
            >
              {terminatingOthers
                ? t("deviceLimit.terminating")
                : t("deviceLimit.terminateOthers")}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MAIN LAYOUT: TWO COLUMNS (MAIN + 380px CURRICULUM)     */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Left / Center Column: Video Player & Tabs */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* ======================================================= */}
          {/* VIDEO CONTAINER: 16:9, Radius 20px, Dark Navy Gradient */}
          {/* ======================================================= */}
          <div
            ref={containerRef}
            onContextMenu={(e) => e.preventDefault()}
            onMouseMove={() => {
              setControlsVisible(true);
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(() => {
                if (isPlaying) setControlsVisible(false);
              }, 3000);
            }}
            className="relative aspect-video w-full rounded-none sm:rounded-[20px] overflow-hidden bg-gradient-to-br from-navy-deep via-navy to-navy-deep shadow-card flex items-center justify-center select-none group"
          >
            {/* DYNAMIC FLOATING WATERMARK (Always inside container, stays in fullscreen) */}
            <div
              style={{
                top: `${watermarkPos.top}%`,
                left: `${watermarkPos.left}%`,
                transition: "all 1.5s ease-in-out",
              }}
              className="absolute z-30 pointer-events-none select-none text-[10px] sm:text-xs font-mono font-bold tracking-wider text-white/35 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] px-2.5 py-1 rounded bg-black/10 backdrop-blur-[1px]"
            >
              {watermarkText}
            </div>

            {loadingVideo ? (
              <div className="relative w-full h-full flex items-center justify-center bg-navy-deep">
                {posterUrl && (
                  <Image
                    src={posterUrl}
                    alt={lessonTitle}
                    fill
                    className="object-cover opacity-40"
                    priority
                  />
                )}
                <div className="relative z-10 text-white text-xs flex flex-col items-center gap-3 font-heading">
                  <Loader2 className="w-8 h-8 text-orange animate-spin" />
                  <span>Chargement du lecteur vidéo...</span>
                </div>
              </div>
            ) : videoError ? (
              <div className="text-center p-6 text-white text-xs space-y-3 z-20">
                <p className="text-red-300 font-semibold">{videoError}</p>
                <button
                  type="button"
                  onClick={fetchPlaybackUrl}
                  className="px-4 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs shadow-orange"
                >
                  Réessayer
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  src={playbackUrl || undefined}
                  poster={posterUrl || undefined}
                  controlsList="nodownload"
                  disablePictureInPicture
                  playsInline
                  onClick={handlePlayToggle}
                  className="w-full h-full object-contain cursor-pointer"
                />

                {/* Centered Translucent Round Play Button (before starting or when paused) */}
                {!isPlaying && (
                  <button
                    type="button"
                    onClick={handlePlayToggle}
                    className="absolute z-20 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-surface/20 hover:bg-surface/30 backdrop-blur-md text-white flex items-center justify-center transition-all transform hover:scale-105 shadow-xl border border-white/20"
                    aria-label="Lire la vidéo"
                  >
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1 fill-white" />
                  </button>
                )}

                {/* Custom Control Bar at the Bottom */}
                <div
                  className={`absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-navy-deep/95 via-navy-deep/70 to-transparent p-3 sm:p-4 space-y-2 transition-opacity duration-300 ${
                    controlsVisible || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  {/* Thin Amber Progress Line */}
                  <div
                    ref={progressBarRef}
                    onClick={handleSeek}
                    className="w-full h-1.5 sm:h-2 rounded-full bg-white/25 cursor-pointer relative group/bar hover:h-2.5 transition-all"
                  >
                    <div
                      className="h-full rounded-full bg-orange relative transition-all"
                      style={{
                        width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                      }}
                    >
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between text-white text-xs pt-1">
                    {/* Left Controls: Play/Pause, Replay 5s, Time */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePlayToggle}
                        className="p-1.5 hover:text-orange transition-colors"
                        aria-label={isPlaying ? "Pause" : "Lecture"}
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                          }
                        }}
                        className="p-1 hover:text-orange transition-colors text-white/80"
                        title="Reculer de 5s"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.muted = !videoRef.current.muted;
                            setIsMuted(videoRef.current.muted);
                          }
                        }}
                        className="p-1 hover:text-orange transition-colors text-white/80"
                        title={isMuted ? "Activer le son" : "Couper le son"}
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-orange" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>

                      <span className="font-mono text-[11px] text-white/80 select-none">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    {/* Right Controls: Speed, Language Pill, Fullscreen */}
                    <div className="flex items-center gap-2.5">
                      {/* Speed Selector */}
                      <div className="flex items-center gap-1 bg-white/10 rounded-lg p-0.5 text-[10px] font-heading font-semibold">
                        {[0.75, 1, 1.25, 1.5].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => handleSpeedChange(rate)}
                            className={`px-1.5 py-0.5 rounded ${
                              playbackRate === rate
                                ? "bg-orange text-white"
                                : "text-white/70 hover:text-white"
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>

                      {/* Language pill */}
                      <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded bg-white/10 text-white/80 uppercase">
                        {locale === "ht" ? "KR" : "FR"}
                      </span>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={handleFullscreenToggle}
                        className="p-1 hover:text-orange transition-colors text-white/90"
                        title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="w-4 h-4" />
                        ) : (
                          <Maximize2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Next Lesson Countdown Overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 z-40 bg-navy-deep/85 flex items-center justify-center p-4">
                <div className="rounded-[18px] border border-line bg-surface p-6 max-w-sm w-full text-center space-y-4 shadow-xl">
                  <p className="text-sm font-heading font-bold text-navy-deep">
                    {t("countdown.title", { seconds: countdown })}
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCountdown(null);
                        if (nextLesson) {
                          router.push(`/dashboard/learn/${courseSlug}/${nextLesson.id}`);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold shadow-orange transition-all"
                    >
                      {t("countdown.nextNow")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCountdown(null)}
                      className="px-4 py-2.5 rounded-xl border border-line bg-surface hover:bg-bg text-navy text-xs font-heading font-semibold"
                    >
                      {t("countdown.cancel")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COURSE COMPLETION BANNER (when user finishes last lesson) */}
          {courseCompletedCertCode && (
            <div className="p-5 rounded-[18px] bg-ok-tint border border-ok/20 text-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-ok text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-bold text-navy-deep">
                    {t("courseCompleted.title")}
                  </h3>
                  <p className="text-xs text-muted-faro font-sans mt-0.5">
                    {t("courseCompleted.subtitle")}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/certificats"
                className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-bold transition-all shadow-orange shrink-0"
              >
                {t("courseCompleted.viewCertificate")} →
              </Link>
            </div>
          )}

          {/* ======================================================= */}
          {/* UNDER THE VIDEO: 30px Title, Muted Module, Action Buttons */}
          {/* ======================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl lg:text-[30px] font-heading font-bold text-navy-deep leading-tight">
                {lessonTitle}
              </h2>
              <p className="text-xs sm:text-sm text-muted-faro font-sans">
                {modules[currentModuleIndex]?.title || "Module"} · Leçon {currentIndex + 1} sur {allLessons.length}
              </p>
            </div>

            {/* Buttons: Ghost "Précédent" + Blue "Terminer & suivant" + Mark Complete */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Mark Complete Check Toggle */}
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-heading font-semibold transition-all border flex items-center gap-1.5 ${
                  isCurrentCompleted
                    ? "bg-ok-tint border-ok/30 text-ok"
                    : "border-line bg-surface text-ink hover:bg-bg"
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${isCurrentCompleted ? "stroke-[2.5]" : "opacity-40"}`} />
                <span>{isCurrentCompleted ? t("completed") : t("markCompleted")}</span>
              </button>

              {/* Prev Lesson Button (Ghost) */}
              {prevLesson && (
                <Link
                  href={`/dashboard/learn/${courseSlug}/${prevLesson.id}`}
                  className="px-4 py-2.5 rounded-xl border border-line bg-surface hover:bg-bg text-navy font-heading font-semibold text-xs sm:text-sm transition-colors"
                >
                  ← {t("previous")}
                </Link>
              )}

              {/* Next Lesson Button (Blue: "Terminer & suivant") */}
              {nextLesson ? (
                <Link
                  href={`/dashboard/learn/${courseSlug}/${nextLesson.id}`}
                  className="px-5 py-2.5 rounded-xl bg-blue hover:bg-blue/90 text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-subtle flex items-center gap-2"
                >
                  <span>{isCurrentCompleted ? t("next") : "Terminer & suivant"}</span>
                  <span>→</span>
                </Link>
              ) : (
                <Link
                  href="/dashboard/certificats"
                  className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-bold text-xs sm:text-sm transition-all shadow-orange flex items-center gap-2"
                >
                  <span>Voir mon certificat</span>
                  <span>→</span>
                </Link>
              )}
            </div>
          </div>

          {/* ======================================================= */}
          {/* TABS WITH BLUE UNDERLINE: Description, Ressources, Notes */}
          {/* ======================================================= */}
          <div className="space-y-5">
            <div className="flex border-b border-line gap-6 text-sm font-heading">
              <button
                type="button"
                onClick={() => setActiveTab("description")}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "description"
                    ? "border-blue text-blue font-bold"
                    : "border-transparent text-muted-faro hover:text-navy font-semibold"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t("tabs.description")}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("resources")}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "resources"
                    ? "border-blue text-blue font-bold"
                    : "border-transparent text-muted-faro hover:text-navy font-semibold"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{t("tabs.resources", { count: resources.length })}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("questions")}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "questions"
                    ? "border-blue text-blue font-bold"
                    : "border-transparent text-muted-faro hover:text-navy font-semibold"
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Questions</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("notes")}
                className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === "notes"
                    ? "border-blue text-blue font-bold"
                    : "border-transparent text-muted-faro hover:text-navy font-semibold"
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>{t("tabs.notes")}</span>
              </button>
            </div>

            {/* Tab 1: Description */}
            {activeTab === "description" && (
              <div className="text-sm text-ink leading-relaxed font-sans bg-surface rounded-[18px] border border-line p-6 shadow-subtle">
                {lessonDescription ? (
                  <p className="whitespace-pre-line">{lessonDescription}</p>
                ) : (
                  <p className="italic text-muted-faro">{t("noDescription")}</p>
                )}
              </div>
            )}

            {/* Tab 2: Resources as small white cards */}
            {activeTab === "resources" && (
              <div className="space-y-3">
                {resources.length === 0 ? (
                  <div className="bg-surface rounded-[18px] border border-line p-6 text-center text-xs text-muted-faro italic font-sans">
                    {t("noResources")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {resources.map((res) => (
                      <div
                        key={res.id}
                        className="rounded-[14px] border border-line bg-surface p-4 shadow-subtle flex items-center justify-between gap-3 hover:border-blue/30 transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-tint text-blue flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="font-heading font-semibold text-xs sm:text-sm text-navy-deep truncate">
                            {res.name}
                          </span>
                        </div>
                        <a
                          href={`/api/video/resources/${res.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-blue-tint hover:bg-blue hover:text-white text-blue font-heading font-semibold text-xs transition-colors shrink-0 flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Télécharger</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Questions & Support */}
            {activeTab === "questions" && (
              <div className="bg-surface rounded-[18px] border border-line p-6 shadow-subtle space-y-3 text-sm font-sans">
                <h3 className="font-heading font-bold text-navy-deep">
                  Une question sur cette leçon ?
                </h3>
                <p className="text-muted-faro text-xs leading-relaxed">
                  Notre équipe pédagogique et l&apos;instructeur Jean-Marc Joseph répondent directement à vos questions pratiques pour vous aider à progresser.
                </p>
                <div className="pt-2">
                  <a
                    href={`https://wa.me/50936000000?text=${encodeURIComponent(
                      `Bonjour Faro School, j'ai une question sur la leçon "${lessonTitle}" (${courseTitle}).`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-ok hover:bg-ok/90 text-white font-heading font-bold text-xs transition-colors shadow-sm"
                  >
                    <span>Poser ma question sur WhatsApp</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            )}

            {/* Tab 4: Private Notes */}
            {activeTab === "notes" && (
              <div className="space-y-2.5 bg-surface rounded-[18px] border border-line p-6 shadow-subtle">
                <textarea
                  value={notesContent}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  rows={6}
                  className="w-full p-4 rounded-xl border-[1.5px] border-line bg-surface text-ink text-sm focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20 transition-all resize-y font-sans leading-relaxed"
                />
                <div className="flex justify-end text-xs font-sans text-muted-faro">
                  {notesSaving ? (
                    <span className="flex items-center gap-1 text-orange">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("notesSaving")}</span>
                    </span>
                  ) : notesSaved ? (
                    <span className="text-ok font-semibold">✓ {t("notesSaved")}</span>
                  ) : (
                    <span>Notes privées enregistrées automatiquement.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. RIGHT 380px CURRICULUM SIDEBAR (Drawer on Mobile)      */}
        {/* ========================================================= */}
        <aside
          className={`lg:w-[380px] border-l border-line bg-surface flex flex-col shrink-0 ${
            curriculumDrawerOpen
              ? "fixed inset-0 z-50 bg-surface lg:static"
              : "hidden lg:flex"
          }`}
        >
          {/* Header */}
          <div className="h-16 border-b border-line px-5 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-heading font-bold text-navy-deep">
                Contenu de la formation
              </h3>
              <p className="text-[11px] text-muted-faro font-sans">
                {totalCompletedCount} sur {allLessons.length} leçons terminées
              </p>
            </div>
            {curriculumDrawerOpen && (
              <button
                type="button"
                onClick={() => setCurriculumDrawerOpen(false)}
                className="lg:hidden p-2 rounded-xl text-muted-faro hover:text-navy hover:bg-bg transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Curriculum Modules with Generous Spacing */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {modules.map((mod, modIdx) => {
              const isCurrentModule = modIdx === currentModuleIndex;
              const moduleLessonsCompleted = mod.lessons.every((l) => completedIds.includes(l.id));

              return (
                <div
                  key={mod.id}
                  className={`rounded-[16px] border transition-all p-4 space-y-2.5 ${
                    isCurrentModule
                      ? "border-blue/30 bg-blue-tint/30 shadow-subtle"
                      : "border-line bg-surface hover:border-line/80"
                  }`}
                >
                  {/* Module Header */}
                  <div className="flex items-center justify-between gap-2 pb-1">
                    <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-muted-faro">
                      Module {modIdx + 1}
                    </span>
                    {moduleLessonsCompleted && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-heading font-bold text-ok bg-ok-tint px-2 py-0.5 rounded-full border border-ok/20">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Complété</span>
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs sm:text-sm font-heading font-bold text-navy-deep">
                    {mod.title}
                  </h4>

                  {/* Lessons List in Module */}
                  <div className="space-y-1.5 pt-1">
                    {mod.lessons.map((l) => {
                      const isCurrent = l.id === lessonId;
                      const isCompleted = completedIds.includes(l.id);

                      return (
                        <Link
                          key={l.id}
                          href={`/dashboard/learn/${courseSlug}/${l.id}`}
                          onClick={() => setCurriculumDrawerOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-sans transition-all ${
                            isCurrent
                              ? "bg-blue text-white font-heading font-semibold shadow-subtle"
                              : "hover:bg-bg text-ink"
                          }`}
                        >
                          {/* Play or Check Icon */}
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] ${
                              isCurrent
                                ? "bg-white text-blue"
                                : isCompleted
                                ? "bg-ok-tint text-ok border border-ok/30"
                                : "border border-line text-transparent"
                            }`}
                          >
                            {isCurrent ? (
                              <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                            ) : isCompleted ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : null}
                          </span>

                          <span className="truncate flex-1 font-medium">{l.title}</span>

                          {l.duration_sec > 0 && (
                            <span
                              className={`text-[11px] font-mono shrink-0 ${
                                isCurrent ? "text-white/80" : "text-muted-faro"
                              }`}
                            >
                              {Math.ceil(l.duration_sec / 60)}m
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
