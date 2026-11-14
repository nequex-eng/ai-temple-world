import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  reporter: "list",
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: process.env.BASE_URL || "https://ai-temple-world.pages.dev",
    ...devices["Desktop Chrome"],
    launchOptions: {
      args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    }
  }
});
