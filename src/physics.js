// Lightweight deterministic capsule collision for the temple's walkable ground plane.
const PLAYER_RADIUS = 0.42;
const MAX_STEP = 0.191;

const segment = (ax, az, bx, bz, radius = 0.12) => ({ ax, az, bx, bz, radius });
const circle = (x, z, radius) => ({ x, z, radius });

export function createTempleCollision(halls) {
  const segments = [];
  const circles = [
    // Only retain colliders that correspond to visible solid scene objects.
    circle(0, -39.5, 2.2), circle(0, -27.2, 1.58),
    circle(-4.8, -1.2, .55), circle(4.8, -1.2, .55), circle(5.8, -19.5, 1.55),
    circle(-56.85, 8.45, .28), circle(-47.15, 8.45, .28),
    circle(-56.85, 15.55, .28), circle(-47.15, 15.55, .28), circle(-52, 11.65, .78),
    circle(-4.85,-65.55,.34),circle(4.85,-65.55,.34),circle(-4.85,-58.45,.34),circle(4.85,-58.45,.34),
    circle(-2.5,-62.35,.88),circle(2.5,-62.35,.88),circle(0,-56.5,.48),
    circle(-10.92, -38.1, .42), circle(10.92, -38.1, .42)
  ];
  for (const h of halls) {
    const l = h.x - h.w / 2, r = h.x + h.w / 2;
    const b = h.z - h.d / 2, f = h.z + h.d / 2;
    // Rear and side masonry walls.
    segments.push(segment(l, b, r, b, 0.25));
    segments.push(segment(l, b, l, f, 0.25));
    segments.push(segment(r, b, r, f, 0.25));
    // The front is a real opening, not a rectangular invisible wall.
    const doorHalf = h.w * 0.36;
    segments.push(segment(l, f, h.x - doorHalf, f, 0.22));
    segments.push(segment(h.x + doorHalf, f, r, f, 0.22));
    // Front columns and the two columns flanking the side walls.
    const n = Math.max(4, Math.round(h.w / 3));
    for (let i = 0; i < n; i++) {
      const px = -h.w / 2 + (i + 0.5) * h.w / n;
      if (Math.abs(px) < h.w * 0.36) continue;
      circles.push(circle(h.x + px, f - 0.35, 0.31));
    }
    for (const side of [-1, 1]) {
      circles.push(circle(h.x + side * (h.w / 2 - 0.35), f - 0.4, 0.31));
    }
  }
  // The main hall offering table is a solid piece of furniture, not a walk-through prop.
  const tableZ = -38.5 + 1.12;
  segments.push(segment(-1.55, tableZ - 0.46, 1.55, tableZ - 0.46, 0.12));
  segments.push(segment(-1.55, tableZ + 0.46, 1.55, tableZ + 0.46, 0.12));
  segments.push(segment(-1.55, tableZ - 0.46, -1.55, tableZ + 0.46, 0.12));
  segments.push(segment(1.55, tableZ - 0.46, 1.55, tableZ + 0.46, 0.12));
  // Four market stalls and two squat pans are solid, walk-around scene objects.
  for(const z of [-1,7,15,23])circles.push(circle(43,z,1.28));
  circles.push(circle(-20.48,-32.58,.48),circle(-17.52,-32.58,.48));
  // Unlabelled washroom west of the Great Hall: closed rear/sides and an open central entrance.
  const wx=-19,wz=-32,halfW=2.8,back=wz-2.38,front=wz+2.38,doorHalf=.94;
  segments.push(segment(wx-halfW,back,wx+halfW,back,.22));
  segments.push(segment(wx-halfW,back,wx-halfW,front,.22));
  segments.push(segment(wx+halfW,back,wx+halfW,front,.22));
  segments.push(segment(wx-halfW,front,wx-doorHalf,front,.22));
  segments.push(segment(wx+doorHalf,front,wx+halfW,front,.22));
  segments.push(segment(wx+.55,front-1.38,wx+.55,front-.45,.12));
  // The old Heavenly Kings Hall was removed. Its former statue positions stay clear.
  // Keep this west-side corridor open from the mountain gate to the Lotus Wish Wall.
  // Sutra library bookcases and reading desk.
  segments.push(segment(22.65, -28.4, 22.65, -19.6, 0.34));
  segments.push(segment(33.35, -28.4, 33.35, -19.6, 0.34));
  const libraryDeskZ = -22;
  segments.push(segment(26.6, libraryDeskZ - 0.525, 29.4, libraryDeskZ - 0.525, 0.12));
  segments.push(segment(26.6, libraryDeskZ + 0.525, 29.4, libraryDeskZ + 0.525, 0.12));
  segments.push(segment(26.6, libraryDeskZ - 0.525, 26.6, libraryDeskZ + 0.525, 0.12));
  segments.push(segment(29.4, libraryDeskZ - 0.525, 29.4, libraryDeskZ + 0.525, 0.12));
  // Low beds and privacy screens in the monastic quarters.
  for (const x of [25, 31]) {
    segments.push(segment(x - 1.325, 5.675, x + 1.325, 5.675, 0.13));
    segments.push(segment(x - 1.325, 9.025, x + 1.325, 9.025, 0.13));
    segments.push(segment(x - 1.325, 5.675, x - 1.325, 9.025, 0.13));
    segments.push(segment(x + 1.325, 5.675, x + 1.325, 9.025, 0.13));
  }
  // Tea house rear approach path: east-side bypass around the Great Hall and a clear entrance.
  segments.push(segment(13.5,-46,16.5,-46,.2),segment(16.5,-46,16.5,-60,.2),segment(16.5,-60,5,-60,.2));
  // Full-height west Lotus Wish Wall and the low east boundary.
  segments.push(segment(-31, -45.5, -31, 18.5, 0.36));
  const eastX = 31;
  const blocked = halls
    .filter(h => eastX >= h.x - h.w / 2 - 0.5 && eastX <= h.x + h.w / 2 + 0.5)
    .map(h => [h.z - h.d / 2 - 0.5, h.z + h.d / 2 + 0.5])
    .sort((a, b) => a[0] - b[0]);
  let cursor = -33.5;
  for (const [start, end] of blocked) {
    if (start > cursor) segments.push(segment(eastX, cursor, eastX, start, 0.34));
    cursor = Math.max(cursor, end);
  }
  if (cursor < 11.5) segments.push(segment(eastX, cursor, eastX, 11.5, 0.34));
  // Lantern pedestals along the temple roads and grass-market approach.
  for (const [x, z] of [
    [-6,24],[6,24],[-12,-1],[12,-1],[-20,-39],[20,-39],[0,41],
    [-5.5,35],[5.5,35],[-5.5,8],[5.5,8],[-5.5,-7],[5.5,-7],[-5.5,-22],[5.5,-22],
    [35.4,-1],[35.4,15],[35.4,31]
  ]) circles.push(circle(x,z,0.34));
  return { halls, segments, circles };
}

