import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "wjjrtczphftjypqqnnek.supabase.co" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;