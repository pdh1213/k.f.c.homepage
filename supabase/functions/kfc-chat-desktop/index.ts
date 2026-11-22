import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const messages = "kfc_desktop_messages";
const bucket = db.storage.from("kfc-chat-attachments");
const maxFile = 4 * 1024 * 1024;
const emojiSet = new Set(["👍", "❤️", "😂", "🎉", "😮", "👀"]);
const statuses = new Set(["online", "dnd", "offline"]);
const languages = new Set(["text","javascript","typescript","python","cpp","c","csharp","java","json","bash","html","css","sql","rust","arduino","lua"]);
const systemErrors: Record<string, [number, string]> = {
  CHAT_ROOM_FORBIDDEN: [404, "채팅방에 참여 중인 회원만 이용할 수 있습니다."],
  CHAT_ROOM_OWNER_REQUIRED: [403, "채팅방을 관리할 권한이 없습니다."],
  CHAT_INVALID_INVITE: [400, "초대할 수 있는 동아리원을 선택해 주세요."],
  CHAT_ROOM_LIMIT: [400, "채팅방에는 최대 50명까지 참여할 수 있습니다."],
};
function messageInput(raw: unknown, requested: unknown): { content: string; language: string | null } | Response {
  if (requested != null && (typeof requested !== "string" || !languages.has(requested))) return fail(400, "코드 언어를 확인해 주세요.");
  const language = typeof requested === "string" ? requested : null;
  const content = language && typeof raw === "string" ? raw : text(raw);
  if (content.includes("\x00") || [...content].length > (language ? 12000 : 2000)) {
    return fail(400, language ? "코드는 12,000자 이내로 보내 주세요." : "메시지를 2,000자 이내로 입력해 주세요.");
  }
  if (language && !content.trim()) return fail(400, "보낼 코드를 입력해 주세요.");
  return { content, language };
}
function invites(raw: unknown): number[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 49 || !raw.every(validId)) return null;
  return [...new Set(raw)];
}
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

const webOrigin = "https://kfcchat.vercel.app";

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if ((origin && origin !== webOrigin) || (!origin && request.headers.has("sec-fetch-site"))) {
    return fail(403, "K.F.C. Chat에서 이용해 주세요.");
  }
  if (!origin) return handleChat(request);
  const headers = new Headers({
    "Access-Control-Allow-Origin": webOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Vary": "Origin",
  });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const response = await handleChat(request);
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
});

