// Lightweight deterministic capsule collision for the temple's walkable ground plane.
const PLAYER_RADIUS = 0.46;
const MAX_STEP = 0.191;

const segment = (ax, az, bx, bz, radius = 0.12) => ({ ax, az, bx, bz, radius });
const circle = (x, z, radius) => ({ x, z, radius });

export function createTempleCollision(halls) {
  const segments = [];
  const circles = [
    circle(-4.8, 31, 0.55), circle(4.8, 31, 0.55),
    circle(8, 0, 1.48), circle(-28, 2, 1.42), circle(31, 33, 9.85),
    circle(-29, 29, 1.05), circle(0, -39.5, 2.2), circle(-28, -28.45, 1.18),
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
    const doorHalf = h.w * 0.19;
    segments.push(segment(l, f, h.x - doorHalf, f, 0.22));
    segments.push(segment(h.x + doorHalf, f, r, f, 0.22));
    // Front columns and the two columns flanking the side walls.
    const n = Math.max(4, Math.round(h.w / 3));
    for (let i = 0; i < n; i++) {
      const px = -h.w / 2 + (i + 0.5) * h.w / n;
      if (Math.abs(px) < h.w * 0.2) continue;
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
  // Meditation hall scripture stand.
  const scriptureZ = -25 - 1.55;
  segments.push(segment(-29.2, scriptureZ - 0.36, -26.8, scriptureZ - 0.36, 0.12));
  segments.push(segment(-29.2, scriptureZ + 0.36, -26.8, scriptureZ + 0.36, 0.12));
  segments.push(segment(-29.2, scriptureZ - 0.36, -29.2, scriptureZ + 0.36, 0.12));
  segments.push(segment(-26.8, scriptureZ - 0.36, -26.8, scriptureZ + 0.36, 0.12));
  // Boundary stone walls.
  for (const side of [-1, 1]) {
    const x = side * 31;
    const blocked = halls
      .filter(h => x >= h.x - h.w / 2 - 0.5 && x <= h.x + h.w / 2 + 0.5)
      .map(h => [h.z - h.d / 2 - 0.5, h.z + h.d / 2 + 0.5])
      .sort((a, b) => a[0] - b[0]);
    let cursor = -33.5;
    for (const [start, end] of blocked) {
      if (start > cursor) segments.push(segment(x, cursor, x, start, 0.34));
      cursor = Math.max(cursor, end);
    }
    if (cursor < 11.5) segments.push(segment(x, cursor, x, 11.5, 0.34));
  }
  // Lantern pedestals.
  for (const [x, z] of [[-6,24],[6,24],[-12,-1],[12,-1],[-20,-39],[20,-39],[0,41]]) {
    circles.push(circle(x, z, 0.34));
  }
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
    // Raised interior floor and the level landing immediately inside the doorway.
    if (Math.abs(x - h.x) < h.w / 2 - 0.38 &&
        z > h.z - h.d / 2 + 0.38 && z < front + 1.18) return 0.54;
    // Three broad, continuous treads: 18 cm rise per step.
    const stair = [
      { z: front + 1.72, y: 0.54 },
      { z: front + 2.72, y: 0.36 },
      { z: front + 3.72, y: 0.18 }
    ];
    if (Math.abs(x - h.x) < h.w * 0.31) {
      for (const step of stair) if (Math.abs(z - step.z) <= 0.56) return step.y;
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
      if (collidesAt(nx, nz, world) || Math.abs(nextY - oldY) > MAX_STEP) {
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
