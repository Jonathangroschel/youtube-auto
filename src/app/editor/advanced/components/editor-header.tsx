"use client";

import { useEffect, useRef, useState } from "react";

type EditorHeaderProps = {
  projectName: string;
  onProjectNameChange: (value: string) => void;
  projectSaveState: "idle" | "saving" | "saved" | "error";
  projectStarted: boolean;
  showSaveIndicator: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExport?: () => void;
  exportDisabled?: boolean;
  exportBusy?: boolean;
  exportLabel?: string;
};

export const EditorHeader = ({
  projectName,
  onProjectNameChange,
  projectSaveState,
  projectStarted,
  showSaveIndicator,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  exportDisabled,
  exportBusy,
  exportLabel,
}: EditorHeaderProps) => {
  const undoDisabled = !canUndo;
  const redoDisabled = !canRedo;
  const [draftProjectName, setDraftProjectName] = useState(projectName);
  const nameSaveTimeoutRef = useRef<number | null>(null);
  const resolvedExportLabel = exportLabel ?? (exportBusy ? "Exporting..." : "Export");
  const saveStatus = (() => {
    if (!projectStarted) {
      return null;
    }
    if (!showSaveIndicator) {
      return null;
    }
    if (projectSaveState === "saving") {
      return { label: "Saving...", className: "text-amber-600" };
    }
    if (projectSaveState === "error") {
      return { label: "Save failed", className: "text-rose-600" };
    }
    if (projectSaveState === "saved") {
      return { label: "Saved", className: "text-emerald-600" };
    }
    return null;
  })();

  useEffect(() => {
    setDraftProjectName(projectName);
  }, [projectName]);

  useEffect(() => {
    return () => {
      if (nameSaveTimeoutRef.current) {
        window.clearTimeout(nameSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <header className="min-h-16 border-b border-gray-200 bg-white px-5 py-2">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <a
            className="flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-2"
            href="/dashboard"
            aria-label="Home"
          >
            <img src="/icon.svg" alt="Home" className="h-9 w-9 ml-[-2px]" />
          </a>
          <div className="flex h-10 items-center gap-2 rounded-full bg-gray-100/80 px-3.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Project
            </span>
            <label htmlFor="project-name-input" className="sr-only">
              Project name
            </label>
            <input
              id="project-name-input"
              className="w-44 rounded-md bg-transparent px-1 text-[15px] font-semibold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-1"
              value={draftProjectName}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraftProjectName(nextValue);
                if (nameSaveTimeoutRef.current) {
                  window.clearTimeout(nameSaveTimeoutRef.current);
                }
                nameSaveTimeoutRef.current = window.setTimeout(() => {
                  onProjectNameChange(nextValue);
                }, 600);
              }}
              onBlur={(event) => {
                if (nameSaveTimeoutRef.current) {
                  window.clearTimeout(nameSaveTimeoutRef.current);
                  nameSaveTimeoutRef.current = null;
                }
                const nextValue = event.target.value;
                if (nextValue !== projectName) {
                  onProjectNameChange(nextValue);
                }
              }}
            />
            {saveStatus ? (
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${saveStatus.className}`}
                aria-live="polite"
              >
                {saveStatus.label}
              </span>
            ) : null}
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-2"
            type="button"
            aria-label="Project options"
          >
            <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
              <path
                d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                fill="currentColor"
              />
            </svg>
          </button>
          <div className="hidden h-6 w-px bg-gray-200 md:block" />
          <div className="flex items-center gap-1">
            <button
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition ${
                undoDisabled
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-500 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-2"
              }`}
              type="button"
              aria-label="Undo"
              disabled={undoDisabled}
              onClick={onUndo}
            >
              <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
                <path
                  d="M3 8h7a3 3 0 0 1 3 3M3 8l3 3M3 8l3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition ${
                redoDisabled
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-500 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-2"
              }`}
              type="button"
              aria-label="Redo"
              disabled={redoDisabled}
              onClick={onRedo}
            >
              <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
                <path
                  d="M13 8H6a3 3 0 0 0-3 3m10-3-3 3m3-3-3-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            className={`flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(51,92,255,0.22)] transition ${
              exportDisabled
                ? "cursor-not-allowed bg-[#9DB5FF] shadow-none"
                : "bg-[#335CFF] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/35 focus-visible:ring-offset-2"
            }`}
            type="button"
            disabled={exportDisabled}
            onClick={onExport}
          >
            {exportBusy ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
            ) : null}
            {resolvedExportLabel}
          </button>
        </div>
      </div>
    </header>
  );
};
