import { defineConfig } from 'vite';

// `base` matches the GitHub Pages path: https://<user>.github.io/instagram-downloader/
// If forking under a different repo name, change this to `/<repo-name>/`.
export default defineConfig({
  root: 'web',
  base: '/instagram-downloader/',
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
  },
});
