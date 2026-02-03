"use client";

import SearchOverlay from "@/components/search-overlay";
import { SaturaLogo } from "@/components/satura-logo";
import {
  deleteAssetById,
  loadAssetLibrary,
  renameAssetById,
  uploadAssetFile,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
    label: "Projects",
    href: "/projects",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
    label: "Assets",
    href: "/assets",
    active: true,
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#9aed00] transition-colors"
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
    label: "Tools",
    href: "/tools",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
  {
    label: "AutoClip",
    href: "/tools/autoclip",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#898a8b] transition-colors"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
        <path d="M20 2v4" />
        <path d="M22 4h-4" />
        <circle cx="4" cy="20" r="2" />
      </svg>
    ),
  },
  {
    label: "Trust Score",
    href: "/tools/trust-score",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5 text-[#898a8b] transition-colors"
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
];

type MobileSection = {
  label: string;
  items: { label: string; href: string }[];
  icon?: ReactNode;
  defaultOpen?: boolean;
};

const mobileSections: MobileSection[] = [
  {
    label: "Dashboard",
    defaultOpen: true,
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 text-gray-600"
        fill="currentColor"
      >
        <path fill="none" d="M0 0h24v24H0V0z" />
        <path d="M19 5v2h-4V5h4M9 5v6H5V5h4m10 8v6h-4v-6h4M9 17v2H5v-2h4M21 3h-8v6h8V3zM11 3H3v10h8V3zm10 8h-8v10h8V11zm-10 4H3v6h8v-6z" />
      </svg>
    ),
    items: [
      { label: "Home", href: "/dashboard" },
      { label: "My Projects", href: "/projects" },
      { label: "My Assets", href: "/assets" },
    ],
  },
  {
    label: "Quick Edit",
    items: [
      { label: "Reddit Video", href: "/create/reddit-video" },
      { label: "Split Video", href: "/create/split-video" },
      { label: "Streamer Video", href: "/create/streamer-video" },
      { label: "Quick Subtitles", href: "/create/subtitles" },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Editor", href: "/tools" },
      { label: "AutoClip", href: "/tools/autoclip" },
    ],
  },
  {
    label: "Trust Score",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4 text-gray-600"
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
    items: [{ label: "Overview", href: "/tools/trust-score" }],
  },
  {
    label: "More",
    items: [
      { label: "24/7 Support", href: "/support" },
    ],
  },
];

type MobileFooterAction = {
  label: string;
  href: string;
  tone: "neutral" | "danger";
};

const mobileFooterActions: MobileFooterAction[] = [
  { label: "Upgrade", href: "/upgrade", tone: "neutral" },
  { label: "Settings", href: "/settings", tone: "neutral" },
  { label: "Log Out", href: "/logout", tone: "danger" },
];

const assetTabs = ["All", "Video", "Images", "Audio"];

const assetSortOptions = [
  { key: "updated-desc", label: "Last Updated" },
  { key: "updated-asc", label: "Oldest Updated" },
] as const;

type AssetSortKey = (typeof assetSortOptions)[number]["key"];

const sortLabelByKey = new Map<AssetSortKey, string>(
  assetSortOptions.map((option) => [option.key, option.label])
);

const normalizeAssetName = (value: string) => {
  const trimmed = value.slice(0, 120).trim();
  return trimmed.length > 0 ? trimmed : "Untitled asset";
};

