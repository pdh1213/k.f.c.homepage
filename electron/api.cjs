const BASE = "https://mzlqksaprteljlcjnxix.supabase.co";
const PUBLIC_KEY = "sb_publishable_b2sm_UXIVP_3OUqzlAQJ6w_LM-RQsTf";
const DESKTOP = "/functions/v1/kfc-chat-desktop";

function makeApi(fetchImpl = fetch) {
  let session = null;
  let renewal = null;
  let generation = 0;

  async function request(path, input, token) {
    try {
      const response = await fetchImpl(BASE + path, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(25_000),
        headers: { apikey: PUBLIC_KEY, "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return { ok: true, data: payload };
      return { ok: false, status: response.status, message: payload.message || "서버 응답을 확인할 수 없습니다." };
    } catch {
      return { ok: false, status: 0, message: "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요." };
    }
  }

  function expired() {
    return { ok: false, status: 401, message: "다시 로그인해 주세요." };
  }

  async function login(username, password) {
    const attempt = ++generation;
    session = null;
    const result = await request("/functions/v1/kfc-api/auth/login", { username, password });
    if (!result.ok) return result;
    if (attempt !== generation || !result.data.session?.access_token) return expired();
    session = result.data.session;
    return { ok: true };
  }

  async function logout() {
    generation++;
    const previous = session;
    session = null;
    renewal = null;
    if (previous) await request("/auth/v1/logout?scope=local", {}, previous.access_token);
    return { ok: true };
  }

  async function chat(input) {
    const attempt = generation;
    const previous = session;
    if (!previous) return expired();
    const result = await request(DESKTOP, input, previous.access_token);
    if (attempt !== generation) return expired();
    if (result.status !== 401) return result;
    if (session === previous) {
      if (!renewal || renewal.attempt !== attempt) {
        const pending = request("/auth/v1/token?grant_type=refresh_token", { refresh_token: previous.refresh_token })
          .then(refresh => {
            if (generation === attempt && refresh.ok && refresh.data.access_token) session = refresh.data;
            return refresh;
          });
        renewal = { attempt, pending };
      }
      const pending = renewal;
      const refresh = await pending.pending;
      if (renewal === pending) renewal = null;
      if (!refresh.ok && (refresh.status === 0 || refresh.status === 429 || refresh.status >= 500)) return refresh;
      if (attempt !== generation || session === previous || !session) return expired();
    }
    const retried = await request(DESKTOP, input, session.access_token);
    return attempt === generation ? retried : expired();
  }

  return { login, logout, chat };
}

module.exports = { makeApi };
