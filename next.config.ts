import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Cabeceras de seguridad HTTP aplicadas a todas las respuestas.
 * Refuerzan la protección contra sniffing de tipos MIME, clickjacking,
 * XSS en navegadores antiguos y filtrado de información del referer.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), payment=(), geolocation=(self)",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No revelar el framework utilizado en la cabecera X-Powered-By
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "wjjrtczphftjypqqnnek.supabase.co" },
      { protocol: "https", hostname: "localhost" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suprime los logs del build de Sentry a menos que se force
  silent: true,
  // Desactiva la telemetría del asistente de Sentry en el build
  telemetry: false,
  // Sube source maps solo si se configura el auth token y el org/project
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // Evita que Sentry sobrescriba variables de entorno del build si no existen
  disableLogger: true,
  // Auto-instrumentación de componentes del servidor
  reactComponentAnnotation: {
    enabled: false,
  },
  tunnelRoute: "/monitoring",
});