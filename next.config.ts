import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages read their SQL from db/queries at runtime (src/lib/queries.ts).
  // File tracing cannot see paths built from process.cwd(), so include the
  // SQL files in every route's serverless bundle.
  outputFileTracingIncludes: {
    "/**": ["./db/queries/**/*.sql"],
  },
};

export default nextConfig;
