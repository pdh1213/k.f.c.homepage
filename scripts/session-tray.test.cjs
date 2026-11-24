const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { makeSessionStore } = require("../electron/session-store.cjs");
const { makeApi } = require("../electron/api.cjs");

function encryption() {
  const key = randomBytes(32);
  return {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async value => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      return Buffer.concat([iv, cipher.update(value, "utf8"), cipher.final(), cipher.getAuthTag()]);
    },
    decryptStringAsync: async buffer => {
      const decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12));
      decipher.setAuthTag(buffer.subarray(-16));
      return { result: decipher.update(buffer.subarray(12, -16), undefined, "utf8") + decipher.final("utf8"), shouldReEncrypt: false };
    },
  };
}

test("a new app process restores encrypted sessions and saves rotated refresh tokens", async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "kfc-session-test-"));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const file = path.join(folder, "session.bin");
  const crypto = encryption();
  const fetch = async (url, input) => {
    if (url.endsWith("/auth/login")) return Response.json({ session: { access_token: "first-access", refresh_token: "first-refresh" } });
    if (url.includes("refresh_token")) {
      assert.equal(JSON.parse(input.body).refresh_token, "first-refresh");
      return Response.json({ access_token: "new-access", refresh_token: "new-refresh" });
    }
    if (url.includes("/logout")) return Response.json({});
    return input.headers.authorization === "Bearer new-access" ? Response.json({ verified: true }) : Response.json({}, { status: 401 });
  };
  const first = makeApi(fetch, makeSessionStore(crypto, file));
  assert.equal((await first.login("qa", "unused-fixture")).ok, true);
  assert.equal((await fs.readFile(file)).includes(Buffer.from("first-refresh")), false);

  const next = makeApi(fetch, makeSessionStore(crypto, file));
  assert.deepEqual(await next.restore(), { ok: true, data: true });
  assert.equal((await next.chat({ action: "overview" })).data.verified, true);
  assert.equal((await makeSessionStore(crypto, file).load()).refresh_token, "new-refresh");

  const third = makeApi(fetch, makeSessionStore(crypto, file));
  await third.restore();
  await third.logout();
  assert.equal((await makeApi(fetch, makeSessionStore(crypto, file)).restore()).data, false);
  await assert.rejects(fs.stat(file), { code: "ENOENT" });
});

