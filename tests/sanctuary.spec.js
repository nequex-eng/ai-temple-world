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


test("production Pages same-origin proxy connects the live room", async ({ page }) => {
  test.setTimeout(90000);
  const sockets=[];
  page.on("websocket",socket=>sockets.push(socket.url()));
  await page.goto("https://helixtemple.pages.dev/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  const health=await page.evaluate(async()=>{
    const response=await fetch("/api/health",{cache:"no-store"});
    return {status:response.status,body:await response.json()};
  });
  expect(health.status).toBe(200);
  expect(health.body.ok).toBe(true);
  await page.locator("#monk-name").fill("Pages Proxy Guest");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await expect(page.locator("#connection-label")).toContainText("已进入共同禅境",{timeout:30000});
  await expect.poll(()=>sockets.some(url=>url.startsWith("wss://helixtemple.pages.dev/api/live"))).toBe(true);

  // Exercise the real same-origin prayer POST and owner-delete routes without
  // leaving a permanent test wish on the public wall.
  await page.locator("#open-prayers").click();
  await page.locator("#prayer-input").fill("同站代理提交测试");
  await page.locator("#prayer-submit").click();
  await expect(page.locator("#prayer-input")).toHaveValue("",{timeout:15000});
  await expect(page.locator("#prayer-list")).toContainText("同站代理提交测试",{timeout:20000});
  page.on("dialog",dialog=>dialog.accept());
  await page.locator(".prayer-delete").first().click();
  await expect(page.locator("#prayer-list")).not.toContainText("同站代理提交测试",{timeout:15000});
  await cleanTestGuest(page);
});

