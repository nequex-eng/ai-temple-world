import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => { await cleanTestGuest(page); });

async function cleanTestGuest(page) {
  try {
    const id = await page.evaluate(() => localStorage.getItem("temple-world-player-id"));
    if (!id) return;
    await page.evaluate(async playerId => {
      await fetch("https://temple-world-api.nequex.workers.dev/api/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_id: playerId })
      });
      localStorage.removeItem("temple-world-profile-v2");
      localStorage.removeItem("temple-world-player-id");
    }, id);
  } catch {}
}

test("desktop: create a monk, connect to the shared room, chat and open the wish wall", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await expect(page.locator("#world canvas")).toBeVisible();
  await expect(page.locator("#profile-modal")).not.toHaveClass(/hidden/);

  await page.locator("#monk-name").fill("CI Pilgrim");
  await page.locator("#monk-style").selectOption("pilgrim");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 25000 });

  await page.evaluate(() => document.activeElement?.blur());
  const beforeMove = await page.evaluate(() => window.__templeDebug.position().z);
  await page.keyboard.down("w");
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().keys.w)).toBe(true);
  await page.waitForTimeout(2000);
  await page.keyboard.up("w");
  const afterMove = await page.evaluate(() => window.__templeDebug.position().z);
  expect(afterMove).toBeLessThan(beforeMove - 0.5);

  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.state())).toBe("running");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.time)).toBeGreaterThan(0.2);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.paused)).toBe(true);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.__templeDebug.setPosition(-28, 2));
  await page.locator('[data-action="bell"]').click();
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().bell.time)).toBeGreaterThan(0.2);

  await page.locator('[data-action="bow"]').click();
  await expect(page.locator("#toast")).toHaveClass(/show/);

  await page.locator("#chat-input").fill("Temple live-room smoke test");
  await page.locator("#chat-form button").click();
  await expect(page.locator("#chat-messages")).toContainText("Temple live-room smoke test");

  await page.locator("#open-prayers").click();
  await expect(page.locator("#prayer-modal")).not.toHaveClass(/hidden/);
  await expect(page.locator("#prayer-list")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await expect(page.locator("#character-name")).toHaveText("CI Pilgrim");
  expect(pageErrors).toEqual([]);
  await cleanTestGuest(page);
});

test("mobile: virtual joystick, run toggle and action dock are usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
  await expect(page.locator("#world canvas")).toBeVisible();
  await expect(page.locator("#mobile-controls")).toBeVisible();
  await expect(page.locator("#joystick")).toBeVisible();
  await expect(page.locator(".action-dock")).toBeVisible();

  await page.locator("#monk-name").fill("Mobile Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  const joystick = await page.locator("#joystick").boundingBox();
  const beforeMove = await page.evaluate(() => window.__templeDebug.position().z);
  await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height / 2);
  await page.mouse.down();
  await page.mouse.move(joystick.x + joystick.width / 2, joystick.y + joystick.height * 0.18, { steps: 5 });
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().joy.y)).toBeLessThan(-0.5);
  await page.waitForTimeout(700);
  await page.mouse.up();
  const afterMove = await page.evaluate(() => window.__templeDebug.position().z);
  expect(afterMove).toBeLessThan(beforeMove - 0.5);

  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.state())).toBe("running");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.paused)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.time)).toBeGreaterThan(0.2);
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__templeAudioDebug.media().birds.paused)).toBe(true);
  await page.locator("#run-toggle").click();
  await expect(page.locator("#run-toggle")).toHaveClass(/active/);
  await page.locator("#run-toggle").click();
  await expect(page.locator("#run-toggle")).not.toHaveClass(/active/);
  await cleanTestGuest(page);
});


test("temple walls block movement and the entrance stairs are climbable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
  await page.locator("#monk-name").fill("Collision Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await page.evaluate(() => document.activeElement?.blur());

  await page.evaluate(() => {
    const debug = window.__templeDebug;
    debug.setYaw(0);
    debug.setPosition(8.3, -10);
    for (let i = 0; i < 40; i++) debug.step({ right: 1 }, 0.05);
  });
  const wall = await page.evaluate(() => window.__templeDebug.position());
  expect(wall.x).toBeGreaterThanOrEqual(8.2);
  expect(wall.x).toBeLessThan(8.8);

  await page.evaluate(() => {
    const debug = window.__templeDebug;
    debug.setPosition(0, 0.9);
    for (let i = 0; i < 40; i++) debug.step({ forward: 1 }, 0.05);
  });
  const stairs = await page.evaluate(() => window.__templeDebug.position());
  const stairDebug = await page.evaluate(() => window.__templeDebug.input());
  console.log("stairs-regression", JSON.stringify({ wall, stairs, stairDebug }));
  expect(stairs.x).toBeLessThan(1);
  expect(stairs.x).toBeGreaterThan(-1);
  expect(stairs.z).toBeLessThan(-2.5);
  expect(stairs.y).toBeGreaterThan(0.45);
  await cleanTestGuest(page);
});

test("two independent guests share live presence and messages", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    for (const [page, name] of [[pageA, "Room Guest A"], [pageB, "Room Guest B"]]) {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
      await page.locator("#monk-name").fill(name);
      await page.locator("#save-profile").click();
      await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
      await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 25000 });
    }

    await expect.poll(async () => Number((await pageA.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => Number((await pageB.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(2);

    await pageA.locator("#chat-input").fill("Message from the other side of the courtyard");
    await pageA.locator("#chat-form button").click();
    await expect(pageB.locator("#chat-messages")).toContainText("Message from the other side of the courtyard", { timeout: 15000 });

    await pageB.locator('[data-action="chant"]').click();
    await expect(pageB.locator("#toast")).toHaveClass(/show/);
  } finally {
    await cleanTestGuest(pageA);
    await cleanTestGuest(pageB);
    await contextA.close();
    await contextB.close();
  }
});
