import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    root: '.', // Look for index.html in frontend/
    build: {
        outDir: 'dist',
    },
});
