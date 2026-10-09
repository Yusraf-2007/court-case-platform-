import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app reads its SQL from db/queries at runtime. Include those files in
  // the serverless bundle, since file tracing cannot see paths built from
  // process.cwd().
  outputFileTracingIncludes: {
    "/cases": ["./db/queries/**/*.sql"],
    "/cases/[id]": ["./db/queries/**/*.sql"],
    "/cases/[id]/edit": ["./db/queries/**/*.sql"],
    "/cases/new": ["./db/queries/**/*.sql"],
  },
};

export default nextConfig;
