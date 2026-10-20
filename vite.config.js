import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    warmup: {
      clientFiles: ["./index.html", "./src/main.js", "./src/world.js"],
    },
  },
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: [
      "three",
      "three/addons/controls/OrbitControls.js",
      "three/addons/lines/LineMaterial.js",
      "three/addons/lines/LineSegments2.js",
      "three/addons/lines/LineSegmentsGeometry.js",
    ],
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    sourcemap: false,
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 2200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replaceAll("\\", "/");
          if (norm.includes("/node_modules/three/")) return "three";
          if (norm.includes("/src/data/")) return "atlas";
        },
      },
    },
  },
});
