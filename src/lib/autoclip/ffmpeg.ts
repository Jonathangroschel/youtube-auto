import { spawn } from "child_process";

const resolveBinary = (name: "ffmpeg" | "ffprobe") => {
  const envKey =
    name === "ffmpeg" ? "AUTOCLIP_FFMPEG_PATH" : "AUTOCLIP_FFPROBE_PATH";
  return process.env[envKey] || name;
};

export const runCommand = (
  command: string,
  args: string[],
  cwd?: string
) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${command} exited with code ${code}. ${stderr || stdout}`.trim()
          )
        );
      }
    });
  });

export const runFfmpeg = (args: string[], cwd?: string) =>
  runCommand(resolveBinary("ffmpeg"), args, cwd);

export const runFfprobe = async (inputPath: string) => {
  const { stdout } = await runCommand(resolveBinary("ffprobe"), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    inputPath,
  ]);
  return JSON.parse(stdout) as {
    streams?: { width?: number; height?: number }[];
    format?: { duration?: string };
  };
};
