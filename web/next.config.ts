import type { NextConfig } from "next";

// Cache Components is left off on purpose. Almost every page here is per-user
// (business dashboard) or per-session (customer flow), so there is nothing to
// prerender, and turning it on would force a Suspense boundary around every
// session read for no gain.
const nextConfig: NextConfig = {
  // Fonts read from disk by the compositing code must ship with the functions.
  outputFileTracingIncludes: { "/api/**": ["./assets/fonts/*"] },
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
