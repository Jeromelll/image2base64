import test from "node:test";
import assert from "node:assert/strict";
import { PROVIDERS, fetchOAuthProfile } from "../oauth.js";

const env = {
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-client",
  GITHUB_CLIENT_SECRET: "github-secret",
  X_CLIENT_ID: "x-client",
  X_CLIENT_SECRET: "x-secret",
};
const callback = "https://example.test/api/auth/callback";
const responseJson = (body, status = 200) => new Response(JSON.stringify(body), { status });

function withFetch(implementation, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = implementation;
  return Promise.resolve().then(run).finally(() => {
    globalThis.fetch = previous;
  });
}

test("exports only the three supported providers", () => {
  assert.deepEqual(Object.keys(PROVIDERS), ["google", "github", "x"]);
  assert.equal(PROVIDERS.x.scope, "users.read tweet.read");
  assert.equal(PROVIDERS.x.supportsPkce, true);
});

test("Google exchanges the code and returns a validated profile", async () => {
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push([String(url), init]);
    if (String(url) === "https://oauth2.googleapis.com/token") {
      return responseJson({ access_token: "google-access" });
    }
    return responseJson({ sub: "google-123", name: "Ada", email: "ada@example.test", email_verified: true, picture: "https://img.test/a.png" });
  }, async () => {
    const profile = await fetchOAuthProfile("google", env, "google-code", callback);
    assert.deepEqual(profile, {
      sub: "google-123",
      name: "Ada",
      email: "ada@example.test",
      picture: "https://img.test/a.png",
    });
  });
  assert.equal(calls.length, 2);
  const body = new URLSearchParams(calls[0][1].body);
  assert.equal(body.get("client_id"), "google-client");
  assert.equal(body.get("client_secret"), "google-secret");
  assert.equal(body.get("redirect_uri"), callback);
  assert.equal(calls[1][0], "https://openidconnect.googleapis.com/v1/userinfo");
});

test("Google omits an unverified email while preserving the stable subject", async () => {
  await withFetch(async (url) => String(url).includes("/token")
    ? responseJson({ access_token: "google-access" })
    : responseJson({ sub: "google-unverified-email", email: "unverified@example.test", email_verified: false }), async () => {
    const profile = await fetchOAuthProfile("google", env, "google-code", callback);
    assert.deepEqual(profile, {
      sub: "google-unverified-email",
      name: null,
      email: null,
      picture: null,
    });
  });
});

test("supports the established Pages callback route used by the games", async () => {
  const callbackUri = "https://example.test/api/auth/oauth/callback";
  await withFetch(async (url, init) => {
    if (String(url) === "https://oauth2.googleapis.com/token") {
      assert.equal(new URLSearchParams(init.body).get("redirect_uri"), callbackUri);
      return responseJson({ access_token: "google-access" });
    }
    return responseJson({ sub: "google-game-user" });
  }, async () => {
    const profile = await fetchOAuthProfile("google", env, "code", callbackUri);
    assert.equal(profile.sub, "google-game-user");
  });
});

test("Google rejects an empty subject", async () => {
  await withFetch(async (url) => String(url).includes("/token")
    ? responseJson({ access_token: "token" })
    : responseJson({ sub: " " }), async () => {
    await assert.rejects(fetchOAuthProfile("google", env, "code", callback), /valid subject/u);
  });
});

test("GitHub uses the required API headers and only returns verified email", async () => {
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push([String(url), init]);
    if (String(url).includes("/access_token")) return responseJson({ access_token: "github-access" });
    if (String(url) === "https://api.github.com/user") {
      return responseJson({ id: 42, name: "Grace", login: "grace", avatar_url: "https://img.test/g.png" });
    }
    return responseJson([
      { email: "private@example.test", primary: true, verified: false },
      { email: "verified@example.test", primary: false, verified: true },
    ]);
  }, async () => {
    const profile = await fetchOAuthProfile("github", env, "github-code", callback);
    assert.deepEqual(profile, {
      sub: "42",
      name: "Grace",
      email: "verified@example.test",
      picture: "https://img.test/g.png",
    });
  });
  assert.equal(calls[0][1].headers.accept, "application/vnd.github+json");
  assert.equal(calls[1][1].headers["user-agent"], "site-auth");
  assert.equal(calls[1][1].headers.accept, "application/vnd.github+json");
  assert.equal(calls[2][1].headers["user-agent"], "site-auth");
});

test("GitHub rejects an invalid subject", async () => {
  await withFetch(async (url) => {
    if (String(url).includes("access_token")) return responseJson({ access_token: "token" });
    return responseJson({ id: 0, login: "no-id" });
  }, async () => {
    await assert.rejects(fetchOAuthProfile("github", env, "code", callback), /valid subject/u);
  });
});

test("X uses confidential-client Basic auth and passes PKCE verifier", async () => {
  const verifier = "v".repeat(48);
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push([String(url), init]);
    if (String(url).includes("/token")) return responseJson({ access_token: "x-access" });
    return responseJson({ data: { id: "123456789", name: "Lin", username: "lin", profile_image_url: "https://img.test/x.png" } });
  }, async () => {
    const profile = await fetchOAuthProfile("x", env, "x-code", callback, verifier);
    assert.deepEqual(profile, {
      sub: "123456789",
      name: "Lin",
      email: null,
      picture: "https://img.test/x.png",
    });
  });
  const [tokenUrl, tokenInit] = calls[0];
  assert.equal(tokenUrl, "https://api.x.com/2/oauth2/token");
  assert.equal(tokenInit.headers.authorization, `Basic ${btoa("x-client:x-secret")}`);
  const body = new URLSearchParams(tokenInit.body);
  assert.equal(body.get("code_verifier"), verifier);
  assert.equal(body.get("redirect_uri"), callback);
  assert.equal(calls[1][0], "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username");
  assert.equal(calls[1][1].headers.authorization, "Bearer x-access");
});

test("X rejects a missing or non-numeric API subject", async (t) => {
  for (const id of [undefined, "", "not-an-id", 123]) {
    await t.test(String(id), async () => {
      await withFetch(async (url) => String(url).includes("/token")
        ? responseJson({ access_token: "token" })
        : responseJson({ data: { id } }), async () => {
        await assert.rejects(fetchOAuthProfile("x", env, "code", callback, "v".repeat(48)), /valid subject/u);
      });
    });
  }
});

test("rejects unsupported providers, missing codes, unconfigured credentials and non-HTTPS callbacks", async () => {
  await assert.rejects(fetchOAuthProfile("discord", env, "code", callback), /not supported/u);
  await assert.rejects(fetchOAuthProfile("google", env, " ", callback), /code is invalid/u);
  await assert.rejects(fetchOAuthProfile("google", {}, "code", callback), /not configured/u);
  await assert.rejects(fetchOAuthProfile("google", env, "code", "http://example.test/api/auth/callback"), /redirect URI/u);
  await assert.rejects(fetchOAuthProfile("google", env, "code", "https://example.test/api/auth/callback?next=https://evil.test"), /redirect URI/u);
  await assert.rejects(fetchOAuthProfile("google", env, "code", "https://example.test/api/auth/callback@evil.test"), /redirect URI/u);
});

test("provider and upstream errors fail closed", async () => {
  await withFetch(async () => responseJson({ error: "denied" }, 401), async () => {
    await assert.rejects(fetchOAuthProfile("google", env, "code", callback), /token request failed/u);
  });
  await withFetch(async (url) => String(url).includes("/token")
    ? responseJson({})
    : responseJson({ sub: "never" }), async () => {
    await assert.rejects(fetchOAuthProfile("google", env, "code", callback), /token response/u);
  });
});
