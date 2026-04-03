import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";
import vercel from "@astrojs/vercel/serverless";

export default defineConfig({
  site: "https://esmasqueunpinguino.cl",
  output: "server",
  adapter: vercel({}),
  integrations: [vue()],
  security: {
    checkOrigin: false
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
