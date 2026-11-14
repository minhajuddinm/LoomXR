import { describe, expect, it } from "vitest";
import {
  SIDE_FACES,
  faceSizeMm,
  faceTextureSize,
  generationSize,
  productInput,
  sideSlices,
  unrolledSizeMm,
} from "./products";

const box = { width_mm: 200, height_mm: 300, depth_mm: 70 };

const valid = {
  name: "Earl Grey",
  width_mm: "200",
  height_mm: "300",
  depth_mm: "70",
  base_price: "8",
  premium_price: "11.50",
};

describe("productInput", () => {
  it("accepts a valid box and converts prices to cents", () => {
    const parsed = productInput.parse({ ...valid, brand_colours: "#1f6e7d, #A9834F" });
    expect(parsed).toMatchObject({
      width_mm: 200,
      base_price: 800,
      premium_price: 1150,
      brand_colours: ["#1f6e7d", "#A9834F"],
      allow_custom_content: false,
    });
  });

  it("rejects dimensions that are missing, too small or too large", () => {
    expect(productInput.safeParse({ ...valid, width_mm: "abc" }).success).toBe(false);
    expect(productInput.safeParse({ ...valid, height_mm: "5" }).success).toBe(false);
    expect(productInput.safeParse({ ...valid, depth_mm: "5000" }).success).toBe(false);
    expect(productInput.safeParse({ ...valid, depth_mm: "-70" }).success).toBe(false);
  });

  it("rejects a premium price below the base price", () => {
    const result = productInput.safeParse({ ...valid, premium_price: "7" });
    expect(result.success).toBe(false);
  });

  it("rejects colours that are not hex codes", () => {
    expect(productInput.safeParse({ ...valid, brand_colours: "teal" }).success).toBe(false);
  });
});

describe("box geometry", () => {
  it("gives each face its real size", () => {
    expect(faceSizeMm(box, "front")).toEqual({ w: 200, h: 300 });
    expect(faceSizeMm(box, "left")).toEqual({ w: 70, h: 300 });
    expect(faceSizeMm(box, "top")).toEqual({ w: 200, h: 70 });
  });

  it("unrolls the four sides into one strip", () => {
    expect(unrolledSizeMm(box)).toEqual({ w: 540, h: 300 });
  });

  it("asks the image model for the unrolled aspect ratio in multiples of 16", () => {
    const size = generationSize(box);
    expect(size.width % 16).toBe(0);
    expect(size.height % 16).toBe(0);
    expect(size.width).toBe(1408);
    expect(size.width / size.height).toBeCloseTo(540 / 300, 1);
  });

  it("keeps extreme shapes inside the allowed pixel range", () => {
    const tall = generationSize({ width_mm: 20, height_mm: 1000, depth_mm: 20 });
    expect(tall.height).toBe(1408);
    expect(tall.width).toBeGreaterThanOrEqual(384);
  });
});

describe("sideSlices", () => {
  const slices = sideSlices(box, 1080, 600);

  it("tiles the full image width with no gaps or overlap", () => {
    let x = 0;
    for (const face of SIDE_FACES) {
      expect(slices[face].left).toBe(x);
      expect(slices[face].height).toBe(600);
      x += slices[face].width;
    }
    expect(x).toBe(1080);
  });

  it("gives each face a width proportional to its real width", () => {
    expect(slices.front.width).toBe(400); // 200 of 540 mm
    expect(slices.right.width).toBe(140); // 70 of 540 mm
    expect(slices.back.width).toBe(400);
    expect(slices.left.width).toBe(140);
  });

  it("still tiles exactly when the widths do not divide evenly", () => {
    const odd = sideSlices({ width_mm: 133, height_mm: 90, depth_mm: 41 }, 1001, 300);
    const total = SIDE_FACES.reduce((sum, f) => sum + odd[f].width, 0);
    expect(total).toBe(1001);
    expect(odd.left.left + odd.left.width).toBe(1001);
  });
});

describe("faceTextureSize", () => {
  it("keeps the face's proportions with the longest side at the limit", () => {
    expect(faceTextureSize(box, "front")).toEqual({ width: 683, height: 1024 });
    expect(faceTextureSize(box, "top")).toEqual({ width: 1024, height: 358 });
  });
});
