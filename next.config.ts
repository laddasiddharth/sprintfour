import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse-new", "pdf-parse", "mammoth"],
};

export default nextConfig;
