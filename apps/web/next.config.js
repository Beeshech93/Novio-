/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image only; Vercel builds are unaffected.
  ...(process.env.DOCKER_BUILD === '1' && { output: 'standalone', outputFileTracingRoot: require('path').join(__dirname, '../../') }),
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
  // Same-origin API: the browser calls /api/v1/* on the web domain and Next proxies it to API_ORIGIN.
  // That keeps the session cookie first-party (two *.vercel.app domains are cross-site) and avoids CORS.
  async rewrites() {
    const origin = process.env.API_ORIGIN?.replace(/\/$/, '');
    return origin ? [{ source: '/api/v1/:path*', destination: `${origin}/api/v1/:path*` }] : [];
  },
};
