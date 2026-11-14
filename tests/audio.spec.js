import { test, expect } from "@playwright/test";

test("sound button starts recorded outdoor ambience and can mute it", async ({ page }) => {
  const pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#sound-toggle")).toBeVisible();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","false");

  // The user's click must unlock both Web Audio and the recorded bird ambience.
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","true");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.state())).toBe("running");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.paused)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.time)).toBeGreaterThan(0.2);

  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","false");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.paused)).toBe(true);
  expect(pageErrors).toEqual([]);
});
