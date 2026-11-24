const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { readFileSync, writeFileSync, mkdirSync } = require("node:fs");

const page = path.join(__dirname, "popup", "mini.html");
const pageUrl = pathToFileURL(page).href;
const width = 342;
const height = 460;

function makeMiniChat({ BrowserWindow, screen, api, preferences, mainWindow, openScope }) {
  let enabled = false;
  try { enabled = readFileSync(preferences, "utf8").trim() === "on"; } catch {}
  let win, bounds, account;
  let locked = false, suspended = false, ready = false, epoch = 0;
  let targets = new Map();

  const visible = () => Boolean(win?.isVisible());
  const accepts = event => Boolean(win && event.sender === win.webContents && event.senderFrame?.url === pageUrl);
  const snapshot = () => ({ account, visible: visible(), targets: [...targets.values()].map(({ scope, ...row }) => row) });
  function publish() { if (ready) win.webContents.send("kfc:mini-state", snapshot()); }
  function clear() {
    epoch++;
    account = undefined;
    targets.clear();
    publish();
  }
  function update(overview) {
    if (!overview?.self?.id || locked || suspended) return;
    if (account?.id !== overview.self.id) epoch++;
    account = { id: overview.self.id, name: overview.self.name };
    const chats = new Map(overview.chats?.map(row => [row.peer_id, row]));
    targets = new Map();
    for (const person of overview.friends ?? []) {
      const thread = chats.get(person.id);
      const key = "d:" + person.id;
      targets.set(key, { key, scope: { peer: person.id }, label: person.name, unread: thread?.unread ?? 0,
        preview: thread?.content ?? "", activity: thread?.created_at ?? "", blocked: Boolean(person.blocked || person.blocked_by) });
    }
    for (const room of overview.rooms ?? []) {
      const key = "r:" + room.id;
      targets.set(key, { key, scope: { room: room.id }, label: room.title, unread: room.unread,
        preview: room.content ?? "", activity: room.updated_at ?? "", blocked: false });
    }
    publish();
  }

  function create() {
    const area = screen.getDisplayMatching(bounds ?? mainWindow()?.getBounds() ?? screen.getPrimaryDisplay().bounds).workArea;
    const x = Math.max(area.x, Math.min(area.x + area.width - width, bounds?.x ?? area.x + area.width - width - 18));
    const y = Math.max(area.y, Math.min(area.y + area.height - height, bounds?.y ?? area.y + area.height - height - 18));
    const current = new BrowserWindow({
      x, y, width, height, show: false, alwaysOnTop: true, skipTaskbar: true, autoHideMenuBar: true,
      frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
      backgroundColor: "#faf9f5",
      webPreferences: { preload: path.join(__dirname, "mini-preload.cjs"), contextIsolation: true,
        nodeIntegration: false, sandbox: true, backgroundThrottling: false },
    });
    win = current;
    current.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    current.webContents.on("will-navigate", event => event.preventDefault());
    current.on("closed", () => { win = undefined; ready = false; });
    current.on("show", publish);
    current.on("hide", publish);
    current.on("move", () => { bounds = current.getBounds(); });
    void current.loadFile(page).then(() => {
      if (win !== current) return;
      ready = true;
      publish();
      if (enabled && !locked && !suspended) current.showInactive();
    }).catch(() => { if (win === current) current.destroy(); });
  }
  function showIfEnabled() {
    if (!enabled || locked || suspended) return;
    if (!win) create();
    else if (ready) win.showInactive();
  }
  function setEnabled(value) {
    if (typeof value !== "boolean" || enabled === value) return enabled;
    mkdirSync(path.dirname(preferences), { recursive: true });
    writeFileSync(preferences, value ? "on" : "off");
    enabled = value;
    if (enabled) showIfEnabled();
    else win?.hide();
    return enabled;
  }
  function protect(kind, value) {
    if (kind === "lock") locked = value;
    else suspended = value;
    if (value) { win?.hide(); clear(); }
    else showIfEnabled();
  }
  function close() { win?.destroy(); }

  const unavailable = { ok: false, message: "대화를 이용할 수 없어요. 다시 연결해 주세요." };
  async function conversation(key, action, parameters = {}) {
    const target = targets.get(key);
    if (!visible() || !account || !target || locked || suspended) return unavailable;
    const generation = epoch;
    const result = await api.chat({ action, ...target.scope, ...parameters });
    if (generation !== epoch || !visible() || !targets.has(key)) return unavailable;
    return result;
  }
  function send(key, text, requestId) {
    const content = typeof text === "string" ? text.trim() : "";
    if (!content || [...content].length > 2000 || typeof requestId !== "string" ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestId)) {
      return { ok: false, message: "메시지를 2,000자 이내로 입력해 주세요." };
    }
    if (targets.get(key)?.blocked) return { ok: false, message: "이 상대에게 메시지를 보낼 수 없어요." };
    return conversation(key, "send", { requestId, content });
  }
  function read(key, through) {
    if (!win?.isFocused() || !Number.isSafeInteger(through) || through < 1) return;
    return conversation(key, "preference", { field: "read", through });
  }
  function open(key) { if (!locked && !suspended) openScope(targets.get(key)?.scope); }
  return { accepts, visible, update, clear, protect, close, showIfEnabled, setEnabled, snapshot, send, read, open,
    history: key => conversation(key, "history") };
}
module.exports = { makeMiniChat };
