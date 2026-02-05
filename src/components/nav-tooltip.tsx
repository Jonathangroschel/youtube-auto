"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function NavTooltip({
  label,
  anchor,
  visible,
  onDismiss,
}: {
  label: string;
  anchor: HTMLElement | null;
  visible: boolean;
  onDismiss?: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate position before paint to prevent flash at (0,0)
  useLayoutEffect(() => {
    if (!visible || !anchor) {
      setPos(null);
      return;
    }
    const r = anchor.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 12 });
  }, [visible, anchor]);

  // Dismiss on any scroll
  useEffect(() => {
    if (!visible) return;

    const handleScroll = () => onDismissRef.current?.();

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [visible]);

  if (!mounted || !visible || !pos) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] -translate-y-1/2 whitespace-nowrap rounded-md border border-[rgba(255,255,255,0.06)] bg-[#252729] px-2.5 py-1.5 text-xs font-medium text-[#f7f7f8] shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
      style={{ top: pos.top, left: pos.left }}
    >
      {label}
    </div>,
    document.body,
  );
}
