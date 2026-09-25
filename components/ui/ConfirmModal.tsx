"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  variant?: "danger" | "warning" | "primary" | "info";
  isLoading?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose?: () => void;
  onCancel?: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  isDanger,
  variant,
  isLoading = false,
  loading = false,
  onConfirm,
  onClose,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const isBusy = Boolean(loading || isLoading);

  const handleClose = () => {
    if (onClose) onClose();
    if (onCancel) onCancel();
  };

  const effectiveConfirm = confirmLabel || confirmText || "Confirm";
  const effectiveCancel = cancelLabel || cancelText || "Cancel";
  const isDestructive = isDanger !== undefined ? isDanger : (variant === "danger" || variant === undefined);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Focus confirmation button when opened
    setTimeout(() => {
      confirmBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isBusy]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp p-6"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : "bg-blue-50 text-blue-600 border border-blue-100"
            }`}
          >
            {isDestructive ? (
              <Trash2 className="w-5 h-5 text-rose-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            )}
          </div>

          <div className="flex-1">
            <h3
              id="confirm-modal-title"
              className="text-lg font-bold text-slate-900 leading-tight"
            >
              {title}
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            disabled={isBusy}
            className="btn-secondary text-sm px-4 py-2"
          >
            {effectiveCancel}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`text-sm font-semibold px-4 py-2 rounded-lg text-white transition flex items-center gap-2 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-400 shadow-xs"
                : "bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-400 shadow-xs"
            }`}
          >
            {isBusy && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {effectiveConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
