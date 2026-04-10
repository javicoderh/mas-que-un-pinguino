import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://esmasqueunpinguino.cl",
  output: "server",
  adapter: vercel({}),
  integrations: [vue()],
  security: {
    checkOrigin: false
  },
  vite: {
    server: {
      allowedHosts: ["showery-overbearing-dennis.ngrok-free.dev"]
    },
    plugins: [tailwindcss()]
  }
});
