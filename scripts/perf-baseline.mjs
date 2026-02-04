#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const nextDir = path.join(rootDir, ".next");
const appServerDir = path.join(nextDir, "server", "app");
const chunksDir = path.join(nextDir, "static", "chunks");
const outputDir = path.join(rootDir, "output");
const outputPath = path.join(outputDir, "perf-baseline.json");

const routeHtmlMap = {
  "/": "index.html",
  "/login": "login.html",
  "/dashboard": "dashboard.html",
  "/projects": "projects.html",
  "/assets": "assets.html",
  "/tools": "tools.html",
  "/tools/autoclip": "tools/autoclip.html",
  "/tools/trust-score": "tools/trust-score.html",
  "/editor/advanced": "editor/advanced.html",
};

const toKb = (bytes) => Number((bytes / 1024).toFixed(1));

const exists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const collectChunkEntries = async (dir) => {
  const out = [];
  const walk = async (current) => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          return;
        }
        if (!entry.isFile() || !entry.name.endsWith(".js")) {
          return;
        }
        const stat = await fs.stat(fullPath);
        out.push({
          relPath: path.relative(nextDir, fullPath).replaceAll(path.sep, "/"),
          bytes: stat.size,
        });
      })
    );
  };
  await walk(dir);
  return out.sort((a, b) => b.bytes - a.bytes);
};

const parseRouteChunkRefs = (html) => {
  const matches = html.match(/\/_next\/static\/chunks\/[^"']+\.js/g) ?? [];
  return Array.from(new Set(matches));
};

const fileSizeOrZero = async (target) => {
  try {
    const stat = await fs.stat(target);
    return stat.size;
  } catch {
    return 0;
  }
};

const formatRouteSummary = (route, totalKb, count) =>
  `${route.padEnd(20)} ${String(totalKb).padStart(7)} KB  (${count} chunks)`;

const main = async () => {
  const buildExists = await exists(nextDir);
  if (!buildExists) {
    console.error("Missing .next directory. Run `npm run build` first.");
    process.exitCode = 1;
    return;
  }

  const allChunks = await collectChunkEntries(chunksDir);
  const chunkSizeMap = new Map(
    allChunks.map((entry) => [`/${entry.relPath.replace(/^static\//, "_next/static/")}`, entry.bytes])
  );

  const routeReports = [];
  for (const [route, relHtmlPath] of Object.entries(routeHtmlMap)) {
    const htmlPath = path.join(appServerDir, relHtmlPath);
    if (!(await exists(htmlPath))) {
      continue;
    }
    const html = await fs.readFile(htmlPath, "utf8");
    const chunkRefs = parseRouteChunkRefs(html);
    const chunks = chunkRefs.map((ref) => ({
      path: ref,
      bytes: chunkSizeMap.get(ref) ?? 0,
    }));
    const totalBytes = chunks.reduce((acc, chunk) => acc + chunk.bytes, 0);
    routeReports.push({
      route,
      chunkCount: chunks.length,
      totalBytes,
      totalKb: toKb(totalBytes),
      chunks: chunks
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 12)
        .map((chunk) => ({ path: chunk.path, kb: toKb(chunk.bytes) })),
    });
  }

  const editorChunk = allChunks.find((chunk) =>
    chunk.relPath.startsWith("static/chunks/app/editor/advanced/page-")
  );
  const dashboardReport = routeReports.find((report) => report.route === "/dashboard");
  const homeReport = routeReports.find((report) => report.route === "/");

  const summary = {
    generatedAt: new Date().toISOString(),
    gates: {
      noFullPageReloadInAppShell: "manual check required",
      homeJsPayloadKb: homeReport?.totalKb ?? null,
      dashboardJsPayloadKb: dashboardReport?.totalKb ?? null,
      editorChunkKb: editorChunk ? toKb(editorChunk.bytes) : null,
      noCriticalFlowRegression: "manual check required",
    },
    routeReports,
    largestChunks: allChunks.slice(0, 20).map((chunk) => ({
      path: `/${chunk.relPath.replace(/^static\//, "_next/static/")}`,
      kb: toKb(chunk.bytes),
    })),
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log("Route JS payloads");
  console.log("-----------------");
  routeReports
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .forEach((report) => {
      console.log(formatRouteSummary(report.route, report.totalKb, report.chunkCount));
    });

  console.log("\nLargest client chunks");
  console.log("---------------------");
  summary.largestChunks.slice(0, 10).forEach((chunk) => {
    console.log(`${String(chunk.kb).padStart(7)} KB  ${chunk.path}`);
  });

  if (editorChunk) {
    console.log(
      `\nEditor page chunk: ${toKb(editorChunk.bytes)} KB (${editorChunk.relPath})`
    );
  }
  console.log(`\nSaved report: ${path.relative(rootDir, outputPath)}`);
};

await main();
