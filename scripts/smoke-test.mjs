import fs from "node:fs";
import assert from "node:assert/strict";
import { createTempleCollision, collidesAt, groundHeightAt, moveWithCollision, findWalkPath } from "../src/physics.js";
import templeWorker from "../worker/index.js";

const read = path => fs.readFileSync(path, "utf8");
const html = read("index.html");
const app = read("src/app.js");
const world = read("src/world.js");
const network = read("src/network.js");
const style = read("style.css");
const i18n = read("src/i18n.js");
const worker = read("worker/index.js");
const headers = read("_headers");
const pagesWorker = read("scripts/pages-worker.js");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idSet = new Set(ids);
assert.equal(ids.length, idSet.size, "HTML contains duplicate IDs");
const used = [...app.matchAll(/\$\("([^"]+)"\)/g)].map(match => match[1]);
const missing = [...new Set(used)].filter(id => !idSet.has(id));
assert.deepEqual(missing, [], "App references missing HTML elements");
for (const asset of ["/style.css", "/manifest.webmanifest", "/src/app.js", "/icons/lotus.svg"]) {
  assert.ok(html.includes(asset), "index.html must load " + asset);
}
for (const language of ["zh:", "en:", "ja:", "ko:", "th:"]) assert.ok(i18n.includes(language), "Missing locale " + language);
assert.ok(app.includes("async function saveProfile()"), "Profile creation handler must be async");
assert.ok(app.includes("network.visit()"), "Daily visit tracking must be called");
assert.ok(network.includes("/api/live"), "Realtime websocket route missing");
assert.ok(network.includes("async askAbbot") && app.includes('$("open-abbot").addEventListener') && html.includes('id="abbot-modal"'), "AI abbot must be wired from UI through the protected API");
assert.ok(worker.includes("profoundly cultivated elder Buddhist monk") && worker.includes("NOT a tour guide"), "Abbot must speak as a wise elder, not a tourist guide");
for (const locale of ["zh", "ja", "ko", "th"]) {
  const start = i18n.indexOf("  " + locale + ":");
  const end = i18n.indexOf("\n  },", start);
  assert.ok(start >= 0 && i18n.slice(start, end < 0 ? i18n.length : end).includes("abbotTitle:"), "AI abbot locale missing: " + locale);
}
assert.ok(network.includes('this.room = "great-hall"') && network.includes('this.region = "auto"'), "Every client must join the shared Great Hall room");
assert.ok(worker.includes('idFromName("temple:great-hall:shared")'), "All visitors must route to one shared Durable Object");
let routedRoom = "", routedOptions = null;
const fakeEnv = { TEMPLE_ROOMS: { idFromName: name => (routedRoom = name), get: (id, options) => { routedOptions = options; return { fetch: async () => new Response("ok") }; } } };
await templeWorker.fetch(new Request("https://api.example/api/live?room=other&instance=88&region=wnam", { headers: { Upgrade: "websocket" } }), fakeEnv);
assert.equal(routedRoom, "temple:great-hall:shared", "URL parameters must not split visitors into separate rooms");
assert.equal(routedOptions, undefined, "The shared room must not be region-sharded");

assert.ok(network.includes("/api/session"), "Visitor session route missing");
assert.ok(world.includes("export class TempleWorld"), "3D world class missing");
assert.ok(world.includes("buildNpcs()") && world.includes("updateNpcs(dt,time)"), "Autonomous temple NPCs missing");
assert.ok(world.includes("root.userData.animateInteraction") && world.includes("shopper:true") && world.includes("customers:0") && world.includes("customers:1") && !world.includes("customers:2") && world.includes("roadWalker:true") && world.includes("road-pilgrim-a") && !world.includes("market-walker-a"), "Reduced customer and pilgrim population must remain active");
assert.ok(world.includes("zh:{noodles:") && world.includes("en:{noodles:") && world.includes('mcdonalds:"McDonald\'s · Burgers"') && html.includes('<option value="en">English</option>'), "All market signs and the language selector must support English");
assert.ok(world.includes("findWalkPath(this.local.root.position") && world.includes("destinations={incense:[0,-26],bell:[8,-38],lotus:[19,-26.7],tea:[2,-55.8]") && i18n.includes('tea:"喝茶"') && i18n.includes('tea:"Drink tea"'), "Lotus, incense, bell and tea actions must auto-route using live collision geometry");
assert.ok(world.includes("function marketStall") && world.includes("marketVendor") && world.includes("x:43,z:23") && world.includes("素食点心 · 时令水果") && world.includes("算命先生") && world.includes("文创摊主") && world.includes("麦当劳店员") && world.includes('kind:"fortune"') && world.includes('kind:"souvenir"') && world.includes('kind:"mcdonalds"') && world.includes("this.marketStalls.push(stall)"), "The far market and three new roadside vendors must have readable products");
assert.ok(world.includes("const shrine=new THREE.Group()") && world.includes("shrine.position.set(-22.5,0,-32)") && !world.includes("shrineRoofGroup") && !world.includes("shrineStone,shrine,[-2.8,1.65,0]") && world.includes("Open-air altar") && world.includes("const washroom=new THREE.Group()") && world.includes("washroom.position.set(10.6,0,-66.5)") && world.includes("this.squatToilets=[]") && world.includes("new THREE.BoxGeometry(.96,.13,1.34)"), "Old washroom site must become a shrine and toilets must move beside the tea house");
assert.ok(read("src/physics.js").includes("circle(-22.5,-33.35,.82)") && read("src/physics.js").includes("circle(9.12,-67.08,.48)") && read("src/physics.js").includes("circle(12.08,-67.08,.48)") && read("src/physics.js").includes("circle(-10,8,1.28)") && read("src/physics.js").includes("circle(10,19,1.28)") && read("src/physics.js").includes("circle(-10,30,1.28)") && read("src/physics.js").includes("circle(x,z,1.78)") && read("src/physics.js").includes("const wx=10.6,wz=-66.5"), "Shrine, relocated toilet, roadside shop, parked-car and washroom collision geometry missing");
assert.ok(world.includes('function avatar(scene,profile={},id="local",isLocal=false,showName=true)') && world.includes("const namePlate=showName?robeNamePlate") && world.includes("this.abbotAvatar") && world.includes('abbotNames={zh:"住持",en:"Abbot",ja:"住職",ko:"주지 스님",th:"เจ้าอาวาส"}') && world.includes("[Math.PI/2,0,0]"), "Human avatars need visible names, pilgrims must hide names, abbot labels must localize, and censer rings must lie flat");
assert.ok(i18n.includes('profile:"个性化"') && i18n.includes('profile:"Customize"') && html.indexOf('id="language"') < html.indexOf('id="open-profile"'), "Character customization must remain in the top bar beside language");
assert.ok(network.includes("hasJoinedRoom") && network.includes('resume: this.hasJoinedRoom ? "1" : "0"') && worker.includes('url.searchParams.get("resume") !== "1"') && worker.includes('rotation: Number.isFinite(Number(url.searchParams.get("rotation")))') && worker.includes("initialZ=queryZ!==null&&Number.isFinite(Number(queryZ))?Number(queryZ):18") && worker.includes("Math.max(-78, Math.min(78, initialZ))"), "Live reconnect must preserve the last position and must not treat a valid z=0 coordinate as missing");
assert.ok(world.includes('name:"住持"') && world.includes('"npc-abbot"') && world.includes('x:0,z:-8') && world.includes('const route=[[0,-8],[-8,-8],[-13,-12],[-13,-18]') && world.includes("npcCollisionWorld(a)"), "The abbot must patrol the courtyard without entering the censer");
assert.equal((world.match(/name:"住持"/g)||[]).length, 1, "There must be exactly one NPC: the abbot");
assert.ok(app.includes("templeBirds") && app.includes("playFootstep") && app.includes("playMuyu") && app.includes("if(action===\"chant\"&&world.isNight)return;") && app.includes("updateSoundscape();"), "Layered temple ambience and ritual sounds missing");
assert.ok(html.includes('id="beads-modal"') && html.includes('data-action="beads"'), "108-bead practice UI missing");
assert.ok(app.includes("function advanceBead()") && app.includes('localStorage.setItem("temple-beads-total"'), "108-bead practice must persist locally");
assert.ok(!html.includes('id="sound-modal"') && !html.includes('id="sound-settings"'), "Sound adjustment panel must be removed");
assert.ok(html.includes('id="sound-toggle"'), "Simple sound toggle must remain");
assert.ok(app.includes("function updateAudioStatus()") && app.includes("function mediaPlay(media,label)"), "Sound engine diagnostics must remain available");
assert.ok(world.includes("setClickDestination(clientX,clientY)") && world.includes("this.moveTarget=new THREE.Vector3"), "Collision-safe click-to-walk navigation missing");
assert.ok(world.includes("collidesAt(hit.x,hit.z,this.collision)"), "Click-to-walk must reject destinations inside collision geometry");
assert.ok(app.includes("Birds_chirping_in_a_garden.ogg") && app.includes("Dingjue_Om_mani_padme_hum.ogg") && app.includes("Gong55.ogg"), "Recorded courtyard birds, temple chant and gong must be wired into the audio system");
assert.ok(headers.includes("media-src") && headers.includes("https://upload.wikimedia.org"), "CSP must allow the Wikimedia audio recordings");
assert.ok(app.includes("__templeAudioDebug") && app.includes("Promise.race([resumePromise"), "Audio playback diagnostics and awaited AudioContext resume are required");
assert.ok(read("index.html").includes("id=\"profile-sound-toggle\"") && app.includes('$("profile-sound-toggle").addEventListener'), "First-visit profile dialog must provide a working sound control");
assert.ok(app.includes("mediaPlay(templeBirds") && app.includes("audio.resume()"), "Audio must start from the explicit user gesture and report media errors");
assert.ok(app.includes("soundPreference=true") && app.includes("temple-sound-enabled") && app.includes("armDefaultSoundGesture()") && app.includes("touchAudioGate"), "Temple ambience must default on while respecting mobile gesture restrictions");
assert.ok(i18n.includes('soundOn:"关闭声音"'), "The top sound control must offer turn-off as the enabled-state action");
assert.ok(app.includes("Dingjue_Om_mani_padme_hum.ogg") && app.includes("Gong55.ogg"), "Real temple chant and gong recordings missing");
assert.ok(world.includes("moveWithCollision") && world.includes("createTempleCollision"), "World collision integration missing");
assert.ok(world.includes("actorCollisionWorld") && world.includes("isInsideHall") && world.includes("cameraDistance=inside?"), "Player collision and indoor camera modes must be active");
assert.ok(world.includes("const robeProfile=") && world.includes("const hand=new THREE.Group()") && world.includes("const chin="), "Monk avatar must have shaped shoulders, hands and facial anatomy");
assert.ok(world.includes("const total=180") && world.includes("const occupied="), "New visitors must receive non-overlapping Great Hall entrance spawn positions");
assert.ok(world.includes("a.update(dt,time,remoteMoving&&a.pose===\"walk\")") && world.includes("a.root.rotation.y=currentYaw+turn"), "Remote visitors must turn and animate while walking");
assert.ok(world.includes("slice(0,this.mobile?12:28)") && world.includes("a.root.visible=visibleVisitors.has(a.id)"), "Multiplayer avatars must use distance-ranked visual LOD without reducing online capacity");
assert.ok(world.includes("const robeProfile=") && world.includes("[1.37,.465,.22]") && world.includes("robeGeometry.scale(1,1,.78)"), "Monk body must have a shaped, tapered and non-cylindrical human torso");
assert.ok(worker.includes("current.length >= 120"), "Each live room must enforce its 120-player capacity");
assert.ok(worker.includes('"/broadcast-prayer"') && worker.includes('type: "prayer:new"') && app.includes('message.type==="prayer:new"'), "New wishes must be broadcast to every connected visitor");
assert.ok(worker.includes('DELETE FROM prayers WHERE id=? AND player_id=?') && worker.includes('type: "prayer:delete"') && network.includes("async deletePrayer(id)") && app.includes("p.player_id===network.playerId"), "Visitors may delete only their own wishes and deletion must sync to everyone");
assert.ok(world.includes("function robeNamePlate(name)") && world.includes("new THREE.Sprite(") && world.includes("sprite.position.set(0,2.88,0)") && world.includes("this.root.add(this.tag)") && !world.includes("this.body.add(this.tag)") && !world.includes("hitLocalNameplate"), "Avatar names must be displayed above heads without a name-click editor");
assert.ok(style.includes("bottom:112px") && style.includes(".prayer-delete") && !style.includes(".chat-panel{max-height:210px;bottom:10px}"), "Desktop chat panel must be raised and wishes must have delete controls");
assert.ok(worker.includes('type: "presence", players: peers') && app.includes('message.type==="presence"'), "WebSocket heartbeats must reconcile active visitors");
assert.ok(worker.includes('prayers: prayerRows.results || []') && app.includes("syncPrayerBoard(message.prayers||[])") && world.includes("setWishWallPrayers(prayers=[])") && world.includes("wishesSurface") && world.includes("wishWallTexture.needsUpdate"), "Physical wish wall must show saved wishes to new and current visitors");
assert.ok(app.includes("world.setWishWallPrayers(sharedPrayers);") && app.includes("renderPrayers(sharedPrayers);"), "The prayer list and physical wish wall must refresh for every visitor even when the modal is closed");
assert.ok(app.includes("network.connect({...profile,language},world.getPosition())"), "First-time visitors must join before saving a profile");
assert.ok(app.includes('$("abbot-send").addEventListener("click"') && html.includes('id="abbot-send" type="button"') && app.includes("--temple-visual-height"), "Mobile abbot sending must remain clickable above the software keyboard");
assert.ok(worker.includes("messageLength > 20") && html.includes('id="prayer-input" maxlength="20"') && worker.includes("< 8000"), "Wish wall must enforce 20 characters and avoid an excessively long cooldown");
assert.ok(world.includes('fillText("福",256,258)') && !world.includes('fillText("许愿墙"') && world.includes("wishWall.position.set(-31,0,-13.5)") && app.includes("Math.abs(p.x+31)<3.7"), "The wish wall must show only one centered 福 character");
assert.ok(worker.includes("const spawnCandidates = []") && worker.includes("self: player") && app.includes("world.setDebugPosition(message.self.x,message.self.z)"), "Multiplayer joins must receive a server-authoritative, non-overlapping spawn position");
assert.ok(world.includes("cornerLift") && world.includes("IcosahedronGeometry(1.55"), "Curved Chinese roof eaves and varied Bodhi canopy missing");
assert.ok(world.includes("npcCollisionWorld(a)") && world.includes("const route=[[0,-8]") && world.includes("routine:[\"greet\",\"bow\",\"sweep\",\"meditate\"]") && world.includes("this.npcs=[{avatar:a,route"), "The resident abbot must patrol the courtyard without chanting at night");
assert.ok(worker.includes("Replaced by a newer session") && worker.includes("peer.id !== player.id") && worker.includes("samePlayerStillConnected"), "Reconnects must not duplicate or prematurely remove the same visitor");
assert.ok(network.includes("event.code === 4001") && network.includes("this.closedByUser = true"), "Replaced duplicate tabs must not reconnect endlessly");
assert.ok(world.includes("setDebugPosition(x,z)") && app.includes("setPosition:(x,z)=>world.setDebugPosition(x,z)") && app.includes("setYaw:yaw=>world.setDebugYaw(yaw)") && app.includes("step:(input,dt=.05)=>world.update(dt,input,performance.now(),false)"), "Collision regression test hooks missing");
assert.ok(world.includes("this.incensePosition=new THREE.Vector3(0,0,-22.4)") && world.includes("p.x-this.incensePosition.x"), "Incense offering must be centered in the forecourt outside the Great Hall");
assert.ok(worker.includes("!near(0, -22.4, 5.5)"), "Worker incense validation must match the central forecourt censer");
assert.ok(world.includes('if(a==="lotus")return Math.hypot(p.x-this.pondPosition.x,p.z-this.pondPosition.z)<=6.2;') && worker.includes("!near(19, -32.5, 6.2)"), "Lotus placement must use the actual pond center and 13m radius in client and server");
assert.ok(world.includes('if(type==="lotus")return;') && !world.includes("hullShape") && app.includes("function playLotusWater()") && app.includes('if(action==="lotus"){') && app.includes('message.player.action!=="lotus"'), "Lotus offering must be lightweight, local-only, and silent on other visitors devices");
assert.ok(world.includes("const lampPositions=[") && world.includes("entry.base*(.14+night*3.6)") && world.includes("this.nightLights.push({light:fixture.light,base:.52})"), "Exterior road and temple lights must brighten after dusk");
assert.ok(world.includes("HALL_CUSHION_OFFSETS") && world.includes("this.meditationCushions=MEDITATION_CUSHIONS"), "The Great Hall must have many meditation cushions");
assert.ok(world.includes("updateDayNight(time)") && world.includes("periodSeconds:600") && world.includes("this.starMaterial.opacity=night*.86") && world.includes("this.moonMesh.material.opacity=night*.92"), "A shared dusk and night cycle must change sky, stars, moon and lights");
assert.ok(network.includes("!this.welcomed") && network.includes("id: queued.id") && app.includes("messageId&&box.querySelector") && worker.includes("validId(data.id)?data.id"), "Cloud letters must queue until welcome and deduplicate server echoes");
assert.ok(app.includes('remove.textContent="撤回心愿"') && worker.includes("DELETE FROM prayers WHERE id=? AND player_id=?") && worker.includes('type: "prayer:delete"'), "Visitors may withdraw only their own wishes and synchronize deletion");
assert.ok(world.includes("this.courtyardCenser.position.copy(this.courtyardIncensePosition)") && world.includes("this.incensePosition=new THREE.Vector3(0,0,-22.4)") && worker.includes("!near(0, -22.4, 5.5)"), "The Great Hall censer must be visible and reachable at the central forecourt position");
assert.ok(network.includes("type: \"ping\"") && worker.includes("data.type === \"ping\""), "Shared-room websocket heartbeats must be enabled");
assert.ok(worker.includes("env.AI.run") && worker.includes("@cf/zai-org/glm-4.7-flash") && worker.includes("env.AI?.run"), "AI abbot must have a Workers AI fallback when no MiniMax secret is configured");
assert.ok(world.includes("position.z<h.z+h.d/2-.55"), "Indoor mode must begin just beyond the main threshold");
assert.ok(world.includes('this.halls=[{x:0,z:-37,w:26,d:17,h:7.1'), "The world must contain one Great Hall rather than multiple separate halls");
assert.ok(!html.includes('id="jump-toggle"') && !html.includes('id="run-toggle"') && app.includes("lastCenterTap") && app.includes("now-lastCenterTap<=360") && app.includes("world.requestJump()"), "Mobile movement must use joystick double-tap center to jump without run/jump buttons");
assert.ok(app.includes("function playRitualSound(action,volume=1)") && app.includes("function playBeadTick()"), "Ritual actions must trigger audible effects");
assert.ok(network.includes("window.location.origin") && network.includes("localhost"), "Production API and WebSocket must use the Pages origin");
assert.ok(pagesWorker.includes("new Request(upstreamUrl, request)") && pagesWorker.includes("return env.ASSETS.fetch(request)"), "Pages worker must proxy API requests and serve static assets");
assert.ok(read("scripts/build-pages.mjs").includes("path.join(output, \"_worker.js\")"), "Build must publish the Pages advanced-mode worker");
const templeWalkway = createTempleCollision([{x:0,z:-37,w:26,d:17}]);
for (const [x,z] of [[-4.8,31],[4.8,31],[8,0],[31,33],[7,-32.5]]) {
  assert.equal(collidesAt(x,z,templeWalkway),false,"Legacy invisible collider must not block the walkable map at "+x+","+z);
}
for (const x of [-6.2,-2.1,2.1,6.2]) assert.equal(collidesAt(x,-14.55,templeWalkway),false,"Removed guardian must not leave an invisible west-route collider");
assert.equal(collidesAt(5.8,-19.5,templeWalkway),false,"The old side-censer position must remain clear after the censer moves to the center");
let gateWest={x:0,z:-14.55,y:0};
for(let i=0;i<100;i++)gateWest=moveWithCollision(gateWest,-.16,0,templeWalkway);
assert.ok(gateWest.x < -12,"The former Heavenly Kings Hall corridor must be walkable to the west");
let westRoute={x:-24,z:-26.55,y:0};
for(let i=0;i<45;i++)westRoute=moveWithCollision(westRoute,-.16,0,templeWalkway);
assert.ok(westRoute.x < -29.5, "The west courtyard route must not be blocked by invisible meditation-room furniture");
for (const z of [-17,-10.5,2]) {
  let p={x:-10,z,y:0};
  for(let i=0;i<140;i++)p=moveWithCollision(p,-0.16,0,templeWalkway);
  assert.ok(p.x < -30.0, "The west-side path from the main gate must stay passable at z="+z);
  assert.ok(collidesAt(-30.5,z,templeWalkway), "The west boundary wall must still block crossing");
}
const testHalls = [{ x: 0, z: 0, w: 10, d: 10 }];
const realTempleCollision = createTempleCollision([{x:0,z:-37,w:26,d:17}]);
for (const [x,z] of [[0,-26],[8,-38],[19,-26.7],[2,-55.8],[0,-32.05]]) {
  assert.equal(collidesAt(x,z,realTempleCollision),false,"An automatic activity destination must be collision-free at "+x+","+z);
}
const autoRoutes=[
  {from:{x:10,z:-18,y:0},to:{x:0,z:-25.4},label:"front courtyard to incense"},
  {from:{x:0,z:-60,y:0},to:{x:19,z:-26.7},label:"tea house to lotus pond"},
  {from:{x:47,z:24,y:0},to:{x:2,z:-55.8},label:"market to tea house"},
  {from:{x:-40,z:0,y:0},to:{x:2,z:-55.8},label:"west of wish wall to tea house"}
];
for(const route of autoRoutes){
  const path=findWalkPath(route.from,route.to,realTempleCollision);
  assert.ok(path?.length,"Collision-aware pathfinding must find "+route.label);
  let position={...route.from};
  for(const target of path){
    let guard=0;
    while(Math.hypot(target.x-position.x,target.z-position.z)>.06 && guard++<1200){
      const dx=target.x-position.x,dz=target.z-position.z,dist=Math.hypot(dx,dz);
      const moved=moveWithCollision(position,dx/dist*Math.min(.045,dist),dz/dist*Math.min(.1,dist),realTempleCollision);
      assert.equal(moved.blocked,false,"The "+route.label+" path must not hit a hidden collider; blocked near "+position.x.toFixed(2)+","+position.z.toFixed(2)+" heading to "+target.x.toFixed(2)+","+target.z.toFixed(2));
      position={x:moved.x,y:moved.y,z:moved.z};
    }
    assert.ok(Math.hypot(target.x-position.x,target.z-position.z)<=.06,"The "+route.label+" path must reach each waypoint");
  }
  assert.ok(Math.hypot(route.to.x-position.x,route.to.z-position.z)<=.16,"The "+route.label+" path must reach its destination");
}
assert.equal(collidesAt(19,-32.5,realTempleCollision),true,"The lotus pond water must block walking through the pond");
const collision = createTempleCollision(testHalls);
assert.equal(collidesAt(4.8, 0, collision), true, "A character must not pass through a side wall");
assert.equal(collidesAt(0, 5.5, collision), false, "The main entrance must remain open");
assert.equal(groundHeightAt(0, 8.72, testHalls), 0.18, "Outer stair tread must have a climbable elevation");
assert.equal(groundHeightAt(0, 7.72, testHalls), 0.36, "Middle stair tread must have a climbable elevation");
assert.equal(groundHeightAt(0, 6.72, testHalls), 0.54, "Inner stair tread must meet the hall floor");
assert.equal(groundHeightAt(0, 6.18, testHalls), 0.54, "Top stair must meet the integrated tiled platform without a drop gap");
assert.equal(groundHeightAt(0, 5.5, testHalls), 0.54, "The hall interior must use the integrated tiled platform height");
assert.equal(groundHeightAt(0, 9.3, testHalls), 0, "The outside approach must remain at ground level");
assert.equal(groundHeightAt(0, 8.0, testHalls), 0.36, "The middle tread must have a clean, non-overlapping height band");
const actorWorld = { ...collision, actors: [{ x: 1, z: 0, radius: 0.5 }] };
const playerMove = moveWithCollision({ x: 0, z: 0, y: 0 }, 0.6, 0, actorWorld);
assert.ok(playerMove.x < 0.06, "Players must not walk through another player body");
const escapeOverlap = moveWithCollision({ x: 0.2, z: 0, y: 0 }, -0.3, 0, actorWorld);
assert.ok(escapeOverlap.x < 0.2, "A player already overlapping another avatar must still be able to move away");
const wallMove = moveWithCollision({ x: 4.4, z: 0, y: 0 }, 0.5, 0, collision);
assert.equal(wallMove.moved, false, "Movement must stop at a wall instead of crossing it");
const fastWallMove = moveWithCollision({ x: 0, z: 0, y: 0 }, 8, 0, collision);
assert.ok(fastWallMove.x < 4.7, "Large frame steps must not tunnel through walls");
const stairMove = moveWithCollision({ x: 0, z: 9, y: 0 }, 0, -0.4, collision);
assert.equal(stairMove.y, 0.18, "Movement must step onto the outer stair tread");
assert.ok(app.includes("movementCodes") && app.includes("document.addEventListener(\"keydown\""), "Physical WASD keyboard handling missing");
assert.ok(world.includes("incenseStick.visible"), "Incense ritual prop missing");
assert.ok(world.includes("this.courtyardIncensePosition") && world.includes("new THREE.Vector3(0,0,-22.4)") && world.includes("this.teaHouse") && world.includes("this.parkingLot") && world.includes("this.parkingSign") && world.includes("gate.position.z=-1.2"), "Central outdoor censer, forest tea pavilion, forest parking or expanded gate missing");
assert.ok(html.includes('id="open-profile"') && html.indexOf('id="language"') < html.indexOf('id="open-profile"') && app.includes('$("open-profile").addEventListener("click",openProfileEditor)') && !app.includes("temple:rename") && !html.includes('id="quick-profile"'), "Character name and appearance settings must be opened from the top bar beside language, not by clicking the name");
assert.ok(world.includes("this.mobile?1.35:1.75") && world.includes("antialias:true") && world.includes("shadowMap.enabled=!mobile"), "Renderer must preserve clear pixel density while keeping mobile shadows disabled");
assert.ok(world.includes("new THREE.InstancedMesh") && world.includes("addInstancedPines(s,m)") && world.includes("addInstancedHills(s,distantHills)"), "Forest trees and distant hills must use instancing to reduce draw calls without reducing geometry detail");
assert.ok(world.includes('toilet:[10,-66.35]') && world.includes('a==="toilet"') && world.includes('name==="toilet"') && html.includes('data-action="toilet"') && app.includes('action==="toilet"') && worker.includes('"toilet"') && i18n.includes('toilet:"如厕"') && i18n.includes('toilet:"Use restroom"'), "Restroom action must navigate to the washroom, animate, synchronize and be translated");
assert.ok(app.includes("chat-floater") && app.includes("setChatPanelOpen") && !app.includes("temple:rename") && !world.includes("temple:rename"), "Chat bubbles must remain while name-tap rename is removed");
assert.ok(app.includes("lastSentNetworkPosition") && app.includes("renderFrame"), "Mobile network/render throttling missing");
assert.ok(!read("src/physics.js").includes("circle(5.8, -19.5, 1.55)") && read("src/physics.js").includes("circle(-4.8, -1.2, .55)"), "The obsolete side censer collider must be removed while the moved gate collision remains");
assert.ok(worker.includes("export class TempleRoom"), "Durable Object class missing");
for (const table of ["profiles", "activities", "prayers", "visits", "offerings"]) {
  assert.ok(worker.includes(table), "Worker missing D1 table reference: " + table);
}
assert.ok(world.includes('broom.visible=this.pose==="sweep"'), "Sweeping broom prop missing");
assert.ok(world.includes('name==="chant"') && world.includes('name==="meditate"'), "Shared chanting and meditation pose profiles missing");
assert.ok(i18n.includes('chant:"共诵"') && i18n.includes('chant:"共に読経"') && i18n.includes('chant:"함께 독경"') && i18n.includes('chant:"สวดมนต์ร่วมกัน"') && i18n.includes('profile:"个性化"') && i18n.includes('profile:"カスタマイズ"') && i18n.includes('profile:"꾸미기"') && i18n.includes('profile:"ปรับแต่ง"') && i18n.includes('profile:"Customize"'), "Actions and top character customization must be translated across five locales");
assert.ok(worker.includes('"chant"'), "Worker must accept the shared chanting action");

console.log("Smoke test passed: " + ids.length + " unique HTML IDs, " + used.length + " static app references, 5 locales, 3D world and API routes.");

assert.ok(app.includes("let prayerSending=false") && app.includes('$("prayer-form").addEventListener("submit",submitPrayer)') && !app.includes('$("prayer-submit").addEventListener("pointerup"') && network.includes('}, 45000);'), "Wish submission must use one native submit event, remain single-flight, and tolerate slow mobile connections");
assert.ok(app.includes('document.addEventListener("touchmove",blockPinch,{passive:false,capture:true})') && !app.includes('$("restore-view")') && !html.includes('id="restore-view"'), "Mobile pinch handling remains and the restore button is removed");
assert.ok(app.includes('$("abbot-send").addEventListener("pointerup"') && app.includes('lastAbbotSubmitAt') && app.includes('$("abbot-form").addEventListener("submit"'), "Mobile abbot send must support touch, keyboard and duplicate-submit protection");
assert.ok(!world.includes("plaqueSprite(") && !world.includes("gatePlaque") && !world.includes("incensePlaque") && !world.includes("lotusPlaque"), "All floating plaques and signboards must be removed to prevent clipping");


assert.ok(network.includes("this.welcomeTimer") && network.includes('message?.type === "welcome"') && network.includes("Shared room did not initialize"), "A WebSocket is online only after the shared room sends its welcome snapshot");
assert.ok(worker.includes("Reconcile every connected client") && worker.includes("target.send(JSON.stringify({ type: \"presence\""), "Heartbeats must reconcile presence for every connected visitor");

assert.ok(read("sw.js").includes("temple-world-shell-83"), "Service worker cache must refresh the current client shell");

assert.ok(!read("index.html").includes('id="restore-view"'), "Mobile restore-view button must be removed");
assert.ok(!read("src/app.js").includes('$("restore-view")'), "No restore-view reload handler should remain");
assert.ok(!read("style.css").includes("#restore-view"), "No restore-view button styles should remain");
assert.ok(read("worker/index.js").includes('u.protocol === "https:" ? origin'), "Anonymous public API must support HTTPS custom domains via CORS");
assert.ok(read("sw.js").includes("temple-world-shell-83"), "Service worker cache must refresh the current fixes");

assert.ok(worker.includes('reasoning_effort: "low"') && worker.includes("max_completion_tokens: Math.max(2048, maxTokens * 4)"), "MiniMax Flash must have enough completion budget for reasoning and visible answer text");

assert.ok(worker.includes('https://api.minimaxi.com/v1') && worker.includes('https://api.minimax.io/v1') && worker.includes('error.status !== 401 && error.status !== 403'), 'MiniMax keys must work across either official region without retrying rate-limited requests');

assert.ok(world.includes("const teaCup=new THREE.Group()") && world.includes('else if(name==="tea")') && world.includes("findWalkPath(this.local.root.position") && world.includes("const destinations={incense:[0,-26],bell:[8,-38],lotus:[19,-26.7],tea:[2,-55.8]") && app.includes('world.setLocalPose("tea")') && world.includes('(action==="tea"||action==="toilet")?6500'), "Tea house must have an obstacle-avoiding auto-route and dedicated tea-drinking animation");
assert.ok(html.includes('<option value="en">English</option>') && i18n.includes("TEXT.en=") && worker.includes('en: "English"'), "English must be supported by the interface and API");
assert.ok(app.includes("const night=!!world.isNight") && app.includes("templeBirds.currentTime=0") && app.includes("templeChant.currentTime=0") && app.includes("Night is a hard mute for birds and chanting"), "Birdsong and chanting must be stopped and blocked after dark");
assert.ok(world.includes('if(a==="chant")return Math.hypot(p.x,p.z+38.5)<12;') && app.includes('["incense","bell","lotus","tea","meditate","chant"]'), "Action shortcuts must guide visitors to the relevant temple locations");
