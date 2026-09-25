"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Notification Container */}
      <div
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => {
          const typeStyles: Record<
            ToastType,
            { bg: string; border: string; text: string; icon: React.ReactNode }
          > = {
            success: {
              bg: "bg-white",
              border: "border-emerald-200 shadow-lg shadow-emerald-500/5",
              text: "text-slate-900",
              icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
            },
            error: {
              bg: "bg-white",
              border: "border-rose-200 shadow-lg shadow-rose-500/5",
              text: "text-slate-900",
              icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
            },
            warning: {
              bg: "bg-white",
              border: "border-amber-200 shadow-lg shadow-amber-500/5",
              text: "text-slate-900",
              icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
            },
            info: {
              bg: "bg-white",
              border: "border-blue-200 shadow-lg shadow-blue-500/5",
              text: "text-slate-900",
              icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
            },
          };

          const s = typeStyles[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${s.border} ${s.bg} animate-slideIn transition-all`}
              role="alert"
            >
              <div className="pt-0.5">{s.icon}</div>
              <div className={`flex-1 text-sm font-medium ${s.text} leading-snug`}>
                {toast.message}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
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
