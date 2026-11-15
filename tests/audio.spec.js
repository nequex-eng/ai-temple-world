import { test, expect } from "@playwright/test";

test("new visitors can start temple ambience before creating a monk", async ({ page }) => {
  const pageErrors=[],consoleErrors=[],failedRequests=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  page.on("console",msg=>{if(msg.type()==="error")consoleErrors.push(msg.text());});
  page.on("requestfailed",request=>failedRequests.push({url:request.url(),failure:request.failure()?.errorText||"unknown"}));
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://127.0.0.1:4173/",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>location.host)).toBe("127.0.0.1:4173");
  try{await expect(page.locator("#loading")).toHaveClass(/hidden/,{timeout:10000});}
  catch(error){console.error("STARTUP_DIAGNOSTICS",JSON.stringify({pageErrors,consoleErrors,failedRequests,threeModule:await page.evaluate(async()=>{try{const r=await fetch("/src/vendor/three.module.js");return {status:r.status,size:Number(r.headers.get("content-length")||0)};}catch(e){return {error:String(e)};}})}));throw error;}
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
  // The compact global toggle must mute playback and stay synchronized with first-visit controls.
  await page.locator("#sound-toggle").click();
  await expect(page.locator("#profile-sound-toggle")).toHaveAttribute("aria-pressed","false");
  await expect(page.locator("#sound-toggle")).toHaveAttribute("aria-pressed","false");
  await expect.poll(()=>page.evaluate(()=>window.__templeAudioDebug.media().birds.paused)).toBe(true);
  expect(pageErrors).toEqual([]);
});
