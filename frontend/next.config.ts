import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

// Load  config
const envName = process.env.APP_ENV || "stg"
config({ path: path.resolve(__dirname, `../.env.${envName}`) });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
