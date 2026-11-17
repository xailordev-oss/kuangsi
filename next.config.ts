import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  async headers() {
    return [
      {
        // service worker ຕ້ອງໄດ້ສະບັບໃໝ່ສະເໝີ ບໍ່ດັ່ງນັ້ນເຄື່ອງຈະຄ້າງຢູ່ກັບສະບັບເກົ່າ
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
