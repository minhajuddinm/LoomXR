import { describe, expect, it } from "vitest";
import { applyHomography, homography, straightenedSize, warpQuad, type Quad } from "./straighten";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("homography", () => {
  const tilted: Quad = [
    { x: 120, y: 80 },
    { x: 610, y: 40 },
    { x: 650, y: 420 },
    { x: 90, y: 380 },
  ];
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 },
  ];

  it("sends each marked corner exactly to its rectangle corner", () => {
    const h = homography(tilted, rect);
    tilted.forEach((corner, i) => {
      const p = applyHomography(h, corner);
      close(p.x, rect[i].x);
      close(p.y, rect[i].y);
    });
  });

  it("is the identity when the two shapes are the same", () => {
    const p = applyHomography(homography(rect, rect), { x: 123, y: 45 });
    close(p.x, 123);
    close(p.y, 45);
  });

  it("rejects corners that collapse onto a line", () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(() => homography(flat, rect)).toThrow();
  });
});

describe("warpQuad", () => {
  // A 4x4 picture whose left half is red and right half is blue.
  const width = 4, height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = x < 2 ? 255 : 0;
      data[o + 2] = x < 2 ? 0 : 255;
      data[o + 3] = 255;
    }
  }
  const pixel = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) =>
    [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

  it("returns the requested size", () => {
    const full: Quad = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    const out = warpQuad({ data, width, height }, full, 8, 6);
    expect([out.width, out.height, out.data.length]).toEqual([8, 6, 8 * 6 * 4]);
  });

  it("keeps only the marked region", () => {
    // Mark just the right (blue) half.
    const rightHalf: Quad = [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 2, y: 4 }];
    const out = warpQuad({ data, width, height }, rightHalf, 4, 4);
    expect(pixel(out, 1, 1)).toEqual([0, 0, 255, 255]);
    expect(pixel(out, 3, 2)).toEqual([0, 0, 255, 255]);
  });

  it("turns the picture when the corners are marked a quarter turn round", () => {
    // Starting from the top-right corner: the photo's right edge becomes the top.
    const turned: Quad = [{ x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }];
    const out = warpQuad({ data, width, height }, turned, 4, 4);
    expect(pixel(out, 1, 0)).toEqual([0, 0, 255, 255]); // top row is the blue side
    expect(pixel(out, 1, 3)).toEqual([255, 0, 0, 255]); // bottom row is the red side
  });
});

describe("straightenedSize", () => {
  it("matches the face's proportions with the longest side at the limit", () => {
    expect(straightenedSize(130, 75)).toEqual({ width: 1280, height: 738 });
    expect(straightenedSize(65, 75)).toEqual({ width: 1109, height: 1280 });
  });
});