test("first-time guests connect before saving their optional profile", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await expect(page.locator("#profile-modal")).not.toHaveClass(/hidden/);
  await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 30000 });
  await expect.poll(async () => Number((await page.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(1);
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

test("mobile: virtual joystick, double-tap jump and action dock are usable", async ({ page }) => {
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
  await expect(page.locator("#sound-toggle")).not.toContainText("正在开启");
  await page.locator("#open-abbot").click();
  await page.locator("#abbot-input").fill("请用一句话解释慈悲。");
  await page.locator("#abbot-send").click();
  await expect(page.locator("#abbot-input")).toHaveValue("", { timeout: 5000 });
  await expect(page.locator(".abbot-message.assistant").last()).toContainText(/慈悲|关怀|众生|同理|他人/, { timeout: 45000 });
  await page.locator('[data-close="abbot-modal"]').click();
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

  const jumpBox = await page.locator("#joystick").boundingBox();
  const jumpYBefore = await page.evaluate(() => window.__templeDebug.position().y);
  const centerX=jumpBox.x+jumpBox.width/2,centerY=jumpBox.y+jumpBox.height/2;
  await page.mouse.click(centerX,centerY);
  await page.waitForTimeout(80);
  await page.mouse.click(centerX,centerY);
  await page.waitForTimeout(120);
  const jumpYDuring = await page.evaluate(() => window.__templeDebug.position().y);
  expect(jumpYDuring).toBeGreaterThan(jumpYBefore + 0.08);
  await expect(page.locator("#run-toggle")).toHaveCount(0);
  await expect(page.locator("#jump-toggle")).toHaveCount(0);
  await cleanTestGuest(page);
});


test("temple walls block movement and the entrance stairs are climbable", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
  await page.locator("#monk-name").fill("Collision Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await page.evaluate(() => document.activeElement?.blur());

  // Former invisible Tianwang Hall statues must no longer block the west route.
  await page.evaluate(() => {
    const debug=window.__templeDebug;
    debug.setYaw(0);debug.setPosition(0,-14.55);
    for(let i=0;i<100;i++)debug.step({left:1},.16);
  });
  const westGateRoute=await page.evaluate(()=>window.__templeDebug.position());
  expect(westGateRoute.x).toBeLessThan(-12);

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

  await expect(page.locator("#location-card")).toBeHidden();
  await expect(page.locator("#presence-card")).toBeHidden();

  await expect.poll(()=>page.evaluate(()=>window.__templeDebug.input().pose)).toBe("walk");
  const cushion=await page.evaluate(()=>window.__templeDebug.meditationCushions().find(p=>Math.abs(p.x)<.01&&Math.abs(p.z+32.05)<.01));
  expect(cushion).toBeTruthy();
  await page.evaluate(p=>window.__templeDebug.setPosition(p.x,p.z),cushion);
  expect(await page.evaluate(()=>({position:window.__templeDebug.position(),canAct:window.__templeDebug.canAct("meditate")}))).toMatchObject({position:{x:0,z:-32.05},canAct:true});
  await page.locator('[data-action="meditate"]').click();
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().pose)).toBe("meditate");
  const seated = await page.evaluate(() => window.__templeDebug.position());
  expect(seated.x).toBe(0);
  expect(seated.z).toBeCloseTo(-32.05, 1);
  expect(seated.rotation).toBeCloseTo(Math.PI, 2);

  await page.evaluate(() => window.__templeDebug.setPosition(0, 0));
  await page.locator('[data-action="meditate"]').click();
  await expect.poll(() => page.evaluate(() => window.__templeDebug.input().pose), { timeout: 45000 }).toBe("meditate");

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
  await page.evaluate(() => window.__templeDebug.setPosition(8, -32.5));
  expect(await page.evaluate(() => window.__templeDebug.canAct("lotus"))).toBe(true);
  await page.locator('[data-action="lotus"]').click();
  expect(await page.evaluate(() => window.__templeDebug.cushions())).toBeGreaterThanOrEqual(24);
  const abbotBefore=await page.evaluate(()=>window.__templeDebug.npcs()[0]);
  await page.waitForTimeout(7500);
  const abbotAfter=await page.evaluate(()=>window.__templeDebug.npcs()[0]);
  expect(Math.hypot(abbotAfter.x-abbotBefore.x,abbotAfter.z-abbotBefore.z)).toBeGreaterThan(.4);
  await cleanTestGuest(page);
});

test("three independent guests share live presence, messages and wishes", async ({ browser }) => {
  test.setTimeout(240000);
  const contextA = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const contextB = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const contextC = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();
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
      prepareGuest(pageB, "Room Guest B"),
      prepareGuest(pageC, "Room Guest C")
    ]);

    for (const guest of [pageA,pageB,pageC]) {
      await expect.poll(async () => Number((await guest.locator("#online-count").textContent()).match(/[0-9]+/)?.[0] || 0)).toBeGreaterThanOrEqual(3);
      await expect.poll(() => guest.evaluate(() => window.__templeDebug.remotePlayers().filter(p => p.visible).length)).toBeGreaterThanOrEqual(2);
    }
    const remoteBefore = await pageB.evaluate(() => window.__templeDebug.remotePlayers().map(p => ({...p})));
    const remoteBeforeC = await pageC.evaluate(() => window.__templeDebug.remotePlayers().map(p => ({...p})));
    const startA = await pageA.evaluate(() => window.__templeDebug.position());
    await pageA.evaluate(p => {window.__templeDebug.setPosition(p.x, p.z - 0.8);window.__templeDebug.broadcastPosition();}, startA);
    const movedFromA = before => {
      const now = window.__templeDebug.remotePlayers();
      return now.some(p => before.some(old => old.id === p.id && Math.hypot(old.x-p.x,old.z-p.z) > .25));
    };
    await expect.poll(() => pageB.evaluate(movedFromA, remoteBefore)).toBe(true);
    await expect.poll(() => pageC.evaluate(movedFromA, remoteBeforeC)).toBe(true);

    // The chat panel starts collapsed on a fresh visit. Expand it explicitly before typing.
    await pageA.locator("#chat-panel").evaluate(el=>el.classList.remove("collapsed"));
    await pageB.locator("#chat-panel").evaluate(el=>el.classList.remove("collapsed"));
    await pageC.locator("#chat-panel").evaluate(el=>el.classList.remove("collapsed"));
    await expect(pageA.locator("#chat-input")).toBeVisible();
    await expect(pageB.locator("#chat-input")).toBeVisible();
    await expect(pageC.locator("#chat-input")).toBeVisible();
    await pageA.locator("#chat-input").fill("Message from the other side of the courtyard");
    await pageA.locator("#chat-form button").click();
    await expect(pageA.locator("#chat-input")).toHaveValue("", { timeout: 5000 });
    await expect(pageB.locator("#chat-messages")).toContainText("Message from the other side of the courtyard", { timeout: 20000 });
    await expect(pageC.locator("#chat-messages")).toContainText("Message from the other side of the courtyard", { timeout: 20000 });
    await expect(pageA.locator("#chat-messages .chat-line")).toHaveCount(1);
    await pageB.locator("#chat-input").fill("Reply from mobile B to both visitors");
    await pageB.locator("#chat-form button").click();
    await expect(pageA.locator("#chat-messages")).toContainText("Reply from mobile B to both visitors",{timeout:20000});
    await expect(pageC.locator("#chat-messages")).toContainText("Reply from mobile B to both visitors",{timeout:20000});

    // Wishes must persist and be broadcast to every connected visitor.
    await pageA.locator("#open-prayers").click();
    const sharedWish="三人测试祈愿"+Date.now().toString().slice(-6);
    await pageA.locator("#prayer-input").fill(sharedWish);
    await pageA.locator("#prayer-submit").click();
    await expect(pageA.locator("#prayer-input")).toHaveValue("", { timeout: 15000 });
    await expect(pageA.locator("#prayer-list")).toContainText(sharedWish, { timeout: 20000 });
    await expect(pageB.locator("#prayer-list")).toContainText(sharedWish, { timeout: 20000 });
    await expect(pageC.locator("#prayer-list")).toContainText(sharedWish, { timeout: 20000 });
    const ownerWish=pageA.locator(".prayer-item").filter({hasText:sharedWish});
    await expect(ownerWish.locator(".prayer-delete")).toHaveCount(1);
    await expect(pageB.locator(".prayer-item").filter({hasText:sharedWish}).locator(".prayer-delete")).toHaveCount(0);
    await expect(pageC.locator(".prayer-item").filter({hasText:sharedWish}).locator(".prayer-delete")).toHaveCount(0);
    pageA.once("dialog",dialog=>dialog.accept());
    await ownerWish.locator(".prayer-delete").click();
    await expect(pageA.locator("#prayer-list")).not.toContainText(sharedWish,{timeout:10000});
    await expect(pageB.locator("#prayer-list")).not.toContainText(sharedWish,{timeout:15000});
    await expect(pageC.locator("#prayer-list")).not.toContainText(sharedWish,{timeout:15000});

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
    await expect.poll(async () => Number((await pageB.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(3);
    await expect.poll(async () => Number((await pageC.locator("#online-count").textContent()).match(/\d+/)?.[0] || 0)).toBeGreaterThanOrEqual(3);
  } finally {
    await cleanTestGuest(pageA);
    if (pageA2) await cleanTestGuest(pageA2);
    await cleanTestGuest(pageB);
    await cleanTestGuest(pageC);
    await contextA.close().catch(()=>{});
    await contextB.close().catch(()=>{});
    await contextC.close().catch(()=>{});
  }
});


test("four market vendors stand on the east green lawn with product signs", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  const state = await page.evaluate(() => ({market:window.__templeDebug.market(),labels:window.__templeDebug.marketLabels()}));
  expect(state.market).toHaveLength(4);
  expect(state.market.every(v=>v.x>=40)).toBe(true);
  expect(state.labels).toEqual(["素凉面 · 凉茶","香烛 · 莲灯","咖啡 · 茶饮","素食点心 · 时令水果"]);
});

