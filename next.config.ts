import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore until all type errors are fixed
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

const config = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default withSentryConfig(config, {
  silent: true,
  org: "atlas-helpdesk",
  project: "atlas-helpdesk",
});
