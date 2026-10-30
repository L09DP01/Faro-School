"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

interface PwaContextType {
  isStandalone: boolean;
  isInstallable: boolean;
  isIos: boolean;
  hasUpdate: boolean;
  showIosModal: boolean;
  setShowIosModal: (show: boolean) => void;
  triggerInstallPrompt: () => Promise<boolean>;
  applyUpdate: () => void;
  dismissInstallBanner: () => void;
  isBannerDismissed: boolean;
  visitCount: number;
}

const PwaContext = createContext<PwaContextType | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showIosModal, setShowIosModal] = useState(false);
  const [visitCount, setVisitCount] = useState(1);
  const [isBannerDismissed, setIsBannerDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect standalone mode
    const checkStandalone = () => {
      const matchMediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const navigatorStandalone = (window.navigator as any).standalone === true;


      return matchMediaStandalone || navigatorStandalone;
    };

    const standalone = checkStandalone();
    setIsStandalone(standalone);

    // If standalone or source=pwa, ensure long-lived cookie is set
    if (standalone) {
      document.cookie =
        "faro_display=standalone; path=/; max-age=31536000; SameSite=Lax" +
        (window.location.protocol === "https:" ? "; Secure" : "");
    }

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      (/iphone|ipad|ipod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsIos(isIosDevice);

    // 3. Track visit count and dismiss status
    const currentVisits = parseInt(localStorage.getItem("faro_visit_count") || "0", 10) + 1;
    localStorage.setItem("faro_visit_count", String(currentVisits));
    setVisitCount(currentVisits);

    const dismissedUntil = parseInt(localStorage.getItem("faro_install_dismissed_until") || "0", 10);
    const dismissed = Date.now() < dismissedUntil;
    setIsBannerDismissed(dismissed);

    // 4. Listen for beforeinstallprompt (Android / Desktop Chrome)
    const handleInstalled = () => { setDeferredPrompt(null); };
    window.addEventListener("appinstalled", handleInstalled);
    const handleBeforeInstallPrompt = (e: Event) => {
      // Leave desktop installation entirely to the browser.
      if (!/android/i.test(navigator.userAgent)) return;
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Register Service Worker with version update listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // If a worker is already waiting, trigger update toast
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setHasUpdate(true);
          }

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setHasUpdate(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const triggerInstallPrompt = useCallback(async (): Promise<boolean> => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        if (outcome === "accepted") {
          setIsStandalone(true);
          document.cookie =
            "faro_display=standalone; path=/; max-age=31536000; SameSite=Lax";
          return true;
        }
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
      }
      return false;
    }

    if (isIos && !isStandalone) {
      setShowIosModal(true);
      return true;
    }

    return false;
  }, [deferredPrompt, isIos, isStandalone]);

  const dismissInstallBanner = useCallback(() => {
    // Hide for 14 days
    const expiry = Date.now() + 14 * 24 * 60 * 60 * 1000;
    localStorage.setItem("faro_install_dismissed_until", String(expiry));
    setIsBannerDismissed(true);
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, [waitingWorker]);

  return (
    <PwaContext.Provider
      value={{
        isStandalone,
        isInstallable: Boolean(deferredPrompt) || (isIos && !isStandalone),
        isIos,
        hasUpdate,
        showIosModal,
        setShowIosModal,
        triggerInstallPrompt,
        applyUpdate,
        dismissInstallBanner,
        isBannerDismissed,
        visitCount,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
}
