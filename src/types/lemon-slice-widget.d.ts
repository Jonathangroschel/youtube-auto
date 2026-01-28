import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "lemon-slice-widget": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        "agent-id"?: string;
        inline?: boolean;
        "custom-minimized-width"?: string;
        "custom-minimized-height"?: string;
        "custom-active-width"?: string;
        "custom-active-height"?: string;
        "video-button-color-opacity"?: string;
        "show-minimize-button"?: string;
        "initial-state"?: string;
      };
    }
  }
}

export {};
