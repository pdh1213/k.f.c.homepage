import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const messages = "kfc_desktop_messages";
const reply = (status: number, body: object) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const fail = (status: number, message: string) => reply(status, { message });
const validId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0;

Deno.serve(async (request) => {
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site")) {
    return fail(403, "Windows 앱에서 이용해 주세요.");
  }
  if (request.method !== "POST") return fail(405, "Windows 앱에서 이용해 주세요.");
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return fail(401, "다시 로그인해 주세요.");

  try {
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return fail(401, "다시 로그인해 주세요.");

    const { data: self, error: selfError } = await db.from("users")
      .select("id,name,role,site_use_consented_at,must_change_password")
      .eq("auth_user_id", auth.user.id).eq("status", "approved").maybeSingle();
    if (selfError) throw selfError;
    if (!self) return fail(403, "승인된 동아리 계정만 이용할 수 있습니다.");
    if (self.must_change_password || (self.role === "member" && !self.site_use_consented_at)) {
      return fail(403, "동아리 홈페이지에서 비밀번호 변경 또는 이용 동의를 완료해 주세요.");
    }

    if (Number(request.headers.get("content-length")) > 16384) {
      return fail(413, "요청이 너무 큽니다.");
    }
    const raw = await request.text();
    if (raw.length > 16384) return fail(413, "요청이 너무 큽니다.");
    let input;
    try { input = JSON.parse(raw); } catch { return fail(400, "요청 내용을 확인해 주세요."); }
    if (!input || typeof input !== "object") return fail(400, "요청 내용을 확인해 주세요.");

    if (input.action === "overview") {
      const [directory, threads] = await Promise.all([
        db.from("users").select("id,name").eq("status", "approved").neq("id", self.id).order("name"),
        db.rpc("kfc_desktop_threads", { viewer: self.id }),
      ]);
      if (directory.error) throw directory.error;
      if (threads.error) throw threads.error;
      const peers = new Set(directory.data.map((person) => person.id));
      return reply(200, {
        self: { id: self.id, name: self.name },
        friends: directory.data,
        chats: threads.data.filter((row: { peer_id: number }) => peers.has(row.peer_id))
          .sort((a: { last_id: number }, b: { last_id: number }) => b.last_id - a.last_id),
      });
    }

    if (!validId(input.peer) || input.peer === self.id) return fail(400, "대화 상대를 선택해 주세요.");
    const peerId = input.peer;
    const { data: peer, error: peerError } = await db.from("users").select("id")
      .eq("id", peerId).eq("status", "approved").maybeSingle();
    if (peerError) throw peerError;
    if (!peer) return fail(404, "이 대화 상대를 찾을 수 없습니다.");

    if (input.action === "history") {
      let query = db.from(messages).select("id,sender_id,content,created_at")
        .or(`and(sender_id.eq.${self.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${self.id})`);
      if (validId(input.before)) query = query.lt("id", input.before);
      const { data, error } = await query.order("id", { ascending: false }).limit(51);
      if (error) throw error;
      return reply(200, { messages: data.slice(0, 50).reverse(), older: data.length > 50 });
    }

    if (input.action === "send") {
      const content = typeof input.content === "string" ? input.content.trim() : "";
      if (!content || [...content].length > 2000) return fail(400, "메시지를 2,000자 이내로 입력해 주세요.");
      const requestId = input.requestId;
      if (typeof requestId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId)) {
        return fail(400, "메시지 요청을 확인해 주세요.");
      }
      const { error } = await db.from(messages).insert({
        sender_id: self.id, recipient_id: peerId, request_id: requestId, content,
      });
      if (error && error.code !== "23505") throw error;
      return reply(200, { sent: true });
    }

    return fail(400, "요청 내용을 확인해 주세요.");
  } catch (error) {
    console.error("Desktop chat request failed", error instanceof Error ? error.name : typeof error);
    return fail(500, "채팅 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
});
