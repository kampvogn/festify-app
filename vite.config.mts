import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    root: '.',
    build: {
        outDir: 'build-react',
        rollupOptions: {
            input: 'index-react.html',
        },
    },
    server: {
        port: 5173,
        open: '/index-react.html',
    },
});
