import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // /admin (where sign-in lands) opens the chore list. A config redirect rather than redirect() in a page:
  // a page that only redirects cannot be rendered or prefetched.
  async redirects() {
    return [{ source: "/admin", destination: "/admin/chores", permanent: false }];
  },
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
