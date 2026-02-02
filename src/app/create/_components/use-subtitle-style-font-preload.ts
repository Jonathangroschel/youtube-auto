"use client";

import { useEffect } from "react";

const systemFontFamilies = new Set([
  "Georgia",
  "Times New Roman",
  "Courier New",
  "TheBoldFont",
]);

const createFontLinkId = (family: string) =>
  `create-font-${family.toLowerCase().replace(/\s+/g, "-")}`;

export const useSubtitleStyleFontPreload = (fontFamilies: Array<string | null | undefined>) => {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const families = Array.from(
      new Set(
        fontFamilies
          .map((family) => (typeof family === "string" ? family.trim() : ""))
          .filter(Boolean)
      )
    );
    families.forEach((family) => {
      if (systemFontFamilies.has(family)) {
        return;
      }
      const linkId = createFontLinkId(family);
      if (document.getElementById(linkId)) {
        return;
      }
      const encoded = encodeURIComponent(family).replace(/%20/g, "+");
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
    });
  }, [fontFamilies]);
};
