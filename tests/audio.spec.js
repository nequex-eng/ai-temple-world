import { test, expect } from "@playwright/test";

test("new visitors can start temple ambience before creating a monk", async ({ page }) => {
  const pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>location.host)).toBe("127.0.0.1:4173");
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  await expect(page.locator("#profile-modal")).not.toHaveClass(/hidden/);
  await expect(page.locator("#profile-sound-toggle")).toBeVisible();
  await expect(page.locator("#profile-sound-toggle")).toHaveAttribute("aria-pressed","false");

  // A real visitor gesture starts Web Audio and the recorded outdoor ambience.
  await page.locator("#profile-sound-toggle").click();
  await expect(page.locator("#profile-sound-toggle")).toHaveAttribute("aria-pressed","true");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","true");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.state())).toBe("running");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.paused)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.time)).toBeGreaterThan(0.2);
  await page.locator('[data-close="profile-modal"]').click();
  await page.evaluate(()=>window.__templeDebug.setPosition(0,-37));
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().chant.paused)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().chant.time)).toBeGreaterThan(0.2);
  await page.locator("#sound-settings").click();
  await page.locator("#sound-test").click();
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().bell.paused)).toBe(false);
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().bell.time)).toBeGreaterThan(0.2);
  await page.locator('[data-close="sound-modal"]').click();
  await page.locator("#sound-settings").click();
  await expect(page.locator("#sound-modal")).not.toHaveClass(/hidden/);
  await page.locator("#sound-ambience").evaluate(el=>{el.value="42";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await expect(page.locator("#sound-ambience-value")).toHaveText("42%");
  await page.locator('[data-close="sound-modal"]').click();

  // Mute from the same first-visit dialog; both controls must stay in sync.
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#profile-sound-toggle")).toHaveAttribute("aria-pressed","false");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","false");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.paused)).toBe(true);
  expect(pageErrors).toEqual([]);
});
