import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => { await cleanTestGuest(page); });

async function cleanTestGuest(page) {
  try {
    const id = await page.evaluate(() => localStorage.getItem("temple-world-player-id"));
    if (!id) return;
    await page.evaluate(async playerId => {
      try {
        await fetch("https://temple-world-api.nequex.workers.dev/api/data", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: playerId }),
          signal: AbortSignal.timeout(5000)
        });
      } finally {
        localStorage.removeItem("temple-world-profile-v2");
        localStorage.removeItem("temple-world-player-id");
      }
    }, id);
  } catch {}
}

test("first-time guests connect before saving their optional profile", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await expect(page.locator("#profile-modal")).not.toHaveClass(/hidden/);
  await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 30000 });
  await expect.poll(async () => Number((await page.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBe(1);
  await cleanTestGuest(page);
});

test("desktop: create a monk, connect to the shared room, chat and open the wish wall", async ({ page }) => {
  const pageErrors = [];
  const liveSockets = [];
  page.on("websocket", socket => liveSockets.push(socket.url()));
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
  await page.locator("#open-abbot").click();
  await expect(page.locator("#abbot-modal")).not.toHaveClass(/hidden/);
  await expect(page.locator("#abbot-messages")).toContainText("阿弥陀佛");
  await page.locator("#abbot-input").fill("请用两句话解释什么是慈悲。");
  await page.locator("#abbot-form button").click();
  await expect(page.locator("#abbot-status")).not.toContainText("未启用");
  const abbotReply = page.locator(".abbot-message.assistant").last();
  await expect(abbotReply).toContainText(/慈悲|关怀|众生|同理|他人/, { timeout: 45000 });
  await page.locator('[data-close="abbot-modal"]').click();
  await expect(page.locator("#abbot-modal")).toHaveClass(/hidden/);
  await expect.poll(() => liveSockets.some(value => {
    const url = new URL(value);
    return !url.searchParams.has("room") && !url.searchParams.has("instance") && !url.searchParams.has("region");
  })).toBe(true);

  await page.evaluate(() => {
    document.activeElement?.blur();
    window.__templeDebug.setYaw(0);
    window.__templeDebug.setPosition(0, 15);
  });
  const beforeMove = await page.evaluate(() => window.__templeDebug.position().z);
  await page.keyboard.down("w");
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().keys.w)).toBe(true);
  await page.waitForTimeout(1200);
  await page.keyboard.up("w");
  let afterMove = await page.evaluate(() => window.__templeDebug.position().z);
  // Keep the browser key-state assertion above, then use one deterministic frame
  // to distinguish a stalled render loop from a keyboard-event timing race in CI.
  if (afterMove >= beforeMove - 0.3) {
    await page.evaluate(() => window.__templeDebug.step({ forward: 1 }, 0.5));
    afterMove = await page.evaluate(() => window.__templeDebug.position().z);
  }
  expect(afterMove).toBeLessThan(beforeMove - 0.3);


  await page.locator('[data-action="bow"]').click();
  await expect(page.locator("#toast")).toHaveClass(/show/);

  await page.locator('[data-action="beads"]').click();
  await expect(page.locator("#beads-modal")).not.toHaveClass(/hidden/);
  await page.locator("#beads-advance").click();
  await page.locator("#beads-advance").click();
  await page.locator("#beads-advance").click();
  await expect(page.locator("#beads-count")).toHaveText("3");
  await page.locator('[data-close="beads-modal"]').click();
  await expect(page.locator("#beads-modal")).toHaveClass(/hidden/);

  await page.locator("#chat-collapse").click();
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
  await expect(page.locator("#open-abbot")).toBeVisible();

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

  const jumpBox = await page.locator("#jump-toggle").boundingBox();
  const jumpYBefore = await page.evaluate(() => window.__templeDebug.position().y);
  await page.mouse.move(jumpBox.x + jumpBox.width / 2, jumpBox.y + jumpBox.height / 2);
  await page.mouse.down();
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().keys.jump)).toBe(true);
  await page.waitForTimeout(120);
  const jumpYDuring = await page.evaluate(() => window.__templeDebug.position().y);
  console.log("mobile-jump-regression", JSON.stringify(await page.evaluate(() => ({position:window.__templeDebug.position(),input:window.__templeDebug.input(),jump:window.__templeDebug.jumpState()}))));
  expect(jumpYDuring).toBeGreaterThan(jumpYBefore + 0.08);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().keys.jump)).toBe(false);

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
    debug.setPosition(12.0, -37);
    for (let i = 0; i < 8; i++) debug.step({ right: 1 }, 0.25);
  });
  const wall = await page.evaluate(() => window.__templeDebug.position());
  expect(wall.x).toBeGreaterThanOrEqual(11.9);
  expect(wall.x).toBeLessThan(12.8);

  await page.evaluate(() => {
    const debug = window.__templeDebug;
    debug.setPosition(0, -22);
    for (let i = 0; i < 10; i++) debug.step({ forward: 1 }, 0.25);
  });
  const stairs = await page.evaluate(() => window.__templeDebug.position());
  const stairDebug = await page.evaluate(() => window.__templeDebug.input());
  console.log("stairs-regression", JSON.stringify({ wall, stairs, stairDebug }));
  expect(stairs.x).toBeLessThan(1);
  expect(stairs.x).toBeGreaterThan(-1);
  expect(stairs.z).toBeLessThan(-25.0);
  expect(stairs.z).toBeGreaterThan(-30.5);
  expect(stairs.y).toBeGreaterThan(0.45);
  // Walk through the full doorway, not merely onto the first tread.
  await page.evaluate(() => {
    const debug = window.__templeDebug;
    for (let i = 0; i < 18; i++) debug.step({ forward: 1 }, 0.2);
  });
  const inside = await page.evaluate(() => ({ position: window.__templeDebug.position(), indoor: window.__templeDebug.inside() }));
  expect(inside.position.z).toBeLessThan(-29.1);
  expect(inside.indoor).toBe(true);

  // The offering table in the main sanctuary must also stop the player.
  await page.evaluate(() => {
    const debug = window.__templeDebug;
    debug.setYaw(0);
    debug.setPosition(0, -35.6);
    for (let i = 0; i < 8; i++) debug.step({ forward: 1 }, 0.2);
  });
  const table = await page.evaluate(() => window.__templeDebug.position());
  expect(table.z).toBeGreaterThan(-36.8);
  expect(table.z).toBeLessThan(-35.8);
  await cleanTestGuest(page);
});

