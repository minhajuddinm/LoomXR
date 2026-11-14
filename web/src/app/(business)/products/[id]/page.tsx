import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getBusinessContext, getRequestOrigin } from "@/lib/auth";
import { hasTogether } from "@/lib/generation/together";
import type { BoxFace, Product } from "@/lib/products";
import { createAdminClient } from "@/lib/supabase/admin";
import { ui } from "@/lib/ui";
import { saveBrief, saveTemplate, setProductStatus, updateProduct } from "../actions";
import { ProductForm } from "../product-form";
import { BriefForm, TemplateForm } from "./forms";
import { Photos } from "./photos";

export const metadata: Metadata = { title: "Product setup" };

function Step(props: { number: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className={ui.card} aria-labelledby={`step-${props.number}`}>
      <h2 id={`step-${props.number}`} className="flex flex-wrap items-center gap-3 text-xl font-bold">
        <span className="flex size-8 items-center justify-center rounded-full bg-ink text-base text-paper">{props.number}</span>
        {props.title}
        <span className={`text-sm font-semibold ${props.done ? "text-teal" : "text-ink-soft"}`}>
          {props.done ? "Done" : "To do"}
        </span>
      </h2>
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { business, db } = await getBusinessContext();
  const { data } = await db.from("products").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!data) notFound();
  const product = data as Product;

  const [faceRows, brief, template] = await Promise.all([
    db.from("product_faces").select("face, photo_path").eq("product_id", id),
    db.from("product_briefs").select("answers").eq("product_id", id).maybeSingle(),
    db.from("prompt_templates").select("template").eq("product_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Private files are shown through short-lived signed URLs. Ownership of the
  // product was checked above, so the admin client is safe to sign with.
  const storage = createAdminClient().storage.from("product-assets");
  const paths = [...(faceRows.data ?? []).map((f) => f.photo_path as string), ...(product.logo_path ? [product.logo_path] : [])];
  const signed = paths.length ? (await storage.createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlFor = (path: string | null) => signed.find((s) => s.path === path)?.signedUrl ?? null;

  const faces: Partial<Record<BoxFace, string>> = {};
  for (const f of faceRows.data ?? []) {
    const url = urlFor(f.photo_path as string);
    if (url) faces[f.face as BoxFace] = url;
  }

  // On app.loomxrlabs.com the customer link lives on ar.loomxrlabs.com. On
  // localhost and preview URLs it is the same host.
  const origin = (await getRequestOrigin()).replace("://app.", "://ar.");
  const customerUrl = `${origin}/p/${product.public_slug}`;
  const qrSvg = await QRCode.toString(customerUrl, { type: "svg", margin: 1, width: 220 });

  const hasBrief = Boolean(brief.data);
  const live = product.status === "active";
  const ready = Boolean(faces.front) && hasBrief;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/products" className={ui.link}>
          Back to products
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{product.name}</h1>
      </div>

      <Step number={1} title="Product details" done>
        <ProductForm action={updateProduct.bind(null, id)} product={product} />
      </Step>

      <Step number={2} title="Photos of the box" done={Boolean(product.targets_path)}>
        <p className="mb-4 text-ink-soft">
          Photograph each face straight on, in even light, and crop so the face fills the picture edge to edge. The front
          is required; more faces let the AR preview keep working as the customer turns the box.
        </p>
        <Photos productId={id} dims={product} faces={faces} logoUrl={urlFor(product.logo_path)} trackingReady={Boolean(product.targets_path)} />
      </Step>

      <Step number={3} title="Describe the product" done={hasBrief}>
        <p className="mb-4 text-ink-soft">
          Your answers set the style rules every design follows. Customers then add their own taste on top.
        </p>
        <BriefForm action={saveBrief.bind(null, id)} answers={(brief.data?.answers as Record<string, string>) ?? {}} />
        {template.data && (
          <div className="mt-6 border-t border-rule pt-6">
            <TemplateForm action={saveTemplate.bind(null, id)} template={template.data.template as string} />
          </div>
        )}
        {!hasTogether() && (
          <p className={`${ui.notice} mt-4`}>
            No Together AI key is set, so designs are sample patterns, not AI artwork. Add TOGETHER_API_KEY to switch on
            real generation.
          </p>
        )}
      </Step>

      <Step number={4} title="Go live and print the QR code" done={live}>
        {!ready && <p className="mb-4 text-ink-soft">Upload the front photo and answer the questions first.</p>}
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <div className="rounded border border-rule bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <a
              href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
              download={`${product.public_slug}-qr.svg`}
              className={`${ui.link} mt-2 inline-block text-sm`}
            >
              Download QR code (SVG)
            </a>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="font-semibold">{live ? "This product is live." : "This product is a draft."}</p>
            <p className="text-ink-soft">
              {live
                ? "Customers who scan the code can design their packaging now."
                : "Customers who scan the code see a “not available” page until you go live."}
            </p>
            <p className="break-all text-sm">
              Customer link:{" "}
              <a href={customerUrl} className={ui.link} target="_blank" rel="noreferrer">
                {customerUrl}
              </a>
            </p>
            <form action={setProductStatus.bind(null, id, live ? "draft" : "active")}>
              <button type="submit" disabled={!ready && !live} className={live ? ui.buttonQuiet : ui.button}>
                {live ? "Take offline" : "Go live"}
              </button>
            </form>
          </div>
        </div>
      </Step>
    </div>
  );
}
