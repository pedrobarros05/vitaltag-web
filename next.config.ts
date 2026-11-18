import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Go backend runs on :8080 in local dev

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
