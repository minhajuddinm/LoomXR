import { getPublicProduct } from "@/lib/customer-product";
import { getCustomerSession } from "@/lib/customer-session";
import { signDesignTextures } from "@/lib/generation/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";

// Everything the AR viewer needs for the current session: box size, the
// tracking file, which tracked image is which face, and the latest designs.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const product = await getPublicProduct(slug);
  if (!product?.targets_path) return Response.json({ error: "Not found." }, { status: 404 });

  const session = await getCustomerSession(product.id);
  if (!session) return Response.json({ error: "No session." }, { status: 401 });

  const db = createAdminClient();
  const [targets, faces, round] = await Promise.all([
    db.storage.from("product-assets").createSignedUrl(product.targets_path, 3600),
    db
      .from("product_faces")
      .select("face, target_index")
      .eq("product_id", product.id)
      .not("target_index", "is", null)
      .order("target_index"),
    db
      .from("generation_rounds")
      .select("id")
      .eq("session_id", session.id)
      .order("round_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (targets.error || !round.data) return Response.json({ error: "Not ready." }, { status: 409 });

  const { data: rows } = await db
    .from("designs")
    .select("id, composite_paths, status")
    .eq("round_id", round.data.id)
    .order("created_at");

  const designs = await Promise.all(
    (rows ?? []).map(async (row) => ({
      id: row.id as string,
      textures: await signDesignTextures(row.composite_paths as Record<string, string>),
    })),
  );

  return Response.json({
    product: {
      name: product.name,
      width: product.width_mm,
      height: product.height_mm,
      depth: product.depth_mm,
    },
    targetsUrl: targets.data.signedUrl,
    faces: faces.data ?? [],
    designs,
  });
}
