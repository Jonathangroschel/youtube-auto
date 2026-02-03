/**
 * Satura Design System - Tailwind Configuration Extension
 * 
 * Usage:
 * 1. npm i geist
 * 2. Import this config into your tailwind.config.ts
 * 3. Add the CSS variables to your globals.css
 */

import type { Config } from "tailwindcss";

export const saturaColors = {
  brand: {
    primary: {
      DEFAULT: "#9aed00",
      50: "#f4ffe6",
      100: "#e6ffc9",
      200: "#ceff99",
      300: "#aef85c",
      400: "#9aed00",
      500: "#7ac700",
      600: "#5c9e00",
      700: "#467800",
      800: "#3a5f00",
      900: "#324f08",
      foreground: "#000000",
    },
    secondary: {
      DEFAULT: "#191240",
      50: "#eeeeff",
      100: "#e0e0ff",
      200: "#c7c5ff",
      300: "#a5a0ff",
      400: "#8270ff",
      500: "#6a47ff",
      600: "#5c24f7",
      700: "#4f18e3",
      800: "#4214bf",
      900: "#37139c",
      950: "#191240",
      foreground: "#ffffff",
    },
  },
  surface: {
    primary: "#0e1012",
    secondary: "#1a1c1e",
    tertiary: "#252729",
  },
  font: {
    primary: "#f7f7f8",
    secondary: "#898a8b",
    brand: "#9aed00",
    disabled: "#5e636e",
  },
  divider: {
    primary: "rgba(255, 255, 255, 0.08)",
    secondary: "rgba(255, 255, 255, 0.06)",
  },
  success: {
    DEFAULT: "#07bc0c",
    surface: "rgba(0, 195, 20, 0.2)",
    border: "#00c314",
  },
  error: {
    DEFAULT: "#e72930",
    surface: "rgba(231, 41, 48, 0.2)",
    border: "#db3f3e",
  },
  warning: {
    DEFAULT: "#f1c40f",
    surface: "rgba(255, 190, 76, 0.2)",
    border: "#ffbe4c",
  },
  info: {
    DEFAULT: "#4778f5",
    surface: "rgba(71, 120, 245, 0.2)",
    border: "#4778f5",
  },
};

export const saturaTypography = {
  fontFamily: {
    display: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
    body: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
  },
  fontSize: {
    "display-1": ["72px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
    "display-2": ["64px", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "600" }],
    h1: ["48px", { lineHeight: "1.17", letterSpacing: "-0.03em", fontWeight: "600" }],
    h2: ["40px", { lineHeight: "1.2", letterSpacing: "-0.03em", fontWeight: "600" }],
    h3: ["36px", { lineHeight: "1.11", letterSpacing: "-0.03em", fontWeight: "600" }],
    h4: ["28px", { lineHeight: "1.29", letterSpacing: "-0.03em", fontWeight: "600" }],
    h5: ["24px", { lineHeight: "1.25", letterSpacing: "-0.03em", fontWeight: "600" }],
    h6: ["20px", { lineHeight: "1.3", letterSpacing: "-0.02em", fontWeight: "600" }],
    "subtitle-1": ["18px", { lineHeight: "1.56", letterSpacing: "-0.01em", fontWeight: "600" }],
    "subtitle-2": ["16px", { lineHeight: "1.5", letterSpacing: "-0.01em", fontWeight: "600" }],
    "body-lg": ["18px", { lineHeight: "1.6", letterSpacing: "0", fontWeight: "400" }],
    body: ["16px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "400" }],
    "body-sm": ["14px", { lineHeight: "1.43", letterSpacing: "0", fontWeight: "400" }],
    caption: ["12px", { lineHeight: "1.5", letterSpacing: "0.3px", fontWeight: "400" }],
    "caption-sm": ["10px", { lineHeight: "1.4", letterSpacing: "0", fontWeight: "500" }],
    "button-lg": ["16px", { lineHeight: "1.5", letterSpacing: "-0.01em", fontWeight: "600" }],
    button: ["14px", { lineHeight: "1.43", letterSpacing: "0", fontWeight: "600" }],
    "button-sm": ["12px", { lineHeight: "1.5", letterSpacing: "0.4px", fontWeight: "600" }],
    label: ["12px", { lineHeight: "2", letterSpacing: "0.4px", fontWeight: "600" }],
    overline: ["10px", { lineHeight: "1.4", letterSpacing: "0.5px", fontWeight: "700" }],
  },
};

export const saturaSpacing = {
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  2.5: "10px",
  3: "12px",
  3.5: "14px",
  4: "16px",
  5: "20px",
  6: "24px",
  7: "28px",
  8: "32px",
  9: "36px",
  10: "40px",
  12: "48px",
  14: "56px",
  16: "64px",
  20: "80px",
  24: "96px",
  28: "112px",
  32: "128px",
};

export const saturaBorderRadius = {
  none: "0px",
  sm: "4px",
  DEFAULT: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  full: "9999px",
};

export const saturaBoxShadow = {
  none: "none",
  sm: "0px 1px 2px rgba(0, 0, 0, 0.05)",
  DEFAULT: "0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)",
  md: "0px 4px 6px rgba(0, 0, 0, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.06)",
  lg: "0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)",
  xl: "0px 20px 25px rgba(0, 0, 0, 0.1), 0px 10px 10px rgba(0, 0, 0, 0.04)",
  "2xl": "0px 25px 50px rgba(0, 0, 0, 0.25)",
  inner: "inset 0px 2px 4px rgba(0, 0, 0, 0.06)",
  glow: "0px 0px 20px 0px rgba(154, 237, 0, 0.3)",
  "glow-focus": "0px 0px 0px 4px rgba(154, 237, 0, 0.24)",
  "button-inset": "rgba(255, 255, 255, 0.12) -0.5px -0.5px 1px 0px inset, rgba(27, 27, 27, 0.17) 0.8px 0.5px 0.5px 0px inset",
};

export const saturaAnimation = {
  transitionDuration: {
    fast: "150ms",
    DEFAULT: "200ms",
    slow: "300ms",
    slower: "500ms",
  },
  transitionTimingFunction: {
    DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0, 0, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  },
};

export const saturaZIndex = {
  dropdown: "1000",
  sticky: "1020",
  fixed: "1030",
  "modal-backdrop": "1040",
  modal: "1050",
  popover: "1060",
  tooltip: "1070",
  toast: "1080",
};

// Full Tailwind config extension
export const saturaConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: saturaColors,
      fontFamily: saturaTypography.fontFamily,
      fontSize: saturaTypography.fontSize,
      spacing: saturaSpacing,
      borderRadius: saturaBorderRadius,
      boxShadow: saturaBoxShadow,
      transitionDuration: saturaAnimation.transitionDuration,
      transitionTimingFunction: saturaAnimation.transitionTimingFunction,
      zIndex: saturaZIndex,
    },
  },
};

export default saturaConfig;