export default function AssetsPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assets, setAssets] = useState<AssetLibraryItem[]>([]);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetNameDrafts, setAssetNameDrafts] = useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] = useState("All");
  const [assetSortKey, setAssetSortKey] = useState<AssetSortKey>("updated-desc");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        mobileSections.map((section) => [
          section.label,
          section.defaultOpen ?? false,
        ])
      )
  );
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hoveredNavIndex, setHoveredNavIndex] = useState<number | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    height: number;
    opacity: number;
  }>({
    top: 0,
    height: 0,
    opacity: 0,
  });
  const [indicatorReady, setIndicatorReady] = useState(false);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const assetNameDraftsRef = useRef<Record<string, string>>({});
  const savedAssetNamesRef = useRef<Record<string, string>>({});
  const renameTimeoutsRef = useRef<Map<string, number>>(new Map());
  const renameRequestIdRef = useRef<Map<string, number>>(new Map());
  const editingAssetIdRef = useRef<string | null>(null);
  const activeNavIndex = navItems.findIndex((item) => item.active);
  const resolvedNavIndex =
    hoveredNavIndex ?? (activeNavIndex >= 0 ? activeNavIndex : 0);

  const updateIndicator = useCallback((index: number) => {
    const container = navContainerRef.current;
    const item = navItemRefs.current[index];
    if (!container || !item) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setIndicatorStyle({
      top: itemRect.top - containerRect.top,
      height: itemRect.height,
      opacity: 1,
    });
  }, []);

  const clearRenameTimeout = useCallback((assetId: string) => {
    const timeoutId = renameTimeoutsRef.current.get(assetId);
    if (timeoutId != null) {
      window.clearTimeout(timeoutId);
      renameTimeoutsRef.current.delete(assetId);
    }
  }, []);

  const bumpRenameRequestId = useCallback((assetId: string) => {
    const next = (renameRequestIdRef.current.get(assetId) ?? 0) + 1;
    renameRequestIdRef.current.set(assetId, next);
    return next;
  }, []);

  const setAssetNameLocally = useCallback((assetId: string, name: string) => {
    setAssets((prev) =>
      prev.map((asset) => (asset.id === assetId ? { ...asset, name } : asset))
    );
  }, []);

  const saveAssetName = useCallback(
    async (assetId: string, rawName: string) => {
      const requestId = bumpRenameRequestId(assetId);
      const normalizedName = normalizeAssetName(rawName);
      try {
        const saved = await renameAssetById(assetId, normalizedName);
        if (
          !saved ||
          renameRequestIdRef.current.get(assetId) !== requestId
        ) {
          return;
        }
        const savedName = normalizeAssetName(saved.name);
        savedAssetNamesRef.current[assetId] = savedName;
        setAssetNameLocally(assetId, savedName);
        if (editingAssetIdRef.current !== assetId) {
          setAssetNameDrafts((prev) =>
            prev[assetId] === savedName ? prev : { ...prev, [assetId]: savedName }
          );
        }
      } catch (error) {
        if (renameRequestIdRef.current.get(assetId) !== requestId) {
          return;
        }
        console.error("[assets] rename failed", error);
      }
    },
    [bumpRenameRequestId, setAssetNameLocally]
  );

  const scheduleAssetNameSave = useCallback(
    (assetId: string, rawName: string) => {
      clearRenameTimeout(assetId);
      const timeoutId = window.setTimeout(() => {
        renameTimeoutsRef.current.delete(assetId);
        void saveAssetName(assetId, rawName);
      }, 500);
      renameTimeoutsRef.current.set(assetId, timeoutId);
    },
    [clearRenameTimeout, saveAssetName]
  );

  const handleAssetNameClick = useCallback((asset: AssetLibraryItem) => {
    setEditingAssetId(asset.id);
    setAssetNameDrafts((prev) =>
      prev[asset.id] === asset.name ? prev : { ...prev, [asset.id]: asset.name }
    );
  }, []);

  const handleAssetNameChange = useCallback(
    (assetId: string, name: string) => {
      setAssetNameDrafts((prev) =>
        prev[assetId] === name ? prev : { ...prev, [assetId]: name }
      );
      setAssetNameLocally(assetId, name);
      scheduleAssetNameSave(assetId, name);
    },
    [scheduleAssetNameSave, setAssetNameLocally]
  );

  const flushAssetNameSave = useCallback(
    (assetId: string) => {
      clearRenameTimeout(assetId);
      const draftName = assetNameDraftsRef.current[assetId];
      if (typeof draftName !== "string") {
        return;
      }
      const nextNormalized = normalizeAssetName(draftName);
      const savedNormalized = normalizeAssetName(
        savedAssetNamesRef.current[assetId] ?? ""
      );
      if (nextNormalized === savedNormalized) {
        setAssetNameLocally(assetId, savedNormalized);
        return;
      }
      void saveAssetName(assetId, draftName);
    },
    [clearRenameTimeout, saveAssetName, setAssetNameLocally]
  );

  const handleAssetNameBlur = useCallback(
    (assetId: string) => {
      setEditingAssetId((prev) => (prev === assetId ? null : prev));
      flushAssetNameSave(assetId);
    },
    [flushAssetNameSave]
  );

  const handleAssetNameKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>, asset: AssetLibraryItem) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      clearRenameTimeout(asset.id);
      bumpRenameRequestId(asset.id);
      const persistedName = savedAssetNamesRef.current[asset.id] ?? asset.name;
      setAssetNameDrafts((prev) => ({
        ...prev,
        [asset.id]: persistedName,
      }));
      setAssetNameLocally(asset.id, persistedName);
      setEditingAssetId((prev) => (prev === asset.id ? null : prev));
      event.currentTarget.blur();
    },
    [bumpRenameRequestId, clearRenameTimeout, setAssetNameLocally]
  );

  const refreshAssets = useCallback(async () => {
    try {
      const items = await loadAssetLibrary();
      const currentDrafts = assetNameDraftsRef.current;
      const mergedItems = items.map((asset) => {
        const draftName = currentDrafts[asset.id];
        return typeof draftName === "string"
          ? { ...asset, name: draftName }
          : asset;
      });
      setAssets(mergedItems);
      savedAssetNamesRef.current = Object.fromEntries(
        items.map((asset) => [asset.id, asset.name])
      );
      setAssetNameDrafts((prev) => {
        const activeAssetIds = new Set(items.map((asset) => asset.id));
        let changed = false;
        const next: Record<string, string> = {};
        Object.entries(prev).forEach(([assetId, draftName]) => {
          if (activeAssetIds.has(assetId)) {
            next[assetId] = draftName;
          } else {
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    } catch {
      setAssets([]);
    }
  }, []);

  const handleUploadAssets = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }
      await Promise.all(
        files.map(async (file) => {
          await uploadAssetFile(file, {
            name: file.name || "Uploaded asset",
            source: "upload",
          });
        })
      );
      refreshAssets();
      event.target.value = "";
    },
    [refreshAssets]
  );

  const handleDeleteAsset = useCallback(
    async (assetId: string) => {
      clearRenameTimeout(assetId);
      bumpRenameRequestId(assetId);
      setAssetNameDrafts((prev) => {
        if (!(assetId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
      delete savedAssetNamesRef.current[assetId];
      setEditingAssetId((prev) => (prev === assetId ? null : prev));
      setAssets((prev) => prev.filter((asset) => asset.id !== assetId));
      await deleteAssetById(assetId);
    },
    [bumpRenameRequestId, clearRenameTimeout]
  );

  const filteredAssets = useMemo(() => {
    if (activeTab === "All") {
      return assets;
    }
    if (activeTab === "Video") {
      return assets.filter((asset) => asset.kind === "video");
    }
    if (activeTab === "Images") {
      return assets.filter((asset) => asset.kind === "image");
    }
    return assets.filter((asset) => asset.kind === "audio");
  }, [activeTab, assets]);

  const sortedAssets = useMemo(() => {
    const next = [...filteredAssets];
    if (assetSortKey === "updated-asc") {
      next.sort((a, b) => a.createdAt - b.createdAt);
      return next;
    }
    next.sort((a, b) => b.createdAt - a.createdAt);
    return next;
  }, [assetSortKey, filteredAssets]);

  const assetSortLabel = sortLabelByKey.get(assetSortKey) ?? "Last Updated";

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && profileMenuRef.current?.contains(target)) {
        return;
      }
      setProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!sortMenuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && sortMenuRef.current?.contains(target)) {
        return;
      }
      setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sortMenuOpen]);

  useEffect(() => {
    assetNameDraftsRef.current = assetNameDrafts;
  }, [assetNameDrafts]);

  useEffect(() => {
    editingAssetIdRef.current = editingAssetId;
  }, [editingAssetId]);

  useEffect(() => {
    const renameTimeouts = renameTimeoutsRef.current;
    return () => {
      renameTimeouts.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      renameTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (resolvedNavIndex == null || resolvedNavIndex < 0) {
      return;
    }
    updateIndicator(resolvedNavIndex);
    if (!indicatorReady) {
      const frame = requestAnimationFrame(() => setIndicatorReady(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [resolvedNavIndex, updateIndicator, indicatorReady]);

  useEffect(() => {
    const handleResize = () => {
      if (resolvedNavIndex == null || resolvedNavIndex < 0) {
        return;
      }
      updateIndicator(resolvedNavIndex);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resolvedNavIndex, updateIndicator]);

  useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0e1012] font-sans text-[#f7f7f8]">
      <div className="mx-auto flex w-full md:max-w-[90rem]">
        <aside className="sticky top-0 hidden min-h-screen w-24 flex-col items-center border-r border-[rgba(255,255,255,0.08)] bg-[#0e1012] py-3 md:flex">
          <div
            ref={navContainerRef}
            className="relative flex w-full flex-1 flex-col items-center gap-4"
          >
            <div
              className="pointer-events-none absolute left-0 top-0 w-1.5 rounded-r-lg bg-[#6a47ff] transition-[transform,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateY(${indicatorStyle.top}px)`,
                height: `${indicatorStyle.height}px`,
                opacity: indicatorStyle.opacity,
                transition: indicatorReady ? undefined : "none",
                boxShadow: "0px 0px 12px rgba(106, 71, 255, 0.5)",
              }}
            />
            <SaturaLogo size="md" />
            <div className="h-px w-10 bg-[rgba(255,255,255,0.08)]" />
            <nav
              className="flex flex-col gap-2"
              onMouseLeave={() => setHoveredNavIndex(null)}
            >
              {navItems.map((item, index) => (
                <a
                  key={item.label}
                  href={item.href}
                  ref={(element) => {
                    navItemRefs.current[index] = element;
                  }}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-200 ${
                    item.active ? "bg-[rgba(154,237,0,0.1)]" : "hover:bg-[rgba(255,255,255,0.05)]"
                  }`}
                  aria-label={item.label}
                  onMouseEnter={() => setHoveredNavIndex(index)}
                >
                  {item.icon}
                </a>
              ))}
            </nav>
            <div className="mt-auto pb-6">
              <button
                className="group flex h-12 w-12 flex-col items-center justify-center rounded-xl border border-transparent transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.05)] xl:h-14 xl:w-14"
                type="button"
                aria-label="Search"
                onClick={() => setSearchOpen(true)}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[#898a8b] transition-colors group-hover:text-[#f7f7f8]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="text-[10px] font-medium text-[#898a8b] transition-colors group-hover:text-[#f7f7f8]">
                  Cmd+K
                </span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-[100dvh] w-full flex-1 flex-col px-4 pb-16 pt-3 md:px-6 md:py-6">
          <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-[#0e1012]/90 px-4 py-3 backdrop-blur-xl md:hidden">
            <SaturaLogo size="sm" />
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] transition-colors hover:bg-[#252729]"
              type="button"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4 text-[#f7f7f8]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          </div>

          <div
            className={`fixed inset-0 z-40 md:hidden ${
              mobileMenuOpen ? "" : "pointer-events-none"
            }`}
          >
            <div
              className={`absolute inset-0 bg-black/50 transition-opacity ${
                mobileMenuOpen ? "opacity-100" : "opacity-0"
              }`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              className={`absolute left-0 top-0 h-full w-[82%] max-w-xs bg-[#0e1012] shadow-xl transition-transform ${
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="p-3">
                <div className="flex items-center space-x-3">
                  <img
                    src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                    alt="Profile"
                    className="h-10 w-10 rounded-full object-cover"
                    draggable="false"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#f7f7f8]">
                      Jonathan Groschel
                    </p>
                    <p className="text-xs text-[#898a8b]">
                      jonathangroschel5@gmail.com
                    </p>
                  </div>
                </div>
              </div>

              <div className="py-1">
                {mobileSections.map((section) => {
                  const sectionId = section.label
                    .toLowerCase()
                    .replace(/\s+/g, "-");
                  const isOpen = openSections[section.label];

                  return (
                    <div
                      key={section.label}
                      className="border-b border-[rgba(255,255,255,0.08)] last:border-0"
                    >
                      <button
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.05)] focus:outline-none"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`section-${sectionId}`}
                        onClick={() => toggleSection(section.label)}
                      >
                        <div className="flex items-center space-x-2">
                          {section.icon}
                          <span className="text-sm font-medium text-[#f7f7f8]">
                            {section.label}
                          </span>
                        </div>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className={`h-4 w-4 text-[#898a8b] transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                      <div
                        id={`section-${sectionId}`}
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${
                          isOpen ? "max-h-96" : "max-h-0"
                        }`}
                      >
                        <div className="py-1">
                          {section.items.map((item) => (
                            <a
                              key={item.label}
                              href={item.href}
                              className="flex w-full items-center px-10 py-2 text-left text-sm text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] focus:outline-none"
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {item.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2">
                {mobileFooterActions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      action.tone === "danger"
                        ? "text-[#e72930] hover:bg-[rgba(231,41,48,0.1)]"
                        : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-20 hidden items-center justify-between bg-[#0e1012]/95 py-3 backdrop-blur-xl md:flex">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-[#9aed00]"
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
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-geist-sans)] text-lg font-semibold uppercase tracking-tight text-[#f7f7f8]">Assets</h2>
              </div>
            </div>
            <div className="relative" ref={profileMenuRef}>
              <button
                className="flex h-10 w-auto items-center space-x-3 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-1 px-2 transition-colors hover:bg-[#252729] focus:outline-none"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="assets-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <img
                  src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                  alt="Profile"
                  className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                  draggable="false"
                />
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-[#898a8b]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                id="assets-profile-menu"
                className={`absolute right-0 top-full z-30 mt-2 w-64 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-lg transition-all duration-150 ${
                  profileMenuOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-1 opacity-0"
                }`}
              >
                <div className="flex flex-row items-center space-x-2 px-3 py-2">
                  <img
                    src="https://lh3.googleusercontent.com/a/ACg8ocIpO3tPyuyBmmElNF-TQRNnIwAow9n7zGLo64RDHYAw7zMMX1ogFA=s96-c"
                    alt="Profile"
                    className="h-6 w-6 select-none rounded-full object-cover md:h-8 md:w-8"
                    draggable="false"
                  />
                  <div className="flex flex-col items-start justify-start">
                    <p className="text-base font-medium text-[#f7f7f8]">Jonathan Groschel</p>
                    <p className="text-xs text-[#898a8b]">
                      jonathangroschel5@gmail.com
                    </p>
                  </div>
                </div>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Settings
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Upgrade
                </button>
                <button
                  className="block w-full px-3 py-1.5 text-left text-xs font-normal text-[#898a8b] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  24/7 Support
                </button>
                <button
                  className="block w-full rounded-b-lg px-3 py-1.5 text-left text-xs font-normal text-[#e72930] transition-colors hover:bg-[rgba(231,41,48,0.1)] sm:px-3 sm:py-2 sm:text-sm"
                  type="button"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 border-t border-[rgba(255,255,255,0.08)] pt-4 md:border-none md:pt-0">
            <div className="flex flex-col space-y-3 lg:flex-row lg:items-end lg:justify-between lg:space-y-0">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                <div className="relative flex h-fit gap-4 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
                  {assetTabs.map((tab) => (
                    <button
                      key={tab}
                      className={`relative min-w-fit cursor-pointer select-none whitespace-nowrap py-2 text-sm font-medium transition-colors ${
                        tab === activeTab
                          ? "text-[#f7f7f8]"
                          : "text-[#898a8b] hover:text-[#f7f7f8]"
                      }`}
                      type="button"
                      aria-pressed={tab === activeTab}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                      {tab === activeTab ? (
                        <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#9aed00]" />
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*,image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadAssets}
                  />
                  <button
                    className="inline-flex w-full items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-3 py-2 text-sm font-medium text-[#898a8b] transition-colors hover:bg-[#252729] hover:text-[#f7f7f8] lg:w-auto"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Assets
                  </button>
                  <div className="relative w-full lg:w-64" ref={sortMenuRef}>
                    <button
                      className="w-full"
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={sortMenuOpen}
                      onClick={() => setSortMenuOpen((open) => !open)}
                    >
                      <div className="flex cursor-pointer items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-3 py-2 transition-colors hover:bg-[#252729]">
                        <p className="text-sm text-[#f7f7f8]">{assetSortLabel}</p>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4 text-[#898a8b]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m21 16-4 4-4-4" />
                          <path d="M17 20V4" />
                          <path d="m3 8 4-4 4 4" />
                          <path d="M7 4v16" />
                        </svg>
                      </div>
                    </button>
                    <div
                      role="listbox"
                      aria-label="Sort assets"
                      className={`absolute z-30 mt-2 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-1 text-sm shadow-lg transition-all ${
                        sortMenuOpen
                          ? "pointer-events-auto translate-y-0 opacity-100"
                          : "pointer-events-none translate-y-1 opacity-0"
                      }`}
                    >
                      {assetSortOptions.map((option) => {
                        const isSelected = option.key === assetSortKey;
                        return (
                          <button
                            key={option.key}
                            role="option"
                            aria-selected={isSelected}
                            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
                              isSelected
                                ? "bg-[rgba(154,237,0,0.1)] text-[#f7f7f8]"
                                : "text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8]"
                            }`}
                            type="button"
                            onClick={() => {
                              setAssetSortKey(option.key);
                              setSortMenuOpen(false);
                            }}
                          >
                            <span>{option.label}</span>
                            {isSelected ? (
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="h-4 w-4 text-[#9aed00]"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m20 6-11 11-5-5" />
                              </svg>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid flex-1 auto-rows-max grid-cols-1 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {sortedAssets.length ? (
                sortedAssets.map((asset) => {
                  const isEditingName = editingAssetId === asset.id;
                  const nameDraft = assetNameDrafts[asset.id] ?? asset.name;
                  return (
                    <div
                      key={asset.id}
                      className="group flex flex-col overflow-hidden rounded-xl border border-[rgba(217,217,217,0.04)] bg-[#1a1c1e] shadow-sm transition-all duration-200 hover:border-[rgba(106,71,255,0.3)]"
                    >
                      <div className="relative h-40 w-full overflow-hidden bg-[#0e1012]">
                        {asset.kind === "image" ? (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : asset.kind === "audio" ? (
                          <div className="flex h-full items-center justify-center">
                            <audio src={asset.url} controls className="w-full px-3" />
                          </div>
                        ) : (
                          <video
                            src={asset.url}
                            className="h-full w-full object-cover"
                            controls
                            muted
                            playsInline
                            preload="metadata"
                          />
                        )}
                        <button
                          type="button"
                          className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1c1e]/90 text-[#898a8b] opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-[#1a1c1e] hover:text-[#e72930]"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteAsset(asset.id);
                          }}
                          aria-label={`Delete ${asset.name}`}
                        >
                          <svg viewBox="0 0 16 16" className="h-3 w-3">
                            <path
                              d="M12 4 4 12M4 4l8 8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        {isEditingName ? (
                          <input
                            value={nameDraft}
                            autoFocus
                            maxLength={120}
                            className="h-7 w-full rounded-md border border-[#9aed00]/30 bg-[#0e1012] px-2 text-sm font-medium text-[#f7f7f8] outline-none ring-0 transition focus:border-[#9aed00] focus:ring-2 focus:ring-[#9aed00]/20"
                            onChange={(event) =>
                              handleAssetNameChange(
                                asset.id,
                                event.currentTarget.value
                              )
                            }
                            onBlur={() => handleAssetNameBlur(asset.id)}
                            onKeyDown={(event) => handleAssetNameKeyDown(event, asset)}
                            aria-label="Asset name"
                          />
                        ) : (
                          <button
                            type="button"
                            className="truncate rounded px-1 text-left text-sm font-medium text-[#f7f7f8] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                            onClick={() => handleAssetNameClick(asset)}
                            aria-label={`Rename ${asset.name}`}
                          >
                            <span className="truncate">{asset.name}</span>
                          </button>
                        )}
                        <p className="text-xs uppercase tracking-wider text-[#898a8b]">
                          {asset.kind}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full flex cursor-default flex-col items-center justify-center py-12">
                  <p className="text-sm text-[#898a8b] sm:text-base">
                    No items found
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center space-y-3 sm:hidden">
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m11 17-5-5 5-5" />
                    <path d="m18 17-5-5 5-5" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 17 5-5-5-5" />
                    <path d="m13 17 5-5-5-5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative hidden h-8 items-center justify-center sm:flex">
              <span className="absolute left-0 text-sm text-[#898a8b]">
                Page 1 of 0
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m11 17-5-5 5-5" />
                    <path d="m18 17-5-5 5-5" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <button
                  className="inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-1 text-sm text-[#898a8b] disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 17 5-5-5-5" />
                    <path d="m13 17 5-5-5-5" />
                  </svg>
                </button>
              </div>
              <span className="absolute right-0 text-sm text-[#898a8b]">
                8 / page
              </span>
            </div>
          </div>
        </main>
      </div>
      <SearchOverlay open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
