/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // The tool moved from / to /search; keep old ?tab= links working.
      {
        source: "/",
        has: [{ type: "query", key: "tab" }],
        destination: "/search",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
