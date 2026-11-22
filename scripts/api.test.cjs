const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeApi } = require("../electron/api.cjs");

function response(status, payload) {
  return Response.json(payload, { status });
}

test("login keeps tokens out of renderer and sends native authorized requests", async () => {
  const seen = [];
  const api = makeApi(async (url, init) => {
    seen.push({ url, init });
    if (url.endsWith("/auth/login")) return response(200, { session: { access_token: "a", refresh_token: "r" } });
    return response(200, { friends: [] });
  });
  assert.deepEqual(await api.login("member", "test-password"), { ok: true });
  assert.deepEqual(await api.chat({ action: "overview" }), { ok: true, data: { friends: [] } });
  assert.equal(seen[1].init.headers.authorization, "Bearer a");
  assert.equal(seen[1].init.headers.origin, undefined);
  assert.equal(seen[1].init.redirect, "error");
});

test("parallel expired requests share one refresh and keep the message request id", async () => {
  let refreshes = 0;
  const sent = [];
  const api = makeApi(async (url, init) => {
    if (url.endsWith("/auth/login")) return response(200, { session: { access_token: "old", refresh_token: "r" } });
    if (url.includes("refresh_token")) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 5));
      return response(200, { access_token: "new", refresh_token: "next" });
    }
    sent.push({ token: init.headers.authorization, body: JSON.parse(init.body) });
    return init.headers.authorization === "Bearer old" ? response(401, {}) : response(200, { sent: true });
  });
  await api.login("member", "test-password");
  const command = { action: "send", peer: 2, requestId: "retry-id" };
  const [message, list] = await Promise.all([api.chat(command), api.chat({ action: "overview" })]);
  assert.equal(refreshes, 1);
  assert.equal(message.ok, true);
  assert.equal(list.ok, true);
  assert.deepEqual(sent.filter(row => row.body.action === "send").map(row => row.body.requestId), ["retry-id", "retry-id"]);
});

test("an in-flight refresh cannot restore a logged-out session", async () => {
  let start;
  const refreshing = new Promise(resolve => { start = resolve; });
  let finish;
  const responseReady = new Promise(resolve => { finish = resolve; });
  const api = makeApi(async (url) => {
    if (url.endsWith("/auth/login")) return response(200, { session: { access_token: "old", refresh_token: "r" } });
    if (url.includes("refresh_token")) { start(); return responseReady; }
    if (url.includes("/logout")) return response(200, {});
    return response(401, {});
  });
  await api.login("member", "test-password");
  const pending = api.chat({ action: "overview" });
  await refreshing;
  await api.logout();
  finish(response(200, { access_token: "late", refresh_token: "r2" }));
  assert.equal((await pending).status, 401);
  assert.equal((await api.chat({ action: "overview" })).status, 401);
});
