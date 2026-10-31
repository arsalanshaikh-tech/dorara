/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Proxy the browser's relative /api/v1/* calls to the backend (Render). The browser only ever
  // talks to this site, so auth cookies are first-party (SameSite=Lax, Safari-safe). BACKEND_URL
  // is a SERVER-side variable (never exposed to the browser), e.g. https://dorara-api.onrender.com
  // Vercel's external-rewrite timeout is 120s, so the app keeps AI/provider calls well under that.
  async rewrites() {
    const backend = (process.env.BACKEND_URL || '').trim().replace(/\/+$/, '')
    if (!backend) return []
    return [
      { source: '/api/v1/:path*', destination: `${backend}/api/v1/:path*` },
      // Used by the pre-warm ping that wakes a sleeping free-tier backend.
      { source: '/api/health', destination: `${backend}/health` },
    ]
  },
}

export default nextConfig
