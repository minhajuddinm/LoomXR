// Creates a login and prints a one-time link for choosing its password.
// No email is sent, so this works before an email service is connected.
//
//   pnpm invite someone@example.com --admin
//   pnpm invite someone@example.com --admin --take-demo-business
//   pnpm invite owner@shop.com --origin=https://your-preview.vercel.app
//
//   --admin               gives LoomXR staff access (the /admin page)
//   --take-demo-business  hands the shared "Demo business" and its products to
//                         this login (only if the login has no business yet)
//   --origin=URL          where the link should open (default localhost:3000)
//
// The link works once and expires in about an hour. Treat it like a password:
// send it only to the person it is for.

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"))?.toLowerCase();
const flag = (name: string) => args.includes(`--${name}`);
const origin = (args.find((a) => a.startsWith("--origin="))?.slice(9) ?? "http://localhost:3000").replace(/\/$/, "");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in web/.env.local.");
  process.exit(1);
}
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: pnpm invite <email> [--admin] [--take-demo-business] [--origin=URL]");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

// Find or create the user. (listUsers is fine at this scale.)
const list = await db.auth.admin.listUsers({ perPage: 1000 });
if (list.error) throw list.error;
let user = list.data.users.find((u) => u.email?.toLowerCase() === email);
if (user) {
  console.log(`Login already exists for ${email}.`);
} else {
  const created = await db.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  user = created.data.user;
  console.log(`Login created for ${email}.`);
}

if (flag("admin")) {
  const updated = await db.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role: "admin" },
  });
  if (updated.error) throw updated.error;
  console.log("Admin access granted.");
}

if (flag("take-demo-business")) {
  const setting = await db.from("app_settings").select("value").eq("key", "demo_business_id").maybeSingle();
  const demoId = typeof setting.data?.value === "string" ? setting.data.value : null;
  const existing = await db.from("businesses").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (!demoId) {
    console.log("No demo business exists. Skipped.");
  } else if (existing.data) {
    console.log("This login already owns a business. Demo business left as it is.");
  } else {
    const moved = await db.from("businesses").update({ owner_user_id: user.id }).eq("id", demoId);
    if (moved.error) throw moved.error;
    await db.from("app_settings").delete().eq("key", "demo_business_id");
    console.log("The demo business and its products now belong to this login.");
  }
}

const link = await db.auth.admin.generateLink({ type: "recovery", email });
if (link.error) throw link.error;
const token = link.data.properties.hashed_token;
console.log("\nOne-time link to choose a password (expires in about an hour):\n");
console.log(`${origin}/auth/confirm?token_hash=${token}&type=recovery&next=/account/password\n`);
