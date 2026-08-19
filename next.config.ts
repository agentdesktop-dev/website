import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.CF_PAGES === "1" ? "export" : undefined,
  trailingSlash: true,
  ...(process.env.NODE_ENV === "development"
    ? {
        async rewrites() {
          return [
            {
              source: "/docs/:file.:ext",
              destination: "http://localhost:1313/docs/:file.:ext",
            },
            {
              source: "/docs/:path*/:file.:ext",
              destination: "http://localhost:1313/docs/:path*/:file.:ext",
            },
            {
              source: "/docs/",
              destination: "http://localhost:1313/docs/",
            },
            {
              source: "/docs/:path*/",
              destination: "http://localhost:1313/docs/:path*/",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
