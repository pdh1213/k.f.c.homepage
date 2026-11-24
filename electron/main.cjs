const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, safeStorage, screen, powerMonitor, clipboard, dialog, shell, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { makeApi } = require("./api.cjs");
const { makeSessionStore } = require("./session-store.cjs");
const { makeChatPopup } = require("./chat-popup.cjs");
const { makeMiniChat } = require("./mini-chat.cjs");
const { startAutoUpdates } = require("./updates.cjs");

const index = path.join(__dirname, "..", "desktop-dist", "index.html");
const indexUrl = pathToFileURL(index).href;
const icon = path.join(__dirname, "..", "public", "icon.png");
const loginStore = makeSessionStore(safeStorage, path.join(app.getPath("userData"), "chat-session.bin"));
const api = makeApi(fetch, loginStore);
const maxFile = 4 * 1024 * 1024;
let window;
let updates;
let tray;
let quitting = false;
let memberId;
const startupArgs = ["--startup"];
const startupItem = () => ({ name: "kr.kfcrobot.chat", path: process.execPath, args: startupArgs });
const popup = makeChatPopup({
  BrowserWindow, screen, api, mainWindow: () => window, viewerId: () => memberId,
  openScope(scope) {
    showWindow();
    window?.webContents.send("kfc:open-peer", scope);
  },
});

const mini = makeMiniChat({
  BrowserWindow, screen, api, mainWindow: () => window,
  preferences: path.join(app.getPath("userData"), "mini-chat.pref"),
  openScope(scope) {
    showWindow();
    if (scope) window?.webContents.send("kfc:open-peer", scope);
  },
});

function showMini() {
  popup.reset();
  return mini.setEnabled(true);
}

function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function createTray() {
  const image = nativeImage.createFromPath(icon);
  if (image.isEmpty()) return;
  tray = new Tray(image.resize({ width: 16, height: 16 }));
  tray.setToolTip("K.F.C. Chat");
  tray.on("click", showWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "K.F.C. Chat 열기", click: showWindow },
    { label: "미니 채팅 열기", click: showMini },
    { type: "separator" },
    { label: "앱 완전히 종료", click: () => app.quit() },
  ]));
}

function validScope(scope) {
  if (!scope || typeof scope !== "object") return null;
  const id = scope.room ?? scope.peer;
  if (!Number.isSafeInteger(id) || id < 1 || (scope.room != null && scope.peer != null)) return null;
  return scope.room != null ? { room: id } : { peer: id };
}

function handle(name, fn) {
  ipcMain.handle(`kfc:${name}`, (event, ...args) => {
    if (event.sender !== window?.webContents || event.senderFrame?.url !== indexUrl) {
      return { ok: false, status: 403, message: "허용되지 않은 요청입니다." };
    }
    return fn(...args);
  });
}

handle("login", (username, password) => {
  if (typeof username !== "string" || typeof password !== "string" || username.length > 80 || password.length > 128) {
    return { ok: false, status: 400, message: "아이디와 비밀번호를 확인해 주세요." };
  }
  memberId = undefined;
  popup.logout();
  mini.clear();
  return api.login(username, password);
});
handle("restore", () => api.restore());
handle("logout", () => {
  memberId = undefined;
  popup.logout();
  mini.clear();
  return api.logout();
});
handle("chat", async input => {
  const result = await api.chat(input);
  if (input?.action === "overview") {
    if (result.ok && Number.isSafeInteger(result.data?.self?.id)) {
      memberId = result.data.self.id;
      mini.update(result.data);
    } else if ([401, 403].includes(result.status)) mini.clear();
  }
  return result;
});
handle("startup", enabled => {
  if (process.platform !== "win32" || !app.isPackaged) return false;
  const options = startupItem();
  if (typeof enabled === "boolean") app.setLoginItemSettings({ ...options, openAtLogin: enabled, enabled });
  return app.getLoginItemSettings(options).executableWillLaunchAtLogin;
});
handle("show-mini", showMini);
handle("dismiss-popups", () => popup.reset());
handle("club", async () => { await shell.openExternal("https://kfc-robot-club.vercel.app/"); });
handle("update", () => updates.check(true));
handle("copy", value => {
  if (typeof value === "string" && value.length <= 24_000) clipboard.writeText(value);
});
handle("pick", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: "첨부할 파일 선택", properties: ["openFile"],
  });
  if (canceled || !filePaths[0]) return { ok: true, data: null };
  try {
    const file = await fs.open(filePaths[0], "r");
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size === 0 || stat.size > maxFile) {
        return { ok: false, message: "4 MB 이하의 파일을 선택해 주세요." };
      }
      const buffer = Buffer.alloc(stat.size);
      const { bytesRead } = await file.read(buffer);
      if (bytesRead !== stat.size || (await file.stat()).size !== stat.size) {
        return { ok: false, message: "파일이 변경되었습니다. 다시 선택해 주세요." };
      }
      return { ok: true, data: { name: path.basename(filePaths[0]), size: stat.size, base64: buffer.toString("base64") } };
    } finally { await file.close(); }
  } catch { return { ok: false, message: "첨부 파일을 읽을 수 없습니다." }; }
});

