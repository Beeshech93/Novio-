/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image only; Vercel builds are unaffected.
  ...(process.env.DOCKER_BUILD === '1' && { output: 'standalone', outputFileTracingRoot: require('path').join(__dirname, '../../') }),
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),
};
