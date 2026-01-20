"use client";

import { useEffect, useMemo, useState } from "react";

type SearchItem = {
  title: string;
  description?: string;
  href?: string;
  icon: React.ReactNode;
  active?: boolean;
};

type SearchSection = {
  title: string;
  items: SearchItem[];
};

type SearchOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const arrowIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5 text-gray-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const sections: SearchSection[] = [
  {
    title: "Recent",
    items: [
      {
        title: "Projects",
        href: "/projects",
        active: true,
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-700"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        ),
      },
      {
        title: "Auto Clip",
        description:
          "Automatically find & edit the most viral moments in your videos",
        href: "/tools/autoclip",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 512 512"
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
          >
            <path d="M86.33 22.67C74.66 60.11 54.85 77.51 17.9 81.44c34.9 5.95 54.06 16.65 64.93 57.46 5.1-17.7-2.54-44.83 40.27-51.12C91.33 72.61 87.63 58.2 86.33 22.67zM399.8 37.35c-2.3 9.45-5 18.36-8.1 26.76 53 62.49 59 152.29 39.7 227.19-10.3 39.9-27.8 75.8-50.2 101.7-13.4 15.6-28.9 27.8-45.6 34.5 1.6 8.3 3.1 16.5 4.4 24.7 115.6-67.1 174.5-271 59.8-414.85zm-232.6 8.56l-4.1 62.59c33.9 10.4 70.3 26.4 95.4 45.2l23.1-71.26c-36.5-24.85-72.9-48.39-114.4-36.53zm216.6 37.03C358.6 135 316.2 164 265.4 177.7l-4.8 1.3-3.6-3.4c-23.6-21.8-75.9-44.1-117-54.8-9.6 33.1-19.2 77.6-17 108.8 77.7-2.1 129.8 29.1 162.7 74 22.9 31.1 36.9 68.5 45.9 106 12.6-5.6 24.7-15.2 36-28.3 20-23.2 36.7-56.9 46.4-94.5 17.4-67.7 12.4-147.4-30.2-203.86zM143.7 247.7L87.69 494.3h25.51l38.2-42.3-3.4-15-27.9 13.7-8-16.2 60.5-29.8 8 16.2-16 7.9c2.6 9.8 4.6 20.4 6.9 30-11.5 12.3-24.5 24.9-34.1 35.5h45.4l44.6-221.7c-22.2-14.1-49.5-23.1-83.7-24.9zm17.8 19.4l48.9 32.8-10 15-17.5-11.7-10.3 15.8 20.5 55.5-16.8 6.2-15.9-43-14.8 22.8-15-9.8 37.4-57.5-16.5-11.1zm-120.2.5c4.26 36.2 12.96 45.7-21.03 56.1 39.29 1.5 41.04 6.6 54.5 41.4-3.46-35.3-7.53-41.5 29.03-62.7-18.43-.2-36.47 11.8-62.5-34.8zm378.3 123.1c14.1 36.7 9.3 62.6-17.4 88.6 31.1-17 52.8-20.4 86.6 4.9-7-17-29.8-33.6 0-65-34.4 7.8-46.3-1.3-69.2-28.5z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Navigation",
    items: [
      {
        title: "Home",
        href: "/dashboard",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        ),
      },
      {
        title: "Projects",
        href: "/projects",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
          </svg>
        ),
      },
      {
        title: "Exports",
        href: "/exports",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
            <path d="m6.2 5.3 3.1 3.9" />
            <path d="m12.4 3.4 3.1 4" />
            <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          </svg>
        ),
      },
      {
        title: "Assets",
        href: "/assets",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 2a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 21 8v7a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
            <path d="M15 2v4a2 2 0 0 0 2 2h4" />
            <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />
          </svg>
        ),
      },
      {
        title: "Tools",
        href: "/tools",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
            <path d="m14 7 3 3" />
            <path d="M5 6v4" />
            <path d="M19 14v4" />
            <path d="M10 2v2" />
            <path d="M7 8H3" />
            <path d="M21 16h-4" />
            <path d="M11 3H9" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Tools",
    items: [
      {
        title: "Youtube Downloader",
        description: "Download Youtube videos",
        href: "/tools/youtube-downloader",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
          >
            <path d="M12.244 4c.534.003 1.87.016 3.29.073l.504.022c1.429.067 2.858.183 3.566.381.945.266 1.687 1.041 1.938 2.022.4 1.559.45 4.602.456 5.339l.001.152v.01l-.001.153c-.006.736-.056 3.779-.456 5.338-.254.986-.997 1.761-1.938 2.023-.708.197-2.137.313-3.566.381l-.504.022c-1.42.057-2.756.07-3.29.073l-.234.001h-.01l-.235-.001c-1.13-.006-5.856-.057-7.359-.475-.945-.266-1.688-1.041-1.939-2.023-.4-1.559-.45-4.602-.456-5.338v-.327c.006-.736.056-3.779.456-5.338.254-.986.997-1.761 1.939-2.023C5.898 4.006 10.624 3.955 11.755 3.949h.489ZM10 8.499v7l6-3.5-6-3.5Z" />
          </svg>
        ),
      },
      {
        title: "TikTok Downloader",
        description: "Download TikTok videos",
        href: "/tools/tiktok-downloader",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
          >
            <path d="M16 8.245V15.5C16 19.09 13.09 22 9.5 22S3 19.09 3 15.5 5.91 9 9.5 9c.516 0 1.018.06 1.5.174v3.163A3.5 3.5 0 0 0 9.5 12 3.5 3.5 0 0 0 6 15.5 3.5 3.5 0 0 0 9.5 19 3.5 3.5 0 0 0 13 15.5V2h3a5 5 0 0 0 5 5v3c-1.892 0-3.63-.657-5-1.755Z" />
          </svg>
        ),
      },
      {
        title: "Trust Score",
        description: "Analyze your YouTube channel trust",
        href: "/tools/trust-score",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l7 4v6c0 5-3.5 7.5-7 8-3.5-.5-7-3-7-8V7l7-4z" />
            <path d="M9.5 12.5 11 14l3.5-3.5" />
          </svg>
        ),
      },
      {
        title: "AI Image Generator",
        description: "Generate high quality images with AI",
        href: "/tools/images",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        ),
      },
      {
        title: "AI Voiceover Generator",
        description: "Make high quality voiceovers with 50+ narrators",
        href: "/tools/voiceovers",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19v3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <rect x="9" y="2" width="6" height="13" rx="3" />
          </svg>
        ),
      },
      {
        title: "AI Speech Enhancer",
        description: "Enhance the quality of any audio or video file",
        href: "/tools/enhance-speech",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />
          </svg>
        ),
      },
      {
        title: "AI Video Generator",
        description: "Create videos with AI",
        href: "/tools/veo3",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
            <rect x="2" y="6" width="14" height="12" rx="2" />
          </svg>
        ),
      },
      {
        title: "AI Vocal Remover",
        description: "Remove vocals from any audio or video file",
        href: "/tools/vocal-remover",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        ),
      },
      {
        title: "AI Brainstormer",
        description: "Generate viral content ideas based on your niche",
        href: "/tools/brainstorm",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 18V5" />
            <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4" />
            <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5" />
            <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77" />
            <path d="M18 18a4 4 0 0 0 2-7.464" />
            <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517" />
            <path d="M6 18a4 4 0 0 1-2-7.464" />
            <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77" />
          </svg>
        ),
      },
      {
        title: "Background Remover",
        description: "Remove background from images and videos",
        href: "/tools/remove-bg",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
            <line x1="16" x2="22" y1="5" y2="5" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        ),
      },
      {
        title: "Background Audio Remover",
        description: "Remove background audio from videos",
        href: "/tools/audio-remover",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" />
            <path d="M16 9a5 5 0 0 1 0 6" />
            <path d="M19.364 18.364a9 9 0 0 0 0-12.728" />
          </svg>
        ),
      },
      {
        title: "Free MP3 Converter",
        description: "Convert audio and video files to MP3",
        href: "/tools/mp3",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 11a5 5 0 0 1 0 6" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M4 6.765V4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-.93-.23" />
            <path d="M7 10.51a.5.5 0 0 0-.826-.38l-1.893 1.628A1 1 0 0 1 3.63 12H2.5a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h1.129a1 1 0 0 1 .652.242l1.893 1.63a.5.5 0 0 0 .826-.38z" />
          </svg>
        ),
      },
      {
        title: "Free Video Compressor",
        description: "Compress videos to reduce file size",
        href: "/tools/video-compressor",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12v-1" />
            <path d="M10 18v-2" />
            <path d="M10 7V6" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M15.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v16a2 2 0 0 0 .274 1.01" />
            <circle cx="10" cy="20" r="2" />
          </svg>
        ),
      },
      {
        title: "Free Audio Balancer",
        description: "Balance and optimize audio levels",
        href: "/tools/audio-balancer",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 10v3" />
            <path d="M6 6v11" />
            <path d="M10 3v18" />
            <path d="M14 8v7" />
            <path d="M18 5v13" />
            <path d="M22 10v3" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Create Videos",
    items: [
      {
        title: "Reddit Story Video",
        description: "Convert Reddit posts into viral videos",
        href: "/create/reddit-video",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        title: "Fake Texts Video",
        description: "Create engaging fake texts videos",
        href: "/create/text-video",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />
          </svg>
        ),
      },
      {
        title: "Auto Clip",
        description: "Automatically find & edit the most viral moments",
        href: "/tools/autoclip",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 512 512"
            className="h-4 w-4 text-gray-500"
            fill="currentColor"
          >
            <path d="M86.33 22.67C74.66 60.11 54.85 77.51 17.9 81.44c34.9 5.95 54.06 16.65 64.93 57.46 5.1-17.7-2.54-44.83 40.27-51.12C91.33 72.61 87.63 58.2 86.33 22.67zM399.8 37.35c-2.3 9.45-5 18.36-8.1 26.76 53 62.49 59 152.29 39.7 227.19-10.3 39.9-27.8 75.8-50.2 101.7-13.4 15.6-28.9 27.8-45.6 34.5 1.6 8.3 3.1 16.5 4.4 24.7 115.6-67.1 174.5-271 59.8-414.85z" />
          </svg>
        ),
      },
      {
        title: "Split Screen Video",
        description: "Create split screen videos",
        href: "/create/split-video",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 12h18" />
          </svg>
        ),
      },
      {
        title: "Vertical Split Video",
        description: "Create vertical split screen videos",
        href: "/create/vertical-split",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M12 3v18" />
          </svg>
        ),
      },
      {
        title: "Streamer Video",
        description: "Create streamer style videos",
        href: "/create/streamer-video",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" x2="10" y1="11" y2="11" />
            <line x1="8" x2="8" y1="9" y2="13" />
            <line x1="15" x2="15.01" y1="12" y2="12" />
            <line x1="18" x2="18.01" y1="10" y2="10" />
            <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
          </svg>
        ),
      },
      {
        title: "Subtitles Video",
        description: "Add subtitles to your videos",
        href: "/create/subtitles",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="14" x="3" y="5" rx="2" ry="2" />
            <path d="M7 15h4" />
            <path d="M15 15h2" />
            <path d="M7 11h2" />
            <path d="M13 11h4" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ),
      },
      {
        title: "Support",
        description: "Get help from our team on Discord",
        href: "/support",
        icon: (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
          </svg>
        ),
      },
    ],
  },
];

