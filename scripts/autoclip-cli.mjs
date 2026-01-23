#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
};

const inputArg = getArg("--input") || args[0];
const autoApprove = args.includes("--auto-approve");
const quality = getArg("--quality") || "auto";
const cropMode = getArg("--crop") || "auto";
const subtitles = getArg("--subtitles") !== "false";
const baseUrl =
  getArg("--base-url") ||
  process.env.AUTOCLIP_BASE_URL ||
  "http://localhost:3000";

if (!inputArg) {
  console.error("Missing input. Use --input <url|file>.");
  process.exit(1);
}

const requestJson = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }
  return response.json();
};

const askWithTimeout = (question, timeoutMs) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const timer = setTimeout(() => {
      rl.close();
      resolve(null);
    }, timeoutMs);
    rl.question(question, (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim());
    });
  });

const createSession = async () => {
  return requestJson(`${baseUrl}/api/autoclip/session`, {
    options: {
      autoApprove,
      quality,
      cropMode,
      subtitlesEnabled: subtitles,
    },
  });
};

const uploadInput = async (sessionId) => {
  try {
    const stat = await fs.stat(inputArg);
    if (stat.isFile()) {
      const buffer = await fs.readFile(inputArg);
      const file = new File([buffer], path.basename(inputArg));
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("file", file);
      const response = await fetch(`${baseUrl}/api/autoclip/input`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Input upload failed.");
      }
      return response.json();
    }
  } catch {
    // Not a file, treat as URL.
  }
  return requestJson(`${baseUrl}/api/autoclip/input`, {
    sessionId,
    url: inputArg,
  });
};

const transcribe = async (sessionId) =>
  requestJson(`${baseUrl}/api/autoclip/transcribe`, { sessionId });

const highlight = async (sessionId) =>
  requestJson(`${baseUrl}/api/autoclip/highlight`, { sessionId });

const approve = async (sessionId, action, autoApproved = false) =>
  requestJson(`${baseUrl}/api/autoclip/approve`, {
    sessionId,
    action,
    autoApproved,
  });

const render = async (sessionId) =>
  requestJson(`${baseUrl}/api/autoclip/render`, { sessionId });

const main = async () => {
  console.log("Creating AutoClip session...");
  const session = await createSession();
  console.log(`Session: ${session.id}`);

  console.log("Preparing input...");
  await uploadInput(session.id);

  console.log("Transcribing...");
  await transcribe(session.id);

  console.log("Selecting highlight...");
  let highlightResult = await highlight(session.id);

  let approved = autoApprove;
  while (!approved) {
    const clip = highlightResult.highlight;
    console.log(`\nSelected: ${clip.start}s - ${clip.end}s`);
    const answer = await askWithTimeout(
      "Approve [enter], regenerate [r], cancel [n] (auto-approve in 15s): ",
      15000
    );
    if (!answer) {
      console.log("Auto-approving selection.");
      approved = true;
      await approve(session.id, "approve", true);
      break;
    }
    if (answer.toLowerCase() === "r") {
      console.log("Regenerating highlight...");
      highlightResult = await approve(session.id, "regenerate");
      continue;
    }
    if (answer.toLowerCase() === "n") {
      console.log("Cancelled.");
      process.exit(0);
    }
    approved = true;
    await approve(session.id, "approve", false);
  }

  if (autoApprove) {
    await approve(session.id, "approve", true);
  }

  console.log("Rendering...");
  const renderResult = await render(session.id);
  console.log("Output ready:", renderResult.output?.filename);
  console.log(`Download: ${baseUrl}/api/autoclip/download?sessionId=${session.id}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
