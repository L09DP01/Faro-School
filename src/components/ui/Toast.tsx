"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toast: (options: { type: ToastType; title?: string; message: string }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ type, title, message }: { type: ToastType; title?: string; message: string }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);

      // Auto-dismiss after 4.5 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => toast({ type: "success", title, message }),
    [toast]
  );
  const error = useCallback(
    (message: string, title?: string) => toast({ type: "error", title, message }),
    [toast]
  );
  const info = useCallback(
    (message: string, title?: string) => toast({ type: "info", title, message }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      {/* Toast Notification Container: Accessible Announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto rounded-[16px] border p-4 shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-0",
              item.type === "success" && "bg-ok-tint text-ok border-ok/30",
              item.type === "error" && "bg-red-tint text-red border-red/30",
              item.type === "info" && "bg-blue-tint text-blue border-blue/30"
            )}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {item.type === "success" && (
                <svg className="w-5 h-5 text-ok" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {item.type === "error" && (
                <svg className="w-5 h-5 text-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {item.type === "info" && (
                <svg className="w-5 h-5 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 space-y-0.5">
              {item.title && (
                <h4 className="font-heading font-bold text-xs leading-snug">
                  {item.title}
                </h4>
              )}
              <p className="font-sans text-xs leading-relaxed font-medium">
                {item.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => removeToast(item.id)}
              className="shrink-0 p-1 rounded-md hover:opacity-75 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current text-xs font-bold"
              aria-label="Fermer la notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