function pointSegmentDistanceSq(x, z, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const len = dx * dx + dz * dz;
  const t = len ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / len)) : 0;
  const px = s.ax + t * dx, pz = s.az + t * dz;
  return (x - px) ** 2 + (z - pz) ** 2;
}

export function collidesAt(x, z, world, radius = PLAYER_RADIUS) {
  if (Math.abs(x) > 80 || Math.abs(z) > 80) return true;
  for (const s of world.segments) {
    const r = radius + s.radius;
    if (pointSegmentDistanceSq(x, z, s) < r * r) return true;
  }
  for (const c of world.circles) {
    const r = radius + c.radius;
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < r * r) return true;
  }
  return false;
}

export function groundHeightAt(x, z, halls) {
  for (const h of halls) {
    const front = h.z + h.d / 2;
    // The visible tiled platform top and avatar floor share the same 54 cm height.
    if (Math.abs(x - h.x) < h.w / 2 - 0.38 &&
        z > h.z - h.d / 2 + 0.38 && z < front + 1.1) return 0.54;
    // Stair treads are contiguous with the platform and with one another.
    if (Math.abs(x - h.x) < h.w * 0.36) {
      if (z >= front + 3.1 && z <= front + 4.1) return 0.18;
      if (z >= front + 2.1 && z < front + 3.1) return 0.36;
      if (z >= front + 1.1 && z < front + 2.1) return 0.54;
    }
  }
  return 0;
}

export function moveWithCollision(position, dx, dz, world) {
  let x = position.x, z = position.z;
  let blocked = false;
  const count = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.12));
  const sx = dx / count, sz = dz / count;
  for (let i = 0; i < count; i++) {
    const tryAxis = (nx, nz) => {
      const nextY = groundHeightAt(nx, nz, world.halls);
      const oldY = groundHeightAt(x, z, world.halls);
      const actorBlocked = (world.actors || []).some(actor => {
        const limit = PLAYER_RADIUS + actor.radius;
        const nextDistance = (nx - actor.x) ** 2 + (nz - actor.z) ** 2;
        const currentDistance = (x - actor.x) ** 2 + (z - actor.z) ** 2;
        return nextDistance < limit * limit && nextDistance < currentDistance - 0.000001;
      });
      if (collidesAt(nx, nz, world) || actorBlocked || Math.abs(nextY - oldY) > MAX_STEP) {
        blocked = true;
        return;
      }
      x = nx; z = nz;
    };
    // Axis separation produces reliable wall sliding without tunnelling through corners.
    if (sx) tryAxis(x + sx, z);
    if (sz) tryAxis(x, z + sz);
  }
  return { x, z, y: groundHeightAt(x, z, world.halls), blocked, moved: x !== position.x || z !== position.z };
}
