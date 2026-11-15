"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { straightenedSize, warpQuad, type Quad } from "@/lib/straighten";
import { ui } from "@/lib/ui";

// "Mark the four corners" step shown after a photo is picked. The result is a
// straight, tightly cropped picture of the face with its exact proportions.

const NAMES = ["Top left", "Top right", "Bottom right", "Bottom left"];
// Starting position, as fractions of the photo: a little in from each corner.
const START: Quad = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function StraightenDialog(props: {
  file: File;
  faceLabel: string;
  faceW: number;
  faceH: number;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const { file, faceLabel, faceW, faceH, onDone, onCancel } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [corners, setCorners] = useState<Quad>(START);
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const move = (index: number, x: number, y: number) =>
    setCorners((c) => c.map((p, i) => (i === index ? { x: clamp(x), y: clamp(y) } : p)) as Quad);

  function onPointerMove(e: React.PointerEvent) {
    if (dragging === null || !frame.current) return;
    const box = frame.current.getBoundingClientRect();
    move(dragging, (e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      // createImageBitmap applies the phone's rotation flag, so the picture
      // here is the right way up, the same as the preview above.
      const bitmap = await createImageBitmap(file);
      // Work on a copy no larger than 2400px: plenty for tracking, and quick.
      const shrink = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * shrink);
      canvas.height = Math.round(bitmap.height * shrink);
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const source = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const quad = corners.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height })) as Quad;
      const size = straightenedSize(faceW, faceH);
      const out = warpQuad(source, quad, size.width, size.height);

      canvas.width = out.width;
      canvas.height = out.height;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("no image");
      onDone(blob);
    } catch {
      setError("That did not work. Check the four corners are on the corners of the face, then try again.");
      setBusy(false);
    }
  }

  const points = corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="straighten-title"
      className="m-auto w-[min(92vw,46rem)] rounded-2xl border border-rule bg-paper p-0 text-ink shadow-lift backdrop:bg-ink-deep/70"
    >
      <div className="p-5 sm:p-7">
        <h2 id="straighten-title" className={ui.h2}>
          Mark the corners: {faceLabel}
        </h2>
        <p className="mt-2 text-ink-soft">
          Drag each dot onto a corner of this face of the box. Start with the top-left corner as the box stands on the
          shelf. This is what makes the AR preview line up.
        </p>

        <div
          ref={frame}
          className="relative mt-4 touch-none select-none overflow-hidden rounded-xl bg-ink-deep"
          onPointerMove={onPointerMove}
          onPointerUp={() => setDragging(null)}
          onPointerCancel={() => setDragging(null)}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
            <img src={url} alt={`Your photo of the ${faceLabel.toLowerCase()}`} className="block max-h-[60vh] w-full object-fill" draggable={false} />
          )}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
            <polygon points={points} fill="rgb(31 110 125 / 0.22)" stroke="#f3e9d8" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          </svg>
          {corners.map((p, i) => (
            <button
              key={NAMES[i]}
              type="button"
              aria-label={`${NAMES[i]} corner. Use the arrow keys to move it.`}
              className="absolute flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(i);
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 0.02 : 0.005;
                const delta: Record<string, [number, number]> = {
                  ArrowLeft: [-step, 0],
                  ArrowRight: [step, 0],
                  ArrowUp: [0, -step],
                  ArrowDown: [0, step],
                };
                const d = delta[e.key];
                if (!d) return;
                e.preventDefault();
                move(i, p.x + d[0], p.y + d[1]);
              }}
            >
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-paper bg-gold text-xs font-bold text-ink-deep shadow-lift">
                {i + 1}
              </span>
            </button>
          ))}
        </div>

        <div aria-live="polite">{error && <p className={`${ui.error} mt-4`}>{error}</p>}</div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className={ui.buttonQuiet} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={ui.button} onClick={() => void confirm()} disabled={busy}>
            {busy ? "Straightening…" : "Use this photo"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
