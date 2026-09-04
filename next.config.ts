import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop Next from climbing out of this project into C:\Users\hp (home dir
  // holds an unrelated package.json/tsconfig that confuses root detection).
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
