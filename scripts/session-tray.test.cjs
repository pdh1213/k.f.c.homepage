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

test("closing the window keeps the tray and notifications can reopen the conversation", async () => {
  const handlers = new Map();
  const events = [];
  let openWindow;
  let trayItems;
  let popup;
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.visible = true;
      this.focused = true;
      this.webContents = Object.assign(new EventEmitter(), {
        send: (event, scope) => events.push({ event, room: scope.room }),
        setWindowOpenHandler() {},
      });
      openWindow = this;
    }
    setMenuBarVisibility() {}
    loadFile(file) { this.file = file; }
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
  class Notification extends EventEmitter {
    static isSupported() { return true; }
    constructor(options) { super(); this.options = options; popup = this; }
    show() { this.shown = true; }
    close() { this.emit("close"); }
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
    app, BrowserWindow: Window, Tray, Notification,
    nativeImage: { createFromPath: () => ({ isEmpty: () => false, resize: () => ({}) }) },
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    Menu: { buildFromTemplate: items => items, setApplicationMenu() {} },
    session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  };
  const root = path.resolve(__dirname, "../electron");
  const source = await fs.readFile(path.join(root, "main.cjs"), "utf8");
  vm.runInNewContext(source, {
    __dirname: root,
    fetch,
    require: name => {
      if (name === "electron") return fake;
      if (name === "./api.cjs") return { makeApi: () => ({}) };
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

  handlers.get("kfc:notify")({ sender: openWindow.webContents, senderFrame: { url: pathToFileURL(openWindow.file).href } }, { room: 4 }, "테스트 방");
  assert.equal(popup.shown, true);
  assert.equal(popup.options.title, "테스트 방");
  popup.emit("click");
  assert.equal(openWindow.visible, true);
  assert.deepEqual(events[0], { event: "kfc:open-peer", room: 4 });

  trayItems.at(-1).click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.at(-1).event, "quit");
});
