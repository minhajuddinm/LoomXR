import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// POST only, so a link or image on another site cannot sign a user out.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${await getRequestOrigin()}/login`, 303);
}
