import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Go backend runs on :8080 in local dev

  // E2E tests (playwright.config.ts) build into their own folder so a test run never clobbers
  // the .next folder of a `next dev` you may have running.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  async redirects() {
    return [
      {
        // The public page used to live at /publico/<slug>. QR Codes may already be printed with
        // that URL (and the backend may still generate it), so keep it working.
        source: "/publico/:slug",
        destination: "/public/:slug",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
