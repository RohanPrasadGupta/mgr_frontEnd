// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const go = (path: string, signedIn = false) => {
  const req = new NextRequest(`http://app.test${path}`, signedIn ? { headers: { cookie: "mm_rt=x" } } : undefined);
  const res = proxy(req);
  return res.headers.get("location")?.replace("http://app.test", "") ?? "next";
};

describe("route gate", () => {
  it("lets anyone read the legal pages (the app stores link to them)", () => {
    expect(go("/privacy")).toBe("next");
    expect(go("/delete-account")).toBe("next");
    expect(go("/privacy", true)).toBe("next");
  });
  it("still sends signed-out visitors of app pages to sign-in", () => {
    expect(go("/transactions")).toBe("/login");
    expect(go("/login", true)).toBe("/");
  });
});
