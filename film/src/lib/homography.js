// 2.5D placement for fx layers: an element drawn flat on a canvas is shown
// rotated in perspective by a homography (output uv → layer uv).
import * as THREE from "three";

const DEG = Math.PI / 180;

function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}

/** homography mapping src[i] → dst[i] (4 points each), as row-major 3×3 array */
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * place: {rect:[x,y,w,h] on the layer, cx, cy (screen centre px), rx, ry, rz (deg),
 *         scale, z (px, + away), persp (focal px), pivot: [px,py] relative to rect centre}
 * Returns THREE.Matrix3 (output uv → layer uv) and the projected corners.
 */
export function placeCard(place, W = 1920, H = 1080) {
  const [x, y, w, h] = place.rect;
  const f = place.persp ?? 2000;
  const s = place.scale ?? 1;
  const rx = (place.rx ?? 0) * DEG, ry = (place.ry ?? 0) * DEG, rz = (place.rz ?? 0) * DEG;
  const piv = place.pivot ?? [0, 0];
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const ccx = x + w / 2, ccy = y + h / 2;
  const out = corners.map(([px, py]) => {
    let X = (px - ccx - piv[0]) * s, Y = (py - ccy - piv[1]) * s, Z = 0;
    // rotate Z, then Y, then X
    let X1 = X * Math.cos(rz) - Y * Math.sin(rz), Y1 = X * Math.sin(rz) + Y * Math.cos(rz);
    let X2 = X1 * Math.cos(ry) + Z * Math.sin(ry), Z2 = -X1 * Math.sin(ry) + Z * Math.cos(ry);
    let Y3 = Y1 * Math.cos(rx) - Z2 * Math.sin(rx), Z3 = Y1 * Math.sin(rx) + Z2 * Math.cos(rx);
    X2 += piv[0]; Y3 += piv[1];
    const zz = Z3 + (place.z ?? 0);
    const k = f / (f + zz);
    return [(place.cx ?? ccx) + X2 * k, (place.cy ?? ccy) + Y3 * k];
  });
  // screen px → layer px
  const Hs = homography(out, corners);
  // output uv → screen px: X = u W, Y = (1 − v) H ; layer px → layer uv: u = x / W, v = 1 − y / H
  const T1 = new THREE.Matrix3().set(W, 0, 0, 0, -H, H, 0, 0, 1);
  const M = new THREE.Matrix3().set(...Hs);
  const T2 = new THREE.Matrix3().set(1 / W, 0, 0, 0, -1 / H, 1, 0, 0, 1);
  const R = new THREE.Matrix3().copy(T2).multiply(M).multiply(T1);
  return { H: R, corners: out };
}

/** simple 2D placement (translate/scale/rotate about rect centre) via placeCard */
export function place2D(rect, cx, cy, scale = 1, rz = 0) {
  return placeCard({ rect, cx, cy, scale, rz, persp: 1e9 });
}
