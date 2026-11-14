"use client";

import { useRef, useState } from "react";

// A real-proportion 3D box built from six textured faces with CSS transforms.
// It turns slowly by itself; dragging turns it by hand. No WebGL, so it works
// on any phone, and it shows the design even where the camera preview cannot.

type Dims = { width: number; height: number; depth: number };

export function Box3D({ textures, dims, label, size = 220 }: {
  textures: Record<string, string>;
  dims: Dims;
  label: string;
  size?: number;
}) {
  // Scale the box so its longest edge is `size` pixels.
  const scale = size / Math.max(dims.width, dims.height, dims.depth);
  const w = dims.width * scale;
  const h = dims.height * scale;
  const d = dims.depth * scale;

  const [angle, setAngle] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const face = (name: string, fw: number, fh: number, transform: string) => (
    <div
      key={name}
      className="absolute left-1/2 top-1/2 bg-panel bg-cover bg-center [backface-visibility:hidden]"
      style={{
        width: fw,
        height: fh,
        marginLeft: -fw / 2,
        marginTop: -fh / 2,
        transform,
        backgroundImage: `url("${textures[name]}")`,
      }}
    />
  );

  return (
    <div
      role="img"
      aria-label={label}
      className="mx-auto flex cursor-grab touch-none select-none items-center justify-center [perspective:900px] active:cursor-grabbing"
      style={{ width: size * 1.5, height: size * 1.25 }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const start = angle ?? { x: -14, y: -30 };
        drag.current = { px: e.clientX, py: e.clientY, ...start };
        setAngle(start);
      }}
      onPointerMove={(e) => {
        const s = drag.current;
        if (!s) return;
        setAngle({
          x: Math.max(-60, Math.min(60, s.x - (e.clientY - s.py) * 0.5)),
          y: s.y + (e.clientX - s.px) * 0.6,
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <div
        className={`relative [transform-style:preserve-3d] ${angle ? "" : "animate-spin-box"}`}
        style={{
          width: w,
          height: h,
          transform: angle ? `rotateX(${angle.x}deg) rotateY(${angle.y}deg)` : undefined,
        }}
      >
        {face("front", w, h, `translateZ(${d / 2}px)`)}
        {face("back", w, h, `rotateY(180deg) translateZ(${d / 2}px)`)}
        {face("right", d, h, `rotateY(90deg) translateZ(${w / 2}px)`)}
        {face("left", d, h, `rotateY(-90deg) translateZ(${w / 2}px)`)}
        {face("top", w, d, `rotateX(90deg) translateZ(${h / 2}px)`)}
        {face("bottom", w, d, `rotateX(-90deg) translateZ(${h / 2}px)`)}
      </div>
    </div>
  );
}
