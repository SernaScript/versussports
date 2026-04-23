import type { NextConfig } from "next";

const appEnv = (
  globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env?.APP_ENV;

const isQA = appEnv === "qa";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: isQA,
  },
};

export default nextConfig;