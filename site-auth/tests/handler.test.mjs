import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleAuth } from "../handler.js";

const ORIGIN = "https://example.test";
const configured = {
  AUTH_ORIGIN: ORIGIN,
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  GITHUB_CLIENT_ID: "github-client",
  GITHUB_CLIENT_SECRET: "github-secret",
  X_CLIENT_ID: "x-client",
  X_CLIENT_SECRET: "x-secret",
};

class MemoryKV {
  values = new Map();

  async get(key) {
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key, value, options = {}) {
    this.values.set(key, {
      value: String(value),
      expiresAt: options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null,
    });
  }

  async delete(key) {
    this.values.delete(key);
  }
}

function makeEnv(overrides = {}) {
  return { ...configured, AUTH_USERS: new MemoryKV(), ...overrides };
}

function stateCookie(response) {
  const line = response.headers.getSetCookie().find((value) => value.startsWith("site_auth_state="));
  assert.ok(line, "state cookie should be set");
  return line.split(";", 1)[0];
}

function sessionCookie(response) {
  const line = response.headers.getSetCookie().find((value) => value.startsWith("site_auth_sid="));
  assert.ok(line, "session cookie should be set");
  return line.split(";", 1)[0];
}

function mockGoogleFetch(profile = { sub: "google-1", name: "Ada", email: "ada@example.test", email_verified: true, picture: null }) {
  return async (url) => {
    if (String(url) === "https://oauth2.googleapis.com/token") {
      return new Response(JSON.stringify({ access_token: "mock-access" }), { status: 200 });
    }
    if (String(url) === "https://openidconnect.googleapis.com/v1/userinfo") {
      return new Response(JSON.stringify(profile), { status: 200 });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

async function start(env, provider = "google", requestOrigin = ORIGIN) {
  return handleAuth(
    new Request(`${requestOrigin}/api/auth/start?provider=${provider}`),
    env,
  );
}

function parseRedirect(response) {
  return new URL(response.headers.get("location"));
}

test("unrelated paths pass through untouched and auth routes fail closed without KV", async () => {
  assert.equal(await handleAuth(new Request(`${ORIGIN}/login.html`), {}), null);
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/providers`), { AUTH_ORIGIN: ORIGIN });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("providers endpoint exposes only fully configured channels and is no-store", async () => {
  const env = makeEnv({ X_CLIENT_SECRET: "" });
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/providers`), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    providers: [
      { id: "google", name: "Google" },
      { id: "github", name: "GitHub" },
    ],
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("start binds random state to a secure HttpOnly cookie and fixed callback", async () => {
  const env = makeEnv();
  const response = await start(env);
  assert.equal(response.status, 302);
  const authorize = parseRedirect(response);
  const state = authorize.searchParams.get("state");
  assert.ok(state);
  assert.equal(authorize.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/callback`);
  assert.equal(authorize.searchParams.get("client_id"), "google-client");
  assert.match(stateCookie(response), /^site_auth_state=[A-Za-z0-9_-]+$/u);
  assert.match(response.headers.getSetCookie().find((value) => value.startsWith("site_auth_state=")), /HttpOnly; Secure; SameSite=Lax/u);
  const record = JSON.parse(await env.AUTH_USERS.get(`state:${state}`));
  assert.equal(record.provider, "google");
  assert.ok(record.createdAt);
});

test("www and preview start requests redirect to the exact canonical origin", async () => {
  const env = makeEnv();
  const response = await start(env, "google", "https://preview.example.test");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), `${ORIGIN}/api/auth/start?provider=google`);
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal(env.AUTH_USERS.values.size, 0);
});

test("Google callback creates provider-scoped account and session; me and logout use SID cookie", async () => {
  const env = makeEnv();
  const started = await start(env);
  const authorization = parseRedirect(started);
  const state = authorization.searchParams.get("state");
  const browserCookie = stateCookie(started);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockGoogleFetch();
  try {
    const callback = await handleAuth(
      new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=good-code`, {
        headers: { cookie: browserCookie },
      }),
      env,
    );
    assert.equal(callback.status, 302);
    assert.equal(callback.headers.get("location"), `${ORIGIN}/login.html?auth=success`);
    const cookies = callback.headers.getSetCookie();
    const sid = sessionCookie(callback);
    assert.match(cookies.find((value) => value.startsWith("site_auth_sid=")), /Max-Age=2592000; HttpOnly; Secure; SameSite=Lax/u);
    assert.ok(cookies.some((value) => value.startsWith("site_auth_state=;")));
    assert.equal(await env.AUTH_USERS.get(`state:${state}`), null);
    assert.ok(await env.AUTH_USERS.get("user:google:google-1"));

    const me = await handleAuth(new Request(`${ORIGIN}/api/auth/me`, { headers: { cookie: sid } }), env);
    assert.deepEqual(await me.json(), {
      user: { provider: "google", name: "Ada", email: "ada@example.test", picture: null },
    });
    assert.equal(me.headers.get("cache-control"), "no-store");

    const logout = await handleAuth(new Request(`${ORIGIN}/api/auth/logout`, { method: "POST", headers: { cookie: sid } }), env);
    assert.deepEqual(await logout.json(), { ok: true });
    assert.ok(logout.headers.getSetCookie().some((value) => value.startsWith("site_auth_sid=;")));
    const afterLogout = await handleAuth(new Request(`${ORIGIN}/api/auth/me`, { headers: { cookie: sid } }), env);
    assert.deepEqual(await afterLogout.json(), { user: null });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("missing or mismatched state cookie cannot call provider or create an account", async () => {
  const env = makeEnv();
  const started = await start(env);
  const state = parseRedirect(started).searchParams.get("state");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("upstream must not be called"); };
  try {
    for (const cookie of [undefined, "site_auth_state=wrong-state"]) {
      const headers = cookie ? { cookie } : {};
      const response = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=code`, { headers }), env);
      assert.equal(response.headers.get("location"), `${ORIGIN}/login.html?auth=error`);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(await env.AUTH_USERS.get("user:google:google-1"), null);
});

test("provider error or missing callback code cannot create an account", async () => {
  const env = makeEnv();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("upstream must not be called"); };
  try {
    for (const query of ["error=access_denied", "code="]) {
      const started = await start(env);
      const state = parseRedirect(started).searchParams.get("state");
      const response = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&${query}`, {
        headers: { cookie: stateCookie(started) },
      }), env);
      assert.equal(response.headers.get("location"), `${ORIGIN}/login.html?auth=error`);
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(await env.AUTH_USERS.get("user:google:google-1"), null);
});

test("expired state is rejected and deleted", async () => {
  const env = makeEnv();
  const state = "expired-state";
  await env.AUTH_USERS.put(`state:${state}`, JSON.stringify({
    provider: "google",
    createdAt: Date.now() - 31 * 60 * 1000,
  }));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("upstream must not be called"); };
  try {
    const response = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=code`, {
      headers: { cookie: `site_auth_state=${state}` },
    }), env);
    assert.equal(response.headers.get("location"), `${ORIGIN}/login.html?auth=error`);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(await env.AUTH_USERS.get(`state:${state}`), null);
  assert.equal(await env.AUTH_USERS.get("user:google:google-1"), null);
});

test("state is one-use and callback from another host never changes the provider redirect URI", async () => {
  const env = makeEnv();
  const started = await start(env);
  const state = parseRedirect(started).searchParams.get("state");
  const browserCookie = stateCookie(started);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockGoogleFetch();
  try {
    const badHost = await handleAuth(new Request(`https://attacker.test/api/auth/callback?state=${state}&code=code`, {
      headers: { cookie: browserCookie },
    }), env);
    assert.equal(badHost.headers.get("location"), `${ORIGIN}/login.html?auth=error`);

    const first = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=code`, {
      headers: { cookie: browserCookie },
    }), env);
    assert.equal(first.headers.get("location"), `${ORIGIN}/login.html?auth=success`);
    const replay = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=code`, {
      headers: { cookie: browserCookie },
    }), env);
    assert.equal(replay.headers.get("location"), `${ORIGIN}/login.html?auth=error`);
    assert.equal(env.AUTH_USERS.values.has("session:undefined"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("upstream failure does not create account or session", async () => {
  const env = makeEnv();
  const started = await start(env);
  const state = parseRedirect(started).searchParams.get("state");
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "denied" }), { status: 401 });
  try {
    const response = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=code`, {
      headers: { cookie: stateCookie(started) },
    }), env);
    assert.equal(response.headers.get("location"), `${ORIGIN}/login.html?auth=error`);
    assert.equal(response.headers.getSetCookie().some((value) => value.startsWith("site_auth_sid=")), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(await env.AUTH_USERS.get("user:google:google-1"), null);
  assert.equal([...env.AUTH_USERS.values.keys()].some((key) => key.startsWith("session:")), false);
});

test("X stores PKCE verifier with state and signs in without an email", async () => {
  const env = makeEnv();
  const started = await start(env, "x");
  const authorization = parseRedirect(started);
  const state = authorization.searchParams.get("state");
  assert.equal(authorization.searchParams.get("scope"), "users.read tweet.read");
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");
  assert.ok(authorization.searchParams.get("code_challenge"));
  const record = JSON.parse(await env.AUTH_USERS.get(`state:${state}`));
  assert.equal(record.verifier.length, 64);

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "x-token" }), { status: 200 });
    return new Response(JSON.stringify({ data: { id: "987654321", username: "fox", name: "Fox" } }), { status: 200 });
  };
  try {
    const callback = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${state}&code=x-code`, {
      headers: { cookie: stateCookie(started) },
    }), env);
    assert.equal(callback.headers.get("location"), `${ORIGIN}/login.html?auth=success`);
    assert.ok(await env.AUTH_USERS.get("user:x:987654321"));
    const me = await handleAuth(new Request(`${ORIGIN}/api/auth/me`, { headers: { cookie: sessionCookie(callback) } }), env);
    assert.deepEqual(await me.json(), {
      user: { provider: "x", name: "Fox", email: null, picture: null },
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("same email from different providers remains two independent accounts", async () => {
  const env = makeEnv();
  const previousFetch = globalThis.fetch;
  try {
    const googleStart = await start(env, "google");
    const googleState = parseRedirect(googleStart).searchParams.get("state");
    globalThis.fetch = mockGoogleFetch({ sub: "google-same-email", name: "Same", email: "same@example.test", picture: null });
    const googleCallback = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${googleState}&code=google-code`, {
      headers: { cookie: stateCookie(googleStart) },
    }), env);
    assert.equal(googleCallback.headers.get("location"), `${ORIGIN}/login.html?auth=success`);

    const githubStart = await start(env, "github");
    const githubState = parseRedirect(githubStart).searchParams.get("state");
    globalThis.fetch = async (url) => {
      if (String(url) === "https://github.com/login/oauth/access_token") {
        return new Response(JSON.stringify({ access_token: "github-token" }), { status: 200 });
      }
      if (String(url) === "https://api.github.com/user") {
        return new Response(JSON.stringify({ id: 42, login: "same", name: "Same" }), { status: 200 });
      }
      return new Response(JSON.stringify([{ email: "same@example.test", verified: true, primary: true }]), { status: 200 });
    };
    const githubCallback = await handleAuth(new Request(`${ORIGIN}/api/auth/callback?state=${githubState}&code=github-code`, {
      headers: { cookie: stateCookie(githubStart) },
    }), env);
    assert.equal(githubCallback.headers.get("location"), `${ORIGIN}/login.html?auth=success`);
    assert.ok(await env.AUTH_USERS.get("user:google:google-same-email"));
    assert.ok(await env.AUTH_USERS.get("user:github:42"));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("invalid AUTH_ORIGIN fails closed", async () => {
  const env = makeEnv({ AUTH_ORIGIN: "http://example.test" });
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/providers`), env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "auth_unavailable" });
});

test("unknown auth paths return 404 and all API responses disable caching", async () => {
  const env = makeEnv();
  const response = await handleAuth(new Request(`${ORIGIN}/api/auth/missing`), env);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("logout rejects an explicit cross-origin Origin and allows same-origin or absent Origin", async () => {
  const env = makeEnv();
  const kv = env.AUTH_USERS;
  await kv.put("session:cross", JSON.stringify({ provider: "google", sub: "cross" }));
  const denied = await handleAuth(new Request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: { origin: "https://attacker.test", cookie: "site_auth_sid=cross" },
  }), env);
  assert.equal(denied.status, 403);
  assert.equal(await kv.get("session:cross") !== null, true);

  await kv.put("session:same", JSON.stringify({ provider: "google", sub: "same" }));
  const sameOrigin = await handleAuth(new Request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: { origin: ORIGIN, cookie: "site_auth_sid=same" },
  }), env);
  assert.equal(sameOrigin.status, 200);
  assert.equal(await kv.get("session:same"), null);

  await kv.put("session:no-origin", JSON.stringify({ provider: "google", sub: "no-origin" }));
  const absentOrigin = await handleAuth(new Request(`${ORIGIN}/api/auth/logout`, {
    method: "POST",
    headers: { cookie: "site_auth_sid=no-origin" },
  }), env);
  assert.equal(absentOrigin.status, 200);
  assert.equal(await kv.get("session:no-origin"), null);
});

test("login page references external CSS and JavaScript without inline blocks", async () => {
  const html = await readFile(new URL("../login.html", import.meta.url), "utf8");
  assert.match(html, /href="\/assets\/login\.css"/u);
  assert.match(html, /src="\/assets\/login\.js"/u);
  assert.doesNotMatch(html, /<style\b|<script\b[^>]*>[^<]/u);
});
