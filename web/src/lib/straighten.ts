// Photo straightening. The business marks the four corners of a box face in
// their photo; this maps that four-sided shape onto a rectangle with the
// face's exact proportions. The AR overlay is positioned from this picture, so
// a straight, tightly cropped photo is what makes the overlay line up.
//
// The maths is a "homography": the 3x3 matrix that maps one quadrilateral
// onto another. Pure functions, no DOM, so they are unit tested.

export type Point = { x: number; y: number };
// Corners in order: top-left, top-right, bottom-right, bottom-left.
export type Quad = [Point, Point, Point, Point];

// Solves A x = b by Gaussian elimination with partial pivoting.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-12) throw new Error("Corners do not form a usable shape");
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// The matrix (row-major, 9 numbers) that maps each `from` corner to the
// matching `to` corner.
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return [...solve(A, b), 1];
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

// Redraws the marked quadrilateral of `source` as an upright outW x outH image.
export function warpQuad(source: Pixels, quad: Quad, outW: number, outH: number): Pixels {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  // Map each output pixel back to where it came from in the photo.
  const h = homography(rect, quad);
  const out = new Uint8ClampedArray(outW * outH * 4);
  const { data, width, height } = source;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const w = h[6] * (x + 0.5) + h[7] * (y + 0.5) + h[8];
      const sx = Math.min(width - 1, Math.max(0, (h[0] * (x + 0.5) + h[1] * (y + 0.5) + h[2]) / w - 0.5));
      const sy = Math.min(height - 1, Math.max(0, (h[3] * (x + 0.5) + h[4] * (y + 0.5) + h[5]) / w - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const o = (y * outW + x) * 4;
      // Blend the four nearest photo pixels (bilinear) for a smooth result.
      for (let c = 0; c < 4; c++) {
        const top = data[(y0 * width + x0) * 4 + c] * (1 - fx) + data[(y0 * width + x1) * 4 + c] * fx;
        const bottom = data[(y1 * width + x0) * 4 + c] * (1 - fx) + data[(y1 * width + x1) * 4 + c] * fx;
        out[o + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return { data: out, width: outW, height: outH };
}

// Output size for a face of the given real size: exact proportions, longest
// side `longest` pixels.
export function straightenedSize(faceW: number, faceH: number, longest = 1280) {
  const scale = longest / Math.max(faceW, faceH);
  return { width: Math.max(8, Math.round(faceW * scale)), height: Math.max(8, Math.round(faceH * scale)) };
}