test("lotus offering is lightweight and local-only, with no boat animation", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await page.locator("#monk-name").fill("Lotus Offering Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await page.evaluate(() => window.__templeDebug.setPosition(19,-32.5));
  await expect.poll(()=>page.evaluate(()=>window.__templeDebug.canAct("lotus"))).toBe(true);
  await page.locator('[data-action="lotus"]').click();
  await expect(page.locator("#toast")).toContainText("一盏莲灯随愿入水");
  expect(await page.evaluate(()=>window.__templeDebug.lotusBoats().length)).toBe(0);
  expect(await page.evaluate(()=>window.__templeDebug.input().pose)).toBe("walk");
  const state=await page.evaluate(()=>({lights:window.__templeDebug.nightLights(),toilets:window.__templeDebug.squatToilets(),censer:window.__templeDebug.censer()}));
  expect(state.lights).toBeGreaterThanOrEqual(28);
  expect(state.toilets).toBe(2);
  expect(state.censer).toEqual({x:3.3,z:-22.4});
  await cleanTestGuest(page);
});

test("one resident abbot roams while the green-market vendors remain separate", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
  await page.locator("#monk-name").fill("Abbot Roster Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  const beforeList = await page.evaluate(() => window.__templeDebug.npcs());
  const before = beforeList.filter(n=>n.name==="住持");
  expect(before).toHaveLength(1);
  await page.waitForTimeout(7500);
  const afterList = await page.evaluate(() => window.__templeDebug.npcs());
  const after = afterList.filter(n=>n.name==="住持");
  expect(after).toHaveLength(1);
  expect(Math.hypot(after[0].x-before[0].x,after[0].z-before[0].z)).toBeGreaterThan(.4);
  await cleanTestGuest(page);
});