export default function SearchOverlay({
  open,
  onOpenChange,
}: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const handleClose = () => onOpenChange(false);

  const filteredSections = useMemo(() => {
    if (!query.trim()) {
      return sections;
    }

    const lowered = query.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          `${item.title} ${item.description ?? ""}`
            .toLowerCase()
            .includes(lowered)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  return (
    <div
      data-state={open ? "open" : "closed"}
      className={`fixed inset-0 z-50 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />
      <div
        className={`absolute left-1/2 top-24 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-gray-200 bg-white shadow-xl transition-all ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b border-gray-100 px-5 py-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mr-3 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m21 21-4.34-4.34" />
            <circle cx="11" cy="11" r="8" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 bg-transparent text-[15px] font-normal text-gray-900 outline-none placeholder:text-gray-400"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-1">
          {filteredSections.map((section, index) => (
            <div key={section.title} className="mb-2 last:mb-0">
              <div className="px-5 pb-1 pt-3">
                <p className="text-xs font-medium text-gray-400">
                  {section.title}
                </p>
              </div>
              <div className="space-y-1 px-2">
                {section.items.map((item) => {
                  const Wrapper: "a" | "button" = item.href ? "a" : "button";
                  return (
                    <Wrapper
                      key={item.title}
                      href={item.href}
                      className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-all ${
                        item.active
                          ? "bg-gray-100"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={handleClose}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                            item.active
                              ? "bg-gray-200"
                              : "bg-gray-50 group-hover:bg-gray-100"
                          }`}
                        >
                          {item.icon}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item.title}
                          </div>
                          {item.description ? (
                            <div className="mt-0.5 text-xs text-gray-500">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`transition-all ${
                          item.active
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {arrowIcon}
                      </span>
                    </Wrapper>
                  );
                })}
              </div>
              {index !== filteredSections.length - 1 ? (
                <div className="mx-5 my-2 border-t border-gray-100" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
