import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let cached: Stripe | undefined;

export function getStripe(): Stripe {
  cached ??= new Stripe(serverEnv.stripeSecretKey);
  return cached;
}