async function handleChat(request: Request) {
  if (request.method !== "POST") return fail(405, "POST 요청을 사용해 주세요.");
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

    const maxRequest = 5_680_000;
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
      const [overview, rooms] = await Promise.all([
        db.rpc("kfc_chat_overview", { viewer }).then(data),
        db.rpc("kfc_chat_rooms_list", { viewer }).then(data),
      ]);
      return reply(200, { ...overview, rooms, self: { id: viewer, name: self.name, moderator: self.role === "admin" } });
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

    if (input.action === "room-create") {
      const title = text(input.title);
      const invitees = invites(input.invitees);
      if (!title || title.includes("\x00") || [...title].length > 60 || !invitees) {
        return fail(400, "채팅방 이름과 초대할 동아리원을 확인해 주세요.");
      }
      const id = data(await db.rpc("kfc_chat_room_create", { viewer, room_title: title, invitees }));
      return reply(201, { id });
    }

    if (input.room != null && (!validId(input.room) || input.peer != null)) return fail(400, "채팅방을 선택해 주세요.");
    const room = validId(input.room) ? input.room : null;
    const peer = room ? null : input.peer;
    let roomCutoff = 0;
    if (room) {
      const membership = data(await db.from("kfc_chat_room_members")
        .select("visible_after").eq("room_id", room).eq("user_id", viewer).maybeSingle());
      if (!membership) return fail(404, "채팅방에 참여 중인 회원만 이용할 수 있습니다.");
      roomCutoff = membership.visible_after;
      if (input.action === "room-people") {
        const people = data(await db.rpc("kfc_chat_room_people", { viewer, room }));
        return reply(200, { people });
      }
      if (["room-invite", "room-leave", "room-remove"].includes(input.action)) {
        const invitees = invites(input.invitees);
        if (!invitees || (input.action === "room-remove" && (!validId(input.user) || input.user === viewer))) {
          return fail(400, "동아리원을 확인해 주세요.");
        }
        data(await db.rpc("kfc_chat_room_members_update", {
          viewer, room, invitees: input.action === "room-invite" ? invitees : [],
          remove_id: input.action === "room-remove" ? input.user : null, leaving: input.action === "room-leave",
        }));
        return reply(200, { ok: true });
      }
    } else {
      if (!validId(peer) || peer === viewer) return fail(400, "대화 상대를 선택해 주세요.");
      const person = data(await db.from("users").select("id").eq("id", peer).eq("status", "approved").maybeSingle());
      if (!person) return fail(404, "이 대화 상대를 찾을 수 없습니다.");
    }
    const pair = `and(sender_id.eq.${viewer},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${viewer})`;

    if (input.action === "history" || input.action === "search") {
      const search = input.action === "search" ? text(input.query).slice(0, 100) : null;
      if (search === "") return reply(200, { messages: [], older: false });
      const history = data(await db.rpc("kfc_chat_history_scope", {
        viewer, peer, room_key: room, before_id: validId(input.before) ? input.before : null, search_text: search,
      }));
      return reply(200, history);
    }

    if (input.action === "typing") {
      data(await db.from("kfc_chat_presence").update({
        typing_peer: peer, typing_room: room, typing_until: new Date(Date.now() + 5500).toISOString(),
      }).eq("user_id", viewer).eq("mode", "online"));
      return reply(200, { ok: true });
    }

    if (input.action === "preference") {
      const field = text(input.field);
      const fields = room ? ["pinned", "muted", "read"] : ["pinned", "muted", "blocked", "clear", "read"];
      if (!fields.includes(field)) return fail(400, "설정을 확인해 주세요.");
      const options = { viewer, field, enabled: input.enabled === true, through: validId(input.through) ? input.through : 0 };
      data(await (room ? db.rpc("kfc_chat_room_prefs", { ...options, room })
        : db.rpc("kfc_chat_preferences_update", { ...options, peer })));
      return reply(200, { ok: true });
    }

    const preferences = async () => room ? [] : data(await db.from("kfc_chat_preferences")
      .select("user_id,blocked,hidden_through")
      .or(`and(user_id.eq.${viewer},peer_id.eq.${peer}),and(user_id.eq.${peer},peer_id.eq.${viewer})`));
    const belongs = (row: { recipient_id: number | null; room_id: number | null }) =>
      row.recipient_id === peer && row.room_id === room;

    if (input.action === "send") {
      const requestId = text(input.requestId).toLowerCase();
      if (!uuid.test(requestId)) return fail(400, "메시지 요청을 확인해 주세요.");
      const saved = data(await db.from(messages).select("id,recipient_id,room_id").eq("sender_id", viewer)
        .eq("request_id", requestId).maybeSingle());
      if (saved) return belongs(saved) ? reply(200, { sent: true, id: saved.id }) : fail(409, "이미 사용한 요청입니다.");
      const flags = await preferences();
      if (flags.some(p => p.blocked)) return fail(403, "현재 이 상대에게 메시지를 보낼 수 없습니다.");
      const cutoff = room ? roomCutoff : flags.find(p => p.user_id === viewer)?.hidden_through ?? 0;
      const parsed = messageInput(input.content, input.codeLanguage);
      if (parsed instanceof Response) return parsed;
      const { content, language } = parsed;
      let quoteId: number | null = null;
      if (validId(input.quote)) {
        const lookup = db.from(messages).select("id").eq("id", input.quote).gt("id", cutoff);
        const quote = data(await (room ? lookup.eq("room_id", room) : lookup.or(pair)).maybeSingle());
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
        const path = `${viewer}/${room ? "room-" + room : peer}/${requestId}`;
        const uploaded = await bucket.upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
        if (uploaded.error && !["409", "Duplicate"].includes(String(uploaded.error.statusCode)) &&
          !/already exists/i.test(uploaded.error.message)) throw uploaded.error;
        attachment = { attachment_name: name, attachment_size: bytes.length, attachment_path: path };
      }
      if (!content && !attachment) return fail(400, "메시지를 입력해 주세요.");
      const savedMessage = await db.from(messages).insert({
        sender_id: viewer, recipient_id: peer, room_id: room, content: content || "파일을 보냈습니다.",
        request_id: requestId, reply_to: quoteId, code_language: language, ...attachment,
      }).select("id").single();
      if (savedMessage.error?.message === "CHAT_ROOM_FORBIDDEN") {
        if (attachment) await bucket.remove([attachment.attachment_path]);
        return fail(...systemErrors.CHAT_ROOM_FORBIDDEN);
      }
      if (savedMessage.error?.message === "CHAT_BLOCKED") {
        if (attachment) await bucket.remove([attachment.attachment_path]);
        return fail(403, "현재 이 상대에게 메시지를 보낼 수 없습니다.");
      }
      if (savedMessage.error?.code === "23505") {
        const existing = data(await db.from(messages).select("id,recipient_id,room_id").eq("sender_id", viewer)
          .eq("request_id", requestId).single());
        return belongs(existing) ? reply(200, { sent: true, id: existing.id }) : fail(409, "이미 사용한 요청입니다.");
      }
      const savedId = data(savedMessage).id;
      await db.from("kfc_chat_presence").update({ typing_until: null }).eq("user_id", viewer);
      return reply(200, { sent: true, id: savedId });
    }

    let target = null;
    if (validId(input.id)) {
      const flags = await preferences();
      const cutoff = room ? roomCutoff : flags.find(p => p.user_id === viewer)?.hidden_through ?? 0;
      const lookup = db.from(messages).select("id,sender_id,content,code_language,attachment_path,attachment_name,deleted_at")
        .eq("id", input.id).gt("id", cutoff);
      target = data(await (room ? lookup.eq("room_id", room) : lookup.or(pair)).maybeSingle());
      if (!target || target.deleted_at) return fail(404, "메시지를 찾을 수 없습니다.");
    }

    if (input.action === "report") {
      const reason = text(input.reason);
      if (!reason || reason.length > 500 || (room && !target) || target?.sender_id === viewer) {
        return fail(400, "신고할 내용과 사유를 확인해 주세요.");
      }
      data(await db.from("kfc_chat_reports").insert({
        reporter_id: viewer, peer_id: target?.sender_id ?? peer, message_id: target?.id, excerpt: target?.content, reason,
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
      const parsed = messageInput(input.content, input.codeLanguage === undefined ? target.code_language : input.codeLanguage);
      if (parsed instanceof Response) return parsed;
      if (!parsed.content) return fail(400, "메시지를 입력해 주세요.");
      data(await db.from(messages).update({ content: parsed.content, code_language: parsed.language, edited_at: new Date().toISOString() })
        .eq("id", target.id).eq("sender_id", viewer).is("deleted_at", null));
      return reply(200, { ok: true });
    }
    if (input.action === "delete") {
      data(await db.from(messages).update({
        content: "삭제된 메시지입니다.", deleted_at: new Date().toISOString(), attachment_path: null,
        attachment_name: null, attachment_size: null, code_language: null,
      }).eq("id", target.id).eq("sender_id", viewer).is("deleted_at", null));
      if (target.attachment_path) await bucket.remove([target.attachment_path]);
      return reply(200, { ok: true });
    }
    return fail(400, "요청 내용을 확인해 주세요.");
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? error.message : "";
    if (typeof message === "string" && Object.hasOwn(systemErrors, message)) return fail(...systemErrors[message]);
    console.error("Desktop chat request failed", error instanceof Error ? error.name : typeof error);
    return fail(500, "채팅 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
