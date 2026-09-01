/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits a minimal server bundle for the Docker runtime stage.
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
