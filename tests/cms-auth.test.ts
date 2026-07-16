import { afterEach, describe, expect, it, vi } from "vitest";

import worker, { type CmsAuthEnv } from "../workers/cms-auth/src/index";

const env: CmsAuthEnv = {
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  ALLOWED_DOMAINS: "healerlord.github.io",
  ALLOWED_USERS: "healerlord",
};

function authRequest(domain = "healerlord.github.io") {
  return new Request(
    `https://cms-auth.example.workers.dev/auth?provider=github&site_id=${domain}`,
  );
}

async function beginAuth() {
  const response = await worker.fetch(authRequest(), env);
  const location = new URL(response.headers.get("location") ?? "");

  return {
    response,
    state: location.searchParams.get("state") ?? "",
    cookie: (response.headers.get("set-cookie") ?? "").split(";")[0],
    location,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("CMS OAuth Worker", () => {
  it("rejects an unapproved site domain", async () => {
    const response = await worker.fetch(authRequest("evil.example"), env);

    expect(await response.text()).toContain("UNSUPPORTED_DOMAIN");
  });

  it("starts OAuth with a least-privilege public repository scope", async () => {
    const { response, location } = await beginAuth();

    expect(response.status).toBe(302);
    expect(location.origin).toBe("https://github.com");
    expect(location.searchParams.get("scope")).toBe("public_repo read:user");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects a callback with a mismatched CSRF state", async () => {
    const { cookie } = await beginAuth();
    const request = new Request(
      "https://cms-auth.example.workers.dev/callback?code=code&state=wrong",
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);

    expect(await response.text()).toContain("CSRF_DETECTED");
  });

  it("does not return a token for another GitHub user", async () => {
    const { state, cookie } = await beginAuth();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: "secret-token" }))
      .mockResolvedValueOnce(Response.json({ login: "intruder" }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request(
      `https://cms-auth.example.workers.dev/callback?code=code&state=${state}`,
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);
    const html = await response.text();

    expect(html).toContain("UNAUTHORIZED_USER");
    expect(html).not.toContain("secret-token");
  });

  it("returns the token only for healerlord", async () => {
    const { state, cookie } = await beginAuth();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ access_token: "secret-token" }))
        .mockResolvedValueOnce(Response.json({ login: "healerlord" })),
    );

    const request = new Request(
      `https://cms-auth.example.workers.dev/callback?code=code&state=${state}`,
      { headers: { Cookie: cookie } },
    );
    const response = await worker.fetch(request, env);

    expect(await response.text()).toContain("secret-token");
  });
});
