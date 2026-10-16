import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // NavigatedViewer: the process instance viewer's (InstanceViewerModal) -
    // listed so it's pre-bundled up front, not discovered on first use
    include: ['monaco-editor', 'bpmn-js/lib/NavigatedViewer'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        },
      },
    },
  },
  server: {
    port: 3000,
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