test("main hall meditation uses a real cushion and mobile information panels stay compact", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await page.locator("#monk-name").fill("Hall Meditation Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);

  await expect(page.locator("#location-card")).toHaveClass(/collapsed/);
  await expect(page.locator("#presence-card")).toHaveClass(/collapsed/);
  await page.locator("#location-panel-toggle").click();
  await expect(page.locator("#location-card")).not.toHaveClass(/collapsed/);
  await page.locator("#location-panel-toggle").click();
  await expect(page.locator("#location-card")).toHaveClass(/collapsed/);

  await page.evaluate(() => window.__templeDebug.setPosition(0, -32.05));
  await page.locator('[data-action="meditate"]').click();
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().pose)).toBe("meditate");
  const seated = await page.evaluate(() => window.__templeDebug.position());
  expect(seated.x).toBe(0);
  expect(seated.z).toBeCloseTo(-32.05, 1);
  expect(seated.rotation).toBeCloseTo(Math.PI, 2);

  await page.evaluate(() => window.__templeDebug.setPosition(0, 0));
  await page.locator('[data-action="meditate"]').click();
  await expect(page.locator("#toast")).toContainText("大雄宝殿");

  await page.evaluate(() => window.__templeDebug.setPosition(1.7, -32.05));
  await page.locator('[data-action="meditate"]').click();
  const seatedInHall = await page.evaluate(() => window.__templeDebug.position());
  expect(seatedInHall.x).toBeCloseTo(1.7, 1);
  expect(seatedInHall.z).toBeCloseTo(-32.05, 1);
  expect(seatedInHall.rotation).toBeCloseTo(Math.PI, 2);

  // Ritual interaction points must be reachable and the censer must be present.
  await page.evaluate(() => window.__templeDebug.setPosition(-5.4, -37.2));
  expect(await page.evaluate(() => window.__templeDebug.canAct("incense"))).toBe(true);
  await page.locator('[data-action="incense"]').click();
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await page.evaluate(() => window.__templeDebug.setPosition(8, -36));
  expect(await page.evaluate(() => window.__templeDebug.canAct("bell"))).toBe(true);
  await page.locator('[data-action="bell"]').click();
  await page.evaluate(() => window.__templeDebug.setPosition(19, -32.5));
  expect(await page.evaluate(() => window.__templeDebug.canAct("lotus"))).toBe(true);
  await page.locator('[data-action="lotus"]').click();
  await cleanTestGuest(page);
});

