"use client";

import { useState, useTransition } from "react";
import { BOX_FACES, FACE_LABELS, faceSizeMm, type BoxDims, type BoxFace } from "@/lib/products";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui";
import { removeFace, requestUpload, saveFace, saveLogo, saveTargets } from "../actions";
import { StraightenDialog } from "./straighten-dialog";

const MINDAR_URL = "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js";

type CompilerClass = new () => {
  compileImageTargets(images: HTMLImageElement[], progress: (percent: number) => void): Promise<unknown>;
  exportData(): Promise<ArrayBuffer>;
};

// Shrinks a photo in the browser before upload. Phone photos are several
// megabytes; tracking and textures need far less.
async function resizeImage(file: File, maxSide: number, type: "image/jpeg" | "image/png"): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read image"))), type, 0.88),
  );
}

async function upload(productId: string, kind: "face" | "logo" | "targets", blob: Blob, face?: string) {
  const ticket = await requestUpload(productId, kind, blob.type, face);
  if ("error" in ticket) throw new Error(ticket.error);
  const { error } = await createClient()
    .storage.from("product-assets")
    .uploadToSignedUrl(ticket.path, ticket.token, blob, { contentType: blob.type });
  if (error) throw new Error("Upload failed. Check your connection and try again.");
  return ticket.path;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a face photo"));
    img.src = URL.createObjectURL(blob);
  });
}

export function Photos(props: {
  productId: string;
  dims: BoxDims;
  faces: Partial<Record<BoxFace, string>>; // face -> signed photo URL
  logoUrl: string | null;
  trackingReady: boolean;
}) {
  const { productId, dims, faces, logoUrl, trackingReady } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const uploaded = BOX_FACES.filter((f) => faces[f]);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  // A picked photo waits here while the business marks the face's corners.
  const [pending, setPending] = useState<{ face: BoxFace; file: File } | null>(null);

  // `blob` is the straightened photo from the corner-marking step.
  const onFace = (face: BoxFace, blob: Blob) =>
    run(face, async () => {
      const path = await upload(productId, "face", blob, face);
      const result = await saveFace(productId, face, path);
      if (result?.error) throw new Error(result.error);
    });

  const onLogo = (file: File | undefined) =>
    file &&
    run("logo", async () => {
      const blob = await resizeImage(file, 800, "image/png");
      const path = await upload(productId, "logo", blob);
      const result = await saveLogo(productId, path);
      if (result?.error) throw new Error(result.error);
    });

  // Builds the AR tracking file in this browser from the uploaded photos.
  const compile = () =>
    run("compile", async () => {
      setProgress(0);
      await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ MINDAR_URL);
      const Compiler = (window as unknown as { MINDAR: { IMAGE: { Compiler: CompilerClass } } }).MINDAR.IMAGE.Compiler;
      const images = await Promise.all(
        uploaded.map(async (face) => loadImage(await (await fetch(faces[face]!)).blob())),
      );
      const compiler = new Compiler();
      await compiler.compileImageTargets(images, (percent) => setProgress(Math.round(percent)));
      const data = await compiler.exportData();
      const path = await upload(productId, "targets", new Blob([data], { type: "application/octet-stream" }));
      const result = await saveTargets(productId, path, uploaded);
      if (result?.error) throw new Error(result.error);
    });

  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {BOX_FACES.map((face) => {
          const size = faceSizeMm(dims, face);
          return (
            <li key={face} className="rounded-xl border border-rule bg-canvas/60 p-3 transition duration-200 hover:border-teal/60">
              <p className="font-semibold">
                {FACE_LABELS[face]}
                {face === "front" && <span className="font-normal text-ink-soft"> (required)</span>}
              </p>
              <p className="text-sm text-ink-soft">
                {size.w} × {size.h} mm
              </p>
              <div className="mt-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-rule bg-paper">
                {faces[face] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                  <img src={faces[face]} alt={`${FACE_LABELS[face]} photo`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-sm text-ink-soft">No photo</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer text-sm font-semibold text-teal underline underline-offset-2">
                  {busy === face ? "Uploading…" : faces[face] ? "Replace" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={busy !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPending({ face, file });
                      e.target.value = "";
                    }}
                  />
                </label>
                {faces[face] && (
                  <button
                    type="button"
                    className="text-sm text-ink-soft underline underline-offset-2"
                    disabled={busy !== null}
                    onClick={() => startTransition(() => void removeFace(productId, face))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-rule p-4">
        <p className="font-semibold">Logo (optional)</p>
        <p className="text-sm text-ink-soft">A PNG with a transparent background works best. Placed at the top of the front.</p>
        <div className="mt-2 flex items-center gap-4">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
            <img src={logoUrl} alt="Current logo" className="h-14 max-w-40 rounded bg-panel object-contain p-1" />
          )}
          <label className="cursor-pointer text-sm font-semibold text-teal underline underline-offset-2">
            {busy === "logo" ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                void onLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-rule p-4">
        <p className="font-semibold">AR tracking</p>
        <p className="text-sm text-ink-soft">
          The customer&apos;s phone recognises the box from these photos. Prepare tracking after the photos are final. It
          runs in this browser and can take up to a minute.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" className={ui.buttonQuiet} disabled={busy !== null || !faces.front} onClick={() => void compile()}>
            {busy === "compile" ? `Preparing… ${progress ?? 0}%` : trackingReady ? "Prepare again" : "Prepare AR tracking"}
          </button>
          <span className={trackingReady ? "font-semibold text-teal" : "text-ink-soft"}>
            {trackingReady ? `Ready (${uploaded.length} face${uploaded.length === 1 ? "" : "s"})` : faces.front ? "Not prepared yet" : "Upload the front photo first"}
          </span>
        </div>
        {uploaded.length > 0 && uploaded.length < 4 && (
          <p className={`${ui.notice} mt-3`}>
            With {uploaded.length === 1 ? "only the front" : `only ${uploaded.length} faces`} photographed, the preview
            disappears when the customer turns the box to a face without a photo. Add the back and both sides so it
            follows the box all the way round.
          </p>
        )}
      </div>

      <div aria-live="polite">{error && <p className={ui.error}>{error}</p>}</div>

      {pending && (
        <StraightenDialog
          file={pending.file}
          faceLabel={FACE_LABELS[pending.face]}
          faceW={faceSizeMm(dims, pending.face).w}
          faceH={faceSizeMm(dims, pending.face).h}
          onCancel={() => setPending(null)}
          onDone={(blob) => {
            const face = pending.face;
            setPending(null);
            void onFace(face, blob);
          }}
        />
      )}
    </div>
  );
}
