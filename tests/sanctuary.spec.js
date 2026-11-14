import { test, expect } from "@playwright/test";

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
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
  await expect(page.locator("#world canvas")).toBeVisible();
  await expect(page.locator("#profile-modal")).not.toHaveClass(/hidden/);

  await page.locator("#monk-name").fill("CI Pilgrim");
  await page.locator("#monk-style").selectOption("pilgrim");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await expect(page.locator("#connection-label")).toContainText("已进入共同禅境", { timeout: 25000 });

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
  await expect(page.locator("#action-dock")).toBeVisible();

  await page.locator("#monk-name").fill("Mobile Test");
  await page.locator("#save-profile").click();
  await expect(page.locator("#profile-modal")).toHaveClass(/hidden/);
  await page.locator("#run-toggle").click();
  await expect(page.locator("#run-toggle")).toHaveClass(/active/);
  await page.locator("#run-toggle").click();
  await expect(page.locator("#run-toggle")).not.toHaveClass(/active/);
  await cleanTestGuest(page);
});
