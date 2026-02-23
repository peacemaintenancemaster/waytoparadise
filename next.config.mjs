/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // <- 이 줄을 지우거나 주석 처리하세요.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig