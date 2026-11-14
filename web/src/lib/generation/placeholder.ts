import "server-only";
import sharp from "sharp";

// Stand-in artwork for when no Together API key is set. It draws seeded
// abstract shapes in the shopper's chosen colour family, so the whole flow
// (slicing, compositing, AR) can be tried without any AI call.
// These are SAMPLE images, not AI designs. The UI labels them as such.

const PALETTES: Array<{ match: string; colours: string[] }> = [
  { match: "warm", colours: ["#7a1f1f", "#c8452c", "#e89b3c", "#f4d58d", "#fff3e0"] },
  { match: "cool", colours: ["#0b2545", "#13647a", "#3fa796", "#8fd3c8", "#e8f6f3"] },
  { match: "earthy", colours: ["#3b2f2f", "#6b4f3a", "#8a9a5b", "#c97b4a", "#efe3cf"] },
  { match: "pastel", colours: ["#f7c8d0", "#c9e4de", "#c6def1", "#dbcdf0", "#faedcb"] },
  { match: "black", colours: ["#111111", "#3a3a3a", "#f5f5f5", "#d9d9d9", "#e63946"] },
];

// Small deterministic random number generator (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function placeholderArtwork(input: {
  width: number;
  height: number;
  seed: number;
  colourAnswer?: string;
}): Promise<Buffer> {
  const { width, height, seed } = input;
  const random = rng(seed);
  const palette =
    PALETTES.find((p) => input.colourAnswer?.includes(p.match))?.colours ?? PALETTES[1].colours;
  const pick = () => palette[Math.floor(random() * palette.length)];

  const shapes: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = random() * width;
    const y = random() * height;
    const size = (0.04 + random() * 0.16) * height;
    const opacity = (0.35 + random() * 0.5).toFixed(2);
    const kind = Math.floor(random() * 3);
    if (kind === 0) {
      shapes.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="${pick()}" opacity="${opacity}"/>`);
    } else if (kind === 1) {
      const rot = Math.floor(random() * 90);
      shapes.push(
        `<rect x="${x}" y="${y}" width="${size * 1.6}" height="${size * 0.5}" rx="${size * 0.25}" fill="${pick()}" opacity="${opacity}" transform="rotate(${rot} ${x} ${y})"/>`,
      );
    } else {
      const sway = size * (random() > 0.5 ? 1 : -1);
      shapes.push(
        `<path d="M ${x - size * 2} ${y} q ${size} ${-sway} ${size * 2} 0 t ${size * 2} 0" stroke="${pick()}" stroke-width="${size * 0.18}" stroke-linecap="round" fill="none" opacity="${opacity}"/>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette[4]}"/><stop offset="1" stop-color="${palette[3]}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${shapes.join("")}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
