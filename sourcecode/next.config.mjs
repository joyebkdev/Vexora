/** @type {import('next').NextConfig} */
const nextConfig = {
  // All images are local static assets; skip the native optimizer.
  images: { unoptimized: true },
};

export default nextConfig;
