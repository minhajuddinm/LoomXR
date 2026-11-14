// Creates (or resets) a confirmed test login for local testing, so you do not
// have to wait for a confirmation email.
//
//   pnpm test:user
//
// The email and password come from TEST_USER_EMAIL and TEST_USER_PASSWORD in
// web/.env.local. If they are missing, the script generates them and appends
// them to that file. Values are never printed.

import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in web/.env.local.");
  process.exit(1);
}

let email = process.env.TEST_USER_EMAIL;
let password = process.env.TEST_USER_PASSWORD;
if (!email || !password) {
  email = `local-test-${randomBytes(4).toString("hex")}@example.com`;
  password = randomBytes(18).toString("base64url");
  appendFileSync(
    ".env.local",
    `\n# Local test login, created by pnpm test:user\nTEST_USER_EMAIL=${email}\nTEST_USER_PASSWORD=${password}\n`,
  );
  console.log("Generated a test login and saved it to web/.env.local.");
}

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  if (created.error.code !== "email_exists") {
    console.error(`Could not create the test user: ${created.error.message}`);
    process.exit(1);
  }
  console.log("Test user already exists.");
} else {
  console.log("Test user created and confirmed.");
}
console.log("Log in at /login with TEST_USER_EMAIL and TEST_USER_PASSWORD from web/.env.local.");
