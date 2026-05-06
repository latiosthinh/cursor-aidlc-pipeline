import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  root: resolve(__dirname, "src/panel"),
  plugins: [tailwindcss()],
  build: {
    outDir: resolve(__dirname, "dist/panel"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "src/panel/index.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