test("closing the main window keeps the tray and the native reply popup", async () => {
  const handlers = new Map();
  const events = [];
  let openWindow;
  let trayItems;
  let otherWindow;
  let miniBackground = 0;
  const sent = [];
  const powerMonitor = new EventEmitter();
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.visible = true;
      this.focused = true;
      this.webContents = Object.assign(new EventEmitter(), {
        send: (event, payload) => events.push({ event, payload }),
        setWindowOpenHandler() {},
      });
      if (!openWindow) openWindow = this;
      else { otherWindow = this; this.visible = false; this.focused = false; }
    }
    setMenuBarVisibility() {}
    async loadFile(file) { this.file = file; }
    getBounds() { return { x: 0, y: 0, width: 800, height: 600 }; }
    setPosition(x, y) { this.position = [x, y]; }
    isVisible() { return this.visible; }
    showInactive() { this.visible = true; }
    destroy() { this.visible = false; this.emit("closed"); }
    hide() { this.visible = false; this.focused = false; }
    show() { this.visible = true; }
    focus() { this.focused = true; }
    isFocused() { return this.focused; }
    isDestroyed() { return false; }
    isMinimized() { return false; }
  }
  class Tray extends EventEmitter {
    setToolTip() {}
    setContextMenu(items) { trayItems = items; }
  }
  const app = Object.assign(new EventEmitter(), {
    getPath: () => os.tmpdir(),
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    setAppUserModelId() {},
    quit() {
      let cancelled = false;
      this.emit("before-quit", { preventDefault: () => { cancelled = true; } });
      if (!cancelled) events.push({ event: "quit" });
    },
  });
  const fake = {
    app, BrowserWindow: Window, Tray, powerMonitor,
    screen: { getDisplayMatching: () => ({ workArea: { x: -1024, y: 0, width: 1024, height: 680 } }) },
    nativeImage: { createFromPath: () => ({ isEmpty: () => false, resize: () => ({}) }) },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    Menu: { buildFromTemplate: items => items, setApplicationMenu() {} },
    session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  };
  const root = path.resolve(__dirname, "../electron");
  const source = await fs.readFile(path.join(root, "main.cjs"), "utf8");
  vm.runInNewContext(source, {
    __dirname: root,
    fetch, process,
    require: name => {
      if (name === "electron") return fake;
      if (name === "./api.cjs") return { makeApi: () => ({ chat: async input => {
        if (input.action === "overview") return { ok: true, data: { self: { id: 1 } } };
        if (input.action === "avatars") return { ok: true, data: { people: [] } };
        if (input.action === "history") return { ok: true, data: { messages: [
          { id: 11, sender_id: 2, sender_name: "테스트 발신자", content: "방금 도착한 메시지", created_at: "2026-11-22T11:00:00Z" },
          { id: 12, sender_id: 1, sender_name: "나", content: "내 메시지" },
        ] } };
        sent.push(input);
        return { ok: true, data: null };
      } }) };
      if (name === "./mini-chat.cjs") return { makeMiniChat: () => ({
        visible: () => false, update() {}, clear() {}, close() {}, showIfEnabled() {}, protect() {},
        enterBackground() { miniBackground++; }, leaveBackground() {},
      }) };
      if (name === "./chat-popup.cjs") return require("../electron/chat-popup.cjs");
      if (name === "./updates.cjs") return { startAutoUpdates: () => ({}) };
      if (name === "./session-store.cjs") return { makeSessionStore: () => ({ flush: () => Promise.resolve() }) };
      return require(name);
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(openWindow.options.webPreferences.backgroundThrottling, false);
  let prevented = false;
  openWindow.emit("close", { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(openWindow.visible, false);
  assert.equal(miniBackground, 1);

  const from = window => ({ sender: window.webContents, senderFrame: { url: pathToFileURL(window.file).href } });
  await handlers.get("kfc:chat")(from(openWindow), { action: "overview" });
  await handlers.get("kfc:notify")(from(openWindow), { room: 4 }, "테스트 방", 10);
  const state = handlers.get("kfc:popup-read")(from(otherWindow));
  assert.equal(otherWindow.visible, true);
  assert.equal(otherWindow.isFocused(), false);
  assert.equal(otherWindow.options.alwaysOnTop, true);
  assert.equal(state.sender, "테스트 발신자");
  assert.equal(state.text, "방금 도착한 메시지");
  assert.equal(handlers.get("kfc:popup-reply")(from(openWindow), state.id, "unauthorized"), null);
  assert.equal((await handlers.get("kfc:popup-reply")(from(otherWindow), state.id, " 확인했어요 ")).ok, true);
  assert.equal(sent[0].action, "send");
  assert.equal(sent[0].room, 4);
  assert.equal(sent[0].content, "확인했어요");
  assert.equal(otherWindow.visible, false);
  await handlers.get("kfc:notify")(from(openWindow), { room: 5 }, "다음 방", 10);
  const next = handlers.get("kfc:popup-read")(from(otherWindow));
  handlers.get("kfc:popup-open")(from(otherWindow), next.id);
  assert.equal(openWindow.visible, true);
  assert.equal(events.find(item => item.event === "kfc:open-peer")?.payload.room, 5);
  openWindow.hide();
  powerMonitor.emit("lock-screen");
  await handlers.get("kfc:notify")(from(openWindow), { room: 6 }, "Windows 잠금", 10);
  assert.equal(otherWindow.visible, false);
  powerMonitor.emit("unlock-screen");

  trayItems.at(-1).click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1).event, "quit");
});
