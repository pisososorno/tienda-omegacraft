/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["archiver"],
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
    proxyClientMaxBodySize: "600mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/redeem/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/my-downloads", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/checkout/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    return [
      // SEO: canonical home is /, redirect /home → / permanently
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      // beforeFiles: run BEFORE filesystem routes (so /app/page.tsx is bypassed)
      beforeFiles: [
        // Serve the (public)/home/page.tsx content at /
        { source: "/", destination: "/home" },
      ],
      afterFiles: [
        { source: "/uploads/:path*", destination: "/api/uploads/:path*" },
      ],
    };
  },
};

export default nextConfig;