handle("download", async (scope, id) => {
  const target = validScope(scope);
  if (!target || !Number.isSafeInteger(id) || id < 1) return { ok: false, message: "첨부 파일을 확인해 주세요." };
  return saveAttachment(await api.chat({ action: "download", ...target, id }));
});
handle("monitor-download", async (key, id, review) => {
  if (typeof key !== "string" || !Number.isSafeInteger(id) || id < 1 || typeof review !== "string") {
    return { ok: false, message: "첨부 파일을 확인해 주세요." };
  }
  return saveAttachment(await api.chat({ action: "monitor-file", key, id, review }));
});

async function saveAttachment(result) {
  if (!result.ok) return result;
  try {
    const { name, base64 } = result.data;
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: "첨부 파일 저장", defaultPath: path.basename(name).replace(/[<>:"/\\|?*]/g, "_"),
    });
    if (canceled || !filePath) return { ok: true, data: false };
    await fs.writeFile(filePath, Buffer.from(base64, "base64"));
    return { ok: true, data: true };
  } catch { return { ok: false, message: "첨부 파일을 저장할 수 없습니다." }; }
}

handle("notify", (scope, name, after) => {
  const target = validScope(scope);
  if (!mini.visible() && target && typeof name === "string") return popup.offer(target, name.slice(0, 80), after);
});

for (const [name, handler] of Object.entries({
  read: popup.describe, open: popup.open, dismiss: popup.dismiss, next: popup.next, reply: popup.reply, hold: popup.hold,
})) {
  ipcMain.handle("kfc:popup-" + name, (event, ...args) => popup.accepts(event) ? handler(...args) : null);
}

for (const [name, handler] of Object.entries({
  state: mini.snapshot, history: mini.history, send: mini.send, read: mini.read,
  open: mini.open, hide: () => mini.setEnabled(false),
})) {
  ipcMain.handle("kfc:mini-" + name, (event, ...args) => mini.accepts(event) ? handler(...args) : null);
}

function createWindow(startHidden) {
  window = new BrowserWindow({
    width: 1220, height: 820, minWidth: 760, minHeight: 540,
    backgroundColor: "#faf9f5", autoHideMenuBar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false,
      sandbox: true, spellcheck: false, defaultEncoding: "UTF-8", backgroundThrottling: false,
    },
  });
  window.setMenuBarVisibility(false);
  if (!startHidden) window.once("ready-to-show", () => window?.show());
  window.on("focus", () => popup.reset());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => { if (url !== indexUrl) event.preventDefault(); });
  window.loadFile(index);
  window.on("close", event => {
    if (quitting || !tray) return;
    event.preventDefault();
    window.hide();
  });
  window.on("closed", () => { window = undefined; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_event, argv) => {
    if (!argv.includes("--startup")) showWindow();
  });
  app.on("before-quit", event => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    popup.close();
    mini.close();
    void loginStore.flush().finally(() => app.quit());
  });
  app.whenReady().then(() => {
    app.setAppUserModelId("kr.kfcrobot.chat");
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    updates = startAutoUpdates({ app, dialog, getWindow: () => window });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "K.F.C.", submenu: [
        { label: "업데이트 확인", click: () => updates.check(true) },
        { type: "separator" }, { role: "quit", label: "앱 종료" },
      ] }, { label: "보기", submenu: [{ role: "togglefullscreen", label: "전체 화면" }] },
    ]));
    createTray();
    powerMonitor.on("lock-screen", () => { popup.onLock(true); mini.protect("lock", true); });
    powerMonitor.on("unlock-screen", () => { popup.onLock(false); mini.protect("lock", false); });
    powerMonitor.on("suspend", () => { popup.reset(); mini.protect("suspend", true); });
    powerMonitor.on("resume", () => mini.protect("suspend", false));
    createWindow(Boolean(tray) && process.argv.includes("--startup"));
    mini.showIfEnabled();
  });
  app.on("window-all-closed", () => app.quit());
}
