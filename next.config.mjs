/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["archiver"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
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
