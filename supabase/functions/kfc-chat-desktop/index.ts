import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const messages = "kfc_desktop_messages";
const bucket = db.storage.from("kfc-chat-attachments");
const maxFile = 4 * 1024 * 1024;
const emojiSet = new Set(["👍", "❤️", "😂", "🎉", "😮", "👀"]);
const statuses = new Set(["online", "dnd", "offline"]);
const reply = (status: number, body: object) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const fail = (status: number, message: string) => reply(status, { message });
const validId = (id: unknown): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function data<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

function encode(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  }
  return btoa(binary);
}

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
    const self = data(await db.from("users").select("id,name,role,site_use_consented_at,must_change_password")
      .eq("auth_user_id", auth.user.id).eq("status", "approved").maybeSingle());
    if (!self) return fail(403, "승인된 동아리 계정만 이용할 수 있습니다.");
    if (self.must_change_password || (self.role === "member" && !self.site_use_consented_at)) {
      return fail(403, "동아리 홈페이지에서 비밀번호 변경 또는 이용 동의를 완료해 주세요.");
    }

    const maxRequest = 5_620_000;
    if (Number(request.headers.get("content-length")) > maxRequest) return fail(413, "파일이 너무 큽니다.");
    const raw = await request.text();
    if (raw.length > maxRequest) return fail(413, "파일이 너무 큽니다.");
    let input;
    try { input = JSON.parse(raw); } catch { return fail(400, "요청 내용을 확인해 주세요."); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return fail(400, "요청 내용을 확인해 주세요.");
    const viewer = self.id;

    if (input.action === "overview") {
      if (statuses.has(input.mode)) {
        data(await db.from("kfc_chat_presence").upsert({
          user_id: viewer, seen_at: new Date().toISOString(), mode: input.mode,
        }));
      }
      const overview = data(await db.rpc("kfc_chat_overview", { viewer }));
      return reply(200, { ...overview, self: { id: viewer, name: self.name, moderator: self.role === "admin" } });
    }

    if (input.action === "avatars") {
      const ids = Array.isArray(input.ids) ? [...new Set(input.ids.filter(validId))].slice(0, 24) : [];
      const people = ids.length ? data(await db.from("users").select("id,avatar_data")
        .eq("status", "approved").in("id", ids)) : [];
      return reply(200, { people });
    }

    if (input.action === "reports" || input.action === "review") {
      if (self.role !== "admin") return fail(403, "관리자만 확인할 수 있습니다.");
      if (input.action === "review") {
        if (!validId(input.id)) return fail(400, "신고를 선택해 주세요.");
        data(await db.from("kfc_chat_reports").update({
          reviewed_at: new Date().toISOString(), reviewed_by: viewer,
        }).eq("id", input.id).is("reviewed_at", null));
        return reply(200, { ok: true });
      }
      const reports = data(await db.from("kfc_chat_reports")
        .select("id,reason,excerpt,created_at,reviewed_at,reported:users!kfc_chat_reports_peer_id_fkey(name),reporter:users!kfc_chat_reports_reporter_id_fkey(name)")
        .order("reviewed_at", { ascending: true, nullsFirst: true }).order("id", { ascending: false }).limit(100));
      return reply(200, { reports });
    }

    if (!validId(input.peer) || input.peer === viewer) return fail(400, "대화 상대를 선택해 주세요.");
    const peer = input.peer;
    const person = data(await db.from("users").select("id").eq("id", peer).eq("status", "approved").maybeSingle());
    if (!person) return fail(404, "이 대화 상대를 찾을 수 없습니다.");
    const pair = `and(sender_id.eq.${viewer},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${viewer})`;

    if (input.action === "history" || input.action === "search") {
      const search = input.action === "search" ? text(input.query).slice(0, 100) : null;
      if (search === "") return reply(200, { messages: [], older: false });
      const history = data(await db.rpc("kfc_chat_history", {
        viewer, peer, before_id: validId(input.before) ? input.before : null, search_text: search,
      }));
      return reply(200, history);
    }

    if (input.action === "typing") {
      data(await db.from("kfc_chat_presence").update({
        typing_peer: peer, typing_until: new Date(Date.now() + 5500).toISOString(),
      }).eq("user_id", viewer).eq("mode", "online"));
      return reply(200, { ok: true });
    }

    if (input.action === "preference") {
      const field = text(input.field);
      if (!["pinned", "muted", "blocked", "clear", "read"].includes(field)) return fail(400, "설정을 확인해 주세요.");
      data(await db.rpc("kfc_chat_preferences_update", {
        viewer, peer, field, enabled: input.enabled === true, through: validId(input.through) ? input.through : 0,
      }));
      return reply(200, { ok: true });
    }

    const preferences = async () => data(await db.from("kfc_chat_preferences")
      .select("user_id,blocked,hidden_through")
      .or(`and(user_id.eq.${viewer},peer_id.eq.${peer}),and(user_id.eq.${peer},peer_id.eq.${viewer})`));

    if (input.action === "send") {
      const requestId = text(input.requestId).toLowerCase();
      if (!uuid.test(requestId)) return fail(400, "메시지 요청을 확인해 주세요.");
      const saved = data(await db.from(messages).select("id,recipient_id").eq("sender_id", viewer)
        .eq("request_id", requestId).maybeSingle());
      if (saved) return saved.recipient_id === peer ? reply(200, { sent: true, id: saved.id }) : fail(409, "이미 사용한 요청입니다.");
      const flags = await preferences();
      if (flags.some(p => p.blocked)) return fail(403, "현재 이 상대에게 메시지를 보낼 수 없습니다.");
      const cutoff = flags.find(p => p.user_id === viewer)?.hidden_through ?? 0;
      const content = text(input.content);
      if ([...content].length > 2000) return fail(400, "메시지를 2,000자 이내로 입력해 주세요.");
      let quoteId: number | null = null;
      if (validId(input.quote)) {
        const quote = data(await db.from(messages).select("id").eq("id", input.quote).gt("id", cutoff).or(pair).maybeSingle());
        if (!quote) return fail(404, "답장할 메시지를 찾을 수 없습니다.");
        quoteId = quote.id;
      }

      let attachment: { attachment_name: string; attachment_size: number; attachment_path: string } | null = null;
      if (input.attachment != null) {
        const name = text(input.attachment.name).replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 150);
        const base64 = input.attachment.base64;
        if (!name || typeof base64 !== "string" || base64.length > Math.ceil(maxFile / 3) * 4) {
          return fail(400, "파일 크기는 4 MB 이하로 첨부해 주세요.");
        }
        let bytes: Uint8Array;
        try { bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
        catch { return fail(400, "첨부 파일을 확인해 주세요."); }
        if (!bytes.length || bytes.length > maxFile) return fail(400, "파일 크기는 4 MB 이하로 첨부해 주세요.");
        const path = `${viewer}/${peer}/${requestId}`;
        const uploaded = await bucket.upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
        if (uploaded.error && !["409", "Duplicate"].includes(String(uploaded.error.statusCode)) &&
          !/already exists/i.test(uploaded.error.message)) throw uploaded.error;
        attachment = { attachment_name: name, attachment_size: bytes.length, attachment_path: path };
      }
      if (!content && !attachment) return fail(400, "메시지를 입력해 주세요.");
      const savedMessage = await db.from(messages).insert({
        sender_id: viewer, recipient_id: peer, content: content || "파일을 보냈습니다.",
        request_id: requestId, reply_to: quoteId, ...attachment,
      }).select("id").single();
      if (savedMessage.error?.message === "CHAT_BLOCKED") {
        if (attachment) await bucket.remove([attachment.attachment_path]);
        return fail(403, "현재 이 상대에게 메시지를 보낼 수 없습니다.");
      }
      if (savedMessage.error?.code === "23505") {
        const existing = data(await db.from(messages).select("id,recipient_id").eq("sender_id", viewer)
          .eq("request_id", requestId).single());
        return existing.recipient_id === peer ? reply(200, { sent: true, id: existing.id }) : fail(409, "이미 사용한 요청입니다.");
      }
      const savedId = data(savedMessage).id;
      await db.from("kfc_chat_presence").update({ typing_until: null }).eq("user_id", viewer);
      return reply(200, { sent: true, id: savedId });
    }

    let target = null;
    if (validId(input.id)) {
      const flags = await preferences();
      const cutoff = flags.find(p => p.user_id === viewer)?.hidden_through ?? 0;
      target = data(await db.from(messages).select("id,sender_id,content,attachment_path,attachment_name,deleted_at")
        .eq("id", input.id).gt("id", cutoff).or(pair).maybeSingle());
      if (!target || target.deleted_at) return fail(404, "메시지를 찾을 수 없습니다.");
    }

    if (input.action === "report") {
      const reason = text(input.reason);
      if (!reason || reason.length > 500 || (target && target.sender_id !== peer)) {
        return fail(400, "신고할 내용과 사유를 확인해 주세요.");
      }
      data(await db.from("kfc_chat_reports").insert({
        reporter_id: viewer, peer_id: peer, message_id: target?.id, excerpt: target?.content, reason,
      }));
      return reply(200, { ok: true });
    }

    if (!target) return fail(400, "메시지를 선택해 주세요.");
    if (input.action === "download" && target.attachment_path) {
      const file = data(await bucket.download(target.attachment_path));
      return reply(200, { name: target.attachment_name, base64: encode(await file.arrayBuffer()) });
    }
    if (input.action === "react") {
      const emoji = text(input.emoji);
      if (!emojiSet.has(emoji)) return fail(400, "반응을 선택해 주세요.");
      if (input.enabled === true) {
        data(await db.from("kfc_chat_reactions").upsert({
          message_id: target.id, user_id: viewer, emoji,
        }, { onConflict: "message_id,user_id,emoji", ignoreDuplicates: true }));
      } else {
        data(await db.from("kfc_chat_reactions").delete().eq("message_id", target.id).eq("user_id", viewer).eq("emoji", emoji));
      }
      return reply(200, { ok: true });
    }
    if (target.sender_id !== viewer) return fail(403, "내가 보낸 메시지만 수정하거나 삭제할 수 있습니다.");
    if (input.action === "edit") {
      const content = text(input.content);
      if (!content || [...content].length > 2000) return fail(400, "메시지를 2,000자 이내로 입력해 주세요.");
      data(await db.from(messages).update({ content, edited_at: new Date().toISOString() })
        .eq("id", target.id).eq("sender_id", viewer).is("deleted_at", null));
      return reply(200, { ok: true });
    }
    if (input.action === "delete") {
      data(await db.from(messages).update({
        content: "삭제된 메시지입니다.", deleted_at: new Date().toISOString(), attachment_path: null,
        attachment_name: null, attachment_size: null,
      }).eq("id", target.id).eq("sender_id", viewer).is("deleted_at", null));
      if (target.attachment_path) await bucket.remove([target.attachment_path]);
      return reply(200, { ok: true });
    }
    return fail(400, "요청 내용을 확인해 주세요.");
  } catch (error) {
    console.error("Desktop chat request failed", error instanceof Error ? error.name : typeof error);
    return fail(500, "채팅 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
});
