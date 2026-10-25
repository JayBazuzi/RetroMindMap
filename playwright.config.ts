import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5198",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  webServer: {
    // Blank Firebase config forces local mode, so tests never touch a real database.
    command: "npx vite --port 5198 --strictPort",
    env: { VITE_FIREBASE_DATABASE_URL: "" },
    url: "http://localhost:5198",
    reuseExistingServer: !process.env.CI,
  },
});
