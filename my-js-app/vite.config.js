import { defineConfig } from 'vite';

export default defineConfig({
  // Ensure built asset paths are relative so the site works from Netlify (and subpaths)
  base: './'
});
