const fs = require("fs");
const path = require("path");

const root = process.cwd();
const source = path.join(root, "node_modules", "tslib");
const supabaseRoot = path.join(root, "node_modules", "@supabase");

const ensureTslib = (target) => {
  const targetFile = path.join(target, "tslib.es6.mjs");
  if (fs.existsSync(targetFile)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
};

const main = () => {
  if (!fs.existsSync(source) || !fs.existsSync(supabaseRoot)) {
    return;
  }
  const entries = fs.readdirSync(supabaseRoot, { withFileTypes: true });
  entries.forEach((entry) => {
    if (!entry.isDirectory()) {
      return;
    }
    const target = path.join(supabaseRoot, entry.name, "node_modules", "tslib");
    if (fs.existsSync(target)) {
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {
        fs.rmSync(target, { recursive: true, force: true });
        ensureTslib(target);
      } else {
        ensureTslib(target);
      }
      return;
    }
    ensureTslib(target);
  });
};

main();
