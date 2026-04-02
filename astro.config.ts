import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://esmasqueunpinguino.cl",
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()]
  }
});
