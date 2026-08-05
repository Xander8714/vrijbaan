import path from "path";
import { defineConfig } from "vitest/config";

// `@/` erbij (5 aug 2026) — zonder deze alias kon een test geen enkel
// bestand importeren dat zelf `@/...` gebruikt (zoals een API-route), ook al
// testte de test alleen een simpele, losstaande functie daarin. Mirrort
// exact de "@/*": ["./src/*"]-mapping uit tsconfig.json.
export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
