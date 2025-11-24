/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export', // Required for Tauri
    images: {
        unoptimized: true, // Required for static export
    },
};

export default nextConfig;
