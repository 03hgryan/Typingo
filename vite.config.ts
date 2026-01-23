import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        {
          src: "manifest.json",
          dest: ".",
        },
        {
          src: "public",
          dest: ".",
        },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        sidepanel: "sidepanel.html",
        offscreen: "offscreen.html",
        content: "src/content.ts",
        background: "src/background.ts",
      },
      output: {
        entryFileNames: "src/[name].js",
      },
    },
  },
});
