const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { makeMiniChat } = require("../electron/mini-chat.cjs");

test("mini chat persists its setting, routes only known recipients, and clears data on lock", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "kfc-mini-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let window;
  const calls = [], opened = [];
  class Window extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler() {}, send() {} });
      window = this;
    }
    async loadFile(file) { this.file = file; }
    showInactive() { this.shown = true; this.emit("show"); }
    hide() { this.shown = false; this.emit("hide"); }
    destroy() { this.hide(); this.emit("closed"); }
    isVisible() { return this.shown; }
    isFocused() { return this.focused; }
  }
  const options = {
    BrowserWindow: Window, preferences: path.join(directory, "mini.pref"),
    mainWindow: () => ({ getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }) }),
    screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 800, height: 600 } }) },
    api: { chat: async input => { calls.push(input); return { ok: true }; } },
    openScope: scope => opened.push(scope),
  };
  const overview = { self: { id: 1, name: "나" }, friends: [{ id: 2, name: "친구" }, { id: 3, name: "차단", blocked: true }],
    chats: [{ peer_id: 2, unread: 2, content: "새 메시지", created_at: "2026-11-23T00:00:00Z" }],
    rooms: [{ id: 2, title: "로봇팀", unread: 1, content: "조립", updated_at: "2026-11-23T00:00:00Z" }] };
  const id = "00000000-0000-4000-8000-000000000000";
  const mini = makeMiniChat(options);
  mini.showIfEnabled();
  assert.equal(window, undefined);
  mini.enterBackground();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mini.visible(), true);
  mini.leaveBackground();
  assert.equal(mini.visible(), false);
  mini.enterBackground();
  mini.setEnabled(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mini.visible(), true);
  assert.equal(window.options.alwaysOnTop, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(mini.accepts({ sender: window.webContents, senderFrame: { url: pathToFileURL(window.file).href } }), true);
  assert.equal(mini.accepts({ sender: window.webContents, senderFrame: { url: "https://kfcchat.vercel.app" } }), false);
  mini.update(overview);
  assert.equal(mini.snapshot().targets.find(row => row.key === "d:2").unread, 2);
  assert.equal((await mini.send("d:2", " 직접 답장 ", id)).ok, true);
  assert.equal((await mini.send("r:2", "그룹 답장", id)).ok, true);
  assert.equal((await mini.send("d:3", "차단된 상대", id)).ok, false);
  assert.equal((await mini.send("r:555", "초대받지 않은 방", id)).ok, false);
  assert.equal(calls[0].peer, 2);
  assert.equal(calls[0].content, "직접 답장");
  assert.equal(calls[1].room, 2);
  assert.equal(mini.read("d:2", 17), undefined);
  window.focused = true;
  await mini.read("d:2", 17);
  assert.equal(calls[2].through, 17);
  mini.open("r:2");
  assert.deepEqual(opened[0], { room: 2 });
  mini.protect("lock", true);
  mini.update(overview);
  assert.equal(mini.visible(), false);
  assert.deepEqual(mini.snapshot().targets, []);
  assert.equal((await mini.send("d:2", "잠금 중", id)).ok, false);
  mini.protect("lock", false);
  assert.equal(mini.visible(), true);
  mini.close();
  const restarted = makeMiniChat(options);
  restarted.showIfEnabled();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restarted.visible(), true);
  restarted.setEnabled(false);
  assert.equal(restarted.visible(), false);
  restarted.leaveBackground();
  restarted.enterBackground();
  assert.equal(restarted.visible(), false);
});