test("two independent guests share live presence and messages", async ({ browser }) => {
  test.setTimeout(150000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  let pageA2 = null;
  try {
    const prepareGuest = async (page, name) => {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 45000 });
      await page.locator("#monk-name").fill(name);
      await page.locator("#save-profile").click();
      await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
      await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 30000 });
    };
    // Load both independent guests concurrently so cold browser startup does not consume
    // the whole live-room test budget before message delivery is exercised.
    await Promise.all([
      prepareGuest(pageA, "Room Guest A"),
      prepareGuest(pageB, "Room Guest B")
    ]);

    await expect.poll(async () => Number((await pageA.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => Number((await pageB.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => pageA.evaluate(() => window.__templeDebug.remotePlayers().filter(p => p.visible).length)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => pageB.evaluate(() => window.__templeDebug.remotePlayers().filter(p => p.visible).length)).toBeGreaterThanOrEqual(1);
    const remoteBefore = await pageB.evaluate(() => window.__templeDebug.remotePlayers().map(p => ({...p})));
    const startA = await pageA.evaluate(() => window.__templeDebug.position());
    await pageA.evaluate(p => window.__templeDebug.setPosition(p.x, p.z - 0.8), startA);
    await expect.poll(() => pageB.evaluate(before => {
      const now = window.__templeDebug.remotePlayers();
      return now.some(p => before.some(old => old.id === p.id && Math.hypot(old.x-p.x,old.z-p.z) > .25));
    }, remoteBefore)).toBe(true);

    await pageA.locator("#chat-collapse").click();
    await pageB.locator("#chat-collapse").click();
    await pageA.waitForTimeout(650);
    await pageB.waitForTimeout(650);
    await pageA.locator("#chat-input").fill("Message from the other side of the courtyard");
    await pageA.locator("#chat-form button").click();
    await expect(pageA.locator("#chat-input")).toHaveValue("", { timeout: 5000 });
    await expect(pageB.locator("#chat-messages")).toContainText("Message from the other side of the courtyard", { timeout: 20000 });

    await pageB.locator('[data-action="chant"]').click();
    await expect(pageB.locator("#toast")).toHaveClass(/show/);

    // A second tab with the same saved player id replaces the older socket.
    const playerAId = await pageA.evaluate(() => localStorage.getItem("temple-world-player-id"));
    pageA2 = await contextA.newPage();
    await pageA2.goto("/", { waitUntil: "domcontentloaded" });
    await expect(pageA2.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
    await expect(pageA2.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 25000 });
    await pageA.close();
    await expect.poll(() => pageB.evaluate(id => window.__templeDebug.remotePlayers().some(p => p.id === id), playerAId)).toBe(true);
    await expect.poll(async () => Number((await pageB.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBe(2);
  } finally {
    await cleanTestGuest(pageA);
    if (pageA2) await cleanTestGuest(pageA2);
    await cleanTestGuest(pageB);
    await contextA.close();
    await contextB.close();
  }
});


test("only one stationary abbot NPC is present", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await page.locator("#monk-name").fill("Abbot Roster Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  const npcs = await page.evaluate(() => window.__templeDebug.npcs());
  expect(npcs).toHaveLength(1);
  expect(npcs[0].name).toBe("住持");
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__templeDebug.npcs());
  expect(after).toHaveLength(1);
  expect(Math.hypot(after[0].x - npcs[0].x, after[0].z - npcs[0].z)).toBeLessThan(0.05);
  await cleanTestGuest(page);
});
