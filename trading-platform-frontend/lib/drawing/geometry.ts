/**
 * Geometry helpers for drawing tool interactions and rendering.
 */

/** Distance between two points */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** Angle in radians from (x1,y1) to (x2,y2) */
export function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** Degrees from radians */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Clamp value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Lerp between a and b at t */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Point distance to a line segment (px,py) → (ax,ay)-(bx,by) */
export function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(px, py, ax, ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + t * dx, ay + t * dy);
}

/** Extend a line defined by two points to canvas edges, returns [x1,y1,x2,y2] */
export function extendLine(
  x1: number, y1: number,
  x2: number, y2: number,
  w: number, h: number,
): [number, number, number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) < 0.001) {
    return [x1, 0, x1, h];
  }
  if (Math.abs(dy) < 0.001) {
    return [0, y1, w, y1];
  }

  const slope = dy / dx;
  const intercept = y1 - slope * x1;

  const pts: [number, number][] = [];
  // left edge
  const yLeft = intercept;
  if (yLeft >= 0 && yLeft <= h) pts.push([0, yLeft]);
  // right edge
  const yRight = slope * w + intercept;
  if (yRight >= 0 && yRight <= h) pts.push([w, yRight]);
  // top edge
  const xTop = -intercept / slope;
  if (xTop >= 0 && xTop <= w) pts.push([xTop, 0]);
  // bottom edge
  const xBot = (h - intercept) / slope;
  if (xBot >= 0 && xBot <= w) pts.push([xBot, h]);

  if (pts.length < 2) return [x1, y1, x2, y2];
  return [pts[0][0], pts[0][1], pts[1][0], pts[1][1]];
}

/** Extend a ray from p1 through p2 to canvas edge */
export function extendRay(
  x1: number, y1: number,
  x2: number, y2: number,
  w: number, h: number,
): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) < 0.001) {
    return [x1, dy > 0 ? h : 0];
  }

  const slope = dy / dx;
  let endX: number, endY: number;

  if (dx > 0) {
    endX = w;
    endY = y1 + slope * (w - x1);
  } else {
    endX = 0;
    endY = y1 - slope * x1;
  }

  if (endY < 0) { endY = 0; endX = x1 - y1 / slope; }
  if (endY > h) { endY = h; endX = x1 + (h - y1) / slope; }

  return [endX, endY];
}

/** Midpoint */
export function mid(x1: number, y1: number, x2: number, y2: number): [number, number] {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** Bezier quadratic point at t */
export function quadBezier(
  t: number,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * x0 + 2 * u * t * cx + t * t * x1,
    u * u * y0 + 2 * u * t * cy + t * t * y1,
  ];
}
