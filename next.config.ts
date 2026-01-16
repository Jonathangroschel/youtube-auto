import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    const tslibPath = path.join(
      process.cwd(),
      "node_modules",
      "tslib",
      "tslib.es6.mjs"
    );
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      tslib: tslibPath,
    };
    return config;
  },
};

export default nextConfig;
