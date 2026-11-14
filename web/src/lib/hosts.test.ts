import { describe, expect, it } from "vitest";
import {
  MARKETING_URL,
  hostKind,
  isAuthPage,
  isProtectedPath,
  resolveHostRoute,
  safeNextPath,
} from "./hosts";

describe("hostKind", () => {
  it("recognises the two subdomains, with or without a port", () => {
    expect(hostKind("app.loomxrlabs.com")).toBe("app");
    expect(hostKind("AR.loomxrlabs.com")).toBe("ar");
    expect(hostKind("app.localhost:3000")).toBe("app");
  });

  it("treats localhost, preview URLs and missing hosts as unrestricted", () => {
    expect(hostKind("localhost:3000")).toBe("any");
    expect(hostKind("loomxr-web-git-mvp.vercel.app")).toBe("any");
    expect(hostKind(null)).toBe("any");
  });
});

describe("resolveHostRoute", () => {
  it("lets any path through on localhost and preview hosts", () => {
    expect(resolveHostRoute("localhost:3000", "/dashboard")).toEqual({ action: "next" });
    expect(resolveHostRoute("x.vercel.app", "/p/abc")).toEqual({ action: "next" });
  });

  it("serves only the customer flow on ar.", () => {
    expect(resolveHostRoute("ar.loomxrlabs.com", "/p/abc")).toEqual({ action: "next" });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/api/generate")).toEqual({ action: "next" });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/api/designs/1/select")).toEqual({
      action: "next",
    });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/dashboard")).toEqual({ action: "notFound" });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/login")).toEqual({ action: "notFound" });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/api/stripe/checkout")).toEqual({
      action: "notFound",
    });
  });

  it("does not match paths that merely share a prefix", () => {
    expect(resolveHostRoute("ar.loomxrlabs.com", "/products")).toEqual({ action: "notFound" });
    expect(resolveHostRoute("ar.loomxrlabs.com", "/api/sessions-export")).toEqual({
      action: "notFound",
    });
  });

  it("sends the bare ar. host to the marketing site", () => {
    expect(resolveHostRoute("ar.loomxrlabs.com", "/")).toEqual({
      action: "redirect",
      to: MARKETING_URL,
    });
  });

  it("hides the customer flow on app.", () => {
    expect(resolveHostRoute("app.loomxrlabs.com", "/dashboard")).toEqual({ action: "next" });
    expect(resolveHostRoute("app.loomxrlabs.com", "/api/stripe/webhook")).toEqual({
      action: "next",
    });
    expect(resolveHostRoute("app.loomxrlabs.com", "/p/abc")).toEqual({ action: "notFound" });
  });

  it("allows cron routes on both hosts", () => {
    expect(resolveHostRoute("ar.loomxrlabs.com", "/api/cron/cleanup")).toEqual({ action: "next" });
    expect(resolveHostRoute("app.loomxrlabs.com", "/api/cron/cleanup")).toEqual({
      action: "next",
    });
  });
});

describe("path classification", () => {
  it("marks business pages as protected", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/products/123")).toBe(true);
    expect(isProtectedPath("/admin/usage")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/p/abc")).toBe(false);
    expect(isProtectedPath("/api/stripe/webhook")).toBe(false);
  });

  it("knows the auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/auth/callback")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/billing?notice=x")).toBe("/billing?notice=x");
  });

  it("rejects anything that could leave the site", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});
