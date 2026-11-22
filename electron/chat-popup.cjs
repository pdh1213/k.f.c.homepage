const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");

const layout = { width: 380, height: 232, gap: 12 };
const page = path.join(__dirname, "popup", "index.html");
const pageUrl = pathToFileURL(page).href;
const limit = 8;
const span = 13_000;

function makeChatPopup({ BrowserWindow, screen, api, mainWindow, viewerId, openScope }) {
  const entries = new Map();
  const seen = new Map();
  const avatars = new Map();
  let popup;
  let ready = false;
  let active;
  let expires;
  let paused = false;
  let locked = false;
  let generation = 0;
  let retries = new Map();
  let sending = false;

  function accepts(event) {
    return Boolean(popup && event.sender === popup.webContents && event.senderFrame?.url === pageUrl);
  }

  function describe() {
    const entry = active && entries.get(active);
    if (!entry) return null;
    return { ...entry.card, count: entries.size, sending: Boolean(sending) };
  }

  function reset() {
    generation++;
    entries.clear();
    retries.clear();
    active = undefined;
    paused = false;
    sending = false;
    clearTimeout(expires);
    if (popup && !popup.isDestroyed()) {
      popup.webContents.send("kfc:popup-state", null);
      popup.hide();
    }
  }

  function close() {
    reset();
    if (popup && !popup.isDestroyed()) popup.destroy();
  }

  function onLock(value) {
    locked = value;
    if (value) reset();
  }

  function place() {
    const area = screen.getDisplayMatching(mainWindow()?.getBounds() ?? screen.getPrimaryDisplay().bounds).workArea;
    popup.setPosition(area.x + Math.max(0, area.width - layout.width - layout.gap),
      area.y + Math.max(0, area.height - layout.height - layout.gap));
  }

  function restartTimer() {
    clearTimeout(expires);
    if (!active || paused || sending || popup?.isFocused()) return;
    const id = entries.get(active)?.card.id;
    expires = setTimeout(() => dismiss(id), span);
    expires.unref?.();
  }

  function ensureWindow() {
    if (popup && !popup.isDestroyed()) return;
    popup = new BrowserWindow({
      width: layout.width, height: layout.height, show: false, frame: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true, resizable: false, maximizable: false, minimizable: false,
      fullscreenable: false, hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, "popup-preload.cjs"), contextIsolation: true,
        nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false,
      },
    });
    popup.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    popup.webContents.on("will-navigate", event => event.preventDefault());
    popup.on("close", event => { event.preventDefault(); reset(); });
    popup.on("closed", () => { popup = undefined; ready = false; });
    popup.on("focus", restartTimer);
    popup.on("blur", restartTimer);
    const current = popup;
    void current.loadFile(page).then(() => {
      if (popup !== current || current.isDestroyed()) return;
      ready = true;
      publish();
    }).catch(() => {
      if (popup === current && !current.isDestroyed()) current.destroy();
    });
  }

  function publish() {
    const card = describe();
    if (!card) {
      if (popup && !popup.isDestroyed()) {
        popup.webContents.send("kfc:popup-state", null);
        popup.hide();
      }
      return;
    }
    ensureWindow();
    if (!ready) return;
    popup.webContents.send("kfc:popup-state", card);
    if (!popup.isVisible()) {
      place();
      popup.showInactive();
    }
    restartTimer();
  }

  async function offer(scope, title, after) {
    const viewer = viewerId();
    if (!viewer || locked || mainWindow()?.isFocused()) return;
    const started = generation;
    const key = scope.room ? "r:" + scope.room : "d:" + scope.peer;
    const response = await api.chat({ action: "history", ...scope });
    if (generation !== started || viewerId() !== viewer || locked || mainWindow()?.isFocused() || !response.ok) return;
    const baseline = Math.max(Number.isSafeInteger(after) ? after : 0, seen.get(key) ?? 0);
    const message = response.data?.messages?.findLast(item => item.id > baseline && item.sender_id !== viewer && !item.deleted_at);
    if (!message) return;
    seen.set(key, message.id);
    if (seen.size > 200) seen.delete(seen.keys().next().value);
    const old = entries.get(key);
    const avatar = avatars.get(message.sender_id);
    if (old) retries.delete(old.card.id);
    const sender = typeof message.sender_name === "string" ? message.sender_name.slice(0, 80) : title;
    const content = message.code_language ? "코드 메시지를 보냈어요." : String(message.content ?? "");
    entries.set(key, { scope, messageId: message.id, card: {
      id: key + ":" + message.id, thread: key, title, sender, avatar, text: content.slice(0, 280), time: message.created_at,
    } });
    if (!active) active = key;
    if (entries.size > limit) {
      const dropped = [...entries.keys()].find(item => item !== active);
      if (dropped) { retries.delete(entries.get(dropped).card.id); entries.delete(dropped); }
    }
    publish();
    if (avatar === undefined && Number.isSafeInteger(message.sender_id)) {
      void api.chat({ action: "avatars", ids: [message.sender_id] }).then(result => {
        if (started !== generation || viewerId() !== viewer || !result.ok) return;
        const raw = result.data?.people?.find(person => person.id === message.sender_id)?.avatar_data;
        const photo = typeof raw === "string" && raw.length <= 32791 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(raw) ? raw : null;
        avatars.set(message.sender_id, photo);
        if (avatars.size > 75) avatars.delete(avatars.keys().next().value);
        const entry = entries.get(key);
        if (entry?.messageId === message.id && photo) {
          entry.card.avatar = photo;
          if (active === key) publish();
        }
      }).catch(() => {});
    }
  }

  function dismiss(id) {
    if (sending) return;
    const entry = active && entries.get(active);
    if (!entry || entry.card.id !== id) return;
    retries.delete(id);
    entries.delete(active);
    active = entries.keys().next().value;
    paused = false;
    publish();
  }

  function next(id) {
    const entry = active && entries.get(active);
    if (sending || !entry || entry.card.id !== id || entries.size < 2) return;
    entries.delete(active);
    entries.set(active, entry);
    active = entries.keys().next().value;
    publish();
  }

  function open(id) {
    const entry = active && entries.get(active);
    if (!entry || entry.card.id !== id) return;
    const scope = entry.scope;
    reset();
    openScope(scope);
  }

  async function reply(id, text) {
    const entry = active && entries.get(active);
    const content = typeof text === "string" ? text.trim() : "";
    if (locked || !entry || entry.card.id !== id || !content || [...content].length > 2000 || sending) {
      return { ok: false, message: "보낼 메시지와 대화를 확인해 주세요." };
    }
    const started = generation;
    let pending = retries.get(id);
    if (!pending || pending.content !== content) {
      pending = { content, requestId: randomUUID() };
      retries.set(id, pending);
    }
    const operation = {};
    sending = operation;
    publish();
    let result;
    try {
      result = await api.chat({ action: "send", ...entry.scope, content, requestId: pending.requestId });
    } catch { result = { ok: false, message: "메시지를 보내지 못했어요. 다시 시도해 주세요." }; }
    finally { if (sending === operation) sending = false; }
    if (started !== generation) return result;
    if (result.ok) {
      void api.chat({ action: "preference", ...entry.scope, field: "read", through: entry.messageId });
      dismiss(id);
    }
    publish();
    return result;
  }

  function hold(value) {
    paused = value === true;
    restartTimer();
  }

  function logout() {
    reset();
    seen.clear();
    avatars.clear();
  }

  return { accepts, describe, offer, dismiss, next, open, reply, hold, reset, close, onLock, logout };
}

module.exports = { makeChatPopup };