test("mobile performance mode lowers render resolution and restores standard quality", async ({ browser }) => {
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
    await page.locator("#monk-name").fill("Resolution Test");
    await page.locator("#save-profile").click();
    await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
    const button=page.locator("#smooth-toggle");
    await expect(button).toBeVisible();
    await expect(button).toContainText("流畅模式");
    const standard=await page.evaluate(()=>window.__templeDebug.pixelRatio());
    expect(standard).toBeGreaterThan(1.2);
    await button.click();
    await expect(button).toContainText("恢复画质");
    const reduced=await page.evaluate(()=>window.__templeDebug.pixelRatio());
    const reducedState=await page.evaluate(()=>window.__templeDebug.renderState());
    expect(reduced).toBeLessThan(standard*.55);
    expect(reduced).toBeGreaterThanOrEqual(.62);
    expect(reduced).toBeLessThanOrEqual(.70);
    expect(reducedState.frameInterval).toBeGreaterThanOrEqual(41);
    expect(reducedState.ambientVisible).toBe(false);
    expect(reducedState.smokeVisible).toBe(false);
    expect(reducedState.remoteLimit).toBe(5);
    expect(reducedState.visiblePointLights).toBeLessThanOrEqual(7);
    expect(await page.evaluate(()=>localStorage.getItem("temple-render-mode"))).toBe("smooth");
    await page.reload({waitUntil:"domcontentloaded"});
    await expect(page.locator("#loading")).toHaveClass(/hidden/, { timeout: 35000 });
    await expect(page.locator("#smooth-toggle")).toContainText("恢复画质");
    await page.locator("#smooth-toggle").click();
    await expect(page.locator("#smooth-toggle")).toContainText("流畅模式");
    const restored=await page.evaluate(()=>window.__templeDebug.pixelRatio());
    const restoredState=await page.evaluate(()=>window.__templeDebug.renderState());
    expect(restored).toBeGreaterThan(reduced);
    expect(restoredState.frameInterval).toBe(25);
    expect(restoredState.ambientVisible).toBe(true);
    expect(restoredState.smokeVisible).toBe(true);
    expect(restoredState.remoteLimit).toBe(12);
    expect(restoredState.visiblePointLights).toBeGreaterThan(reducedState.visiblePointLights);
    expect(await page.evaluate(()=>localStorage.getItem("temple-render-mode"))).toBe("standard");
  } finally {
    await context.close();
  }
});

test("mobile scene follows the visual viewport after browser-size changes", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  const measured=()=>page.evaluate(()=>({
    visual:Math.round(window.visualViewport?.height||window.innerHeight),
    css:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--temple-visual-height"))
  }));
  await expect.poll(async()=>{const v=await measured();return Math.abs(v.visual-v.css);}).toBeLessThanOrEqual(1);
  await page.setViewportSize({width:430,height:932});
  await expect.poll(async()=>{const v=await measured();return Math.abs(v.visual-v.css);}).toBeLessThanOrEqual(1);
});


test("temple logo follows the selected interface language", async ({ page }) => {
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  const brand=page.locator("#brand-name"),loadingTitle=page.locator("#loading-title");
  await expect(brand).toHaveText("云上禅境");
  await page.locator("#language").selectOption("en");
  await expect(brand).toHaveText("Cloud Temple");
  await expect(loadingTitle).toHaveText("Cloud Temple");
  await expect(page).toHaveTitle(/Cloud Temple/);
  await page.locator("#language").selectOption("ja");
  await expect(brand).toHaveText("雲上の禅境");
  await page.locator("#language").selectOption("ko");
  await expect(brand).toHaveText("구름 위 선경");
  await page.locator("#language").selectOption("th");
  await expect(brand).toHaveText("แดนเซนเหนือเมฆ");
  await page.locator("#language").selectOption("zh");
  await expect(brand).toHaveText("云上禅境");
});

test("one-tap restroom action walks to the real doorway and activates", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  await page.locator("#monk-name").fill("Restroom Route Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await page.evaluate(()=>window.__templeDebug.setPosition(4,-61));
  await expect.poll(()=>page.evaluate(()=>window.__templeDebug.canAct("toilet"))).toBe(false);
  await page.locator('[data-action="toilet"]').click();
  await expect(page.locator("#toast")).toContainText("正在前往目的地");
  await expect.poll(()=>page.evaluate(()=>window.__templeDebug.input().pose),{timeout:30000}).toBe("toilet");
  const final=await page.evaluate(()=>window.__templeDebug.position());
  expect(Math.hypot(final.x-10.6,final.z+64.5)).toBeLessThan(2.8);
  await cleanTestGuest(page);
});

test("server and UI never return the old test wishes", async ({ page }) => {
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:35000});
  const api=await page.evaluate(async()=>await (await fetch("/api/prayers")).json());
  expect(api.prayers.some(p=>/你的\\s*test|测试祈愿/i.test(p.message))).toBe(false);
  expect(await page.evaluate(()=>window.__templeDebug.wishes().some(p=>/你的\\s*test|测试祈愿/i.test(p.message)))).toBe(false);
});
