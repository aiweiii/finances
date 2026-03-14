import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

// Load DB_DSN from the root .env.stg file
config({ path: path.resolve(__dirname, "../.env.stg") });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
