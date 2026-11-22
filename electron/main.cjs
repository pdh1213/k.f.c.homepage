const { app, BrowserWindow, ipcMain, Menu, Notification, clipboard, dialog, shell, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { makeApi } = require("./api.cjs");
const { startAutoUpdates } = require("./updates.cjs");

const index = path.join(__dirname, "..", "desktop-dist", "index.html");
const indexUrl = pathToFileURL(index).href;
const api = makeApi();
const maxFile = 4 * 1024 * 1024;
let window;
let updates;

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
  return api.login(username, password);
});
handle("logout", () => api.logout());
handle("chat", input => api.chat(input));
handle("club", async () => { await shell.openExternal("https://kfc-robot-club.vercel.app/"); });
handle("update", () => updates.check(true));
handle("copy", value => {
  if (typeof value === "string" && value.length <= 12_000) clipboard.writeText(value);
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

handle("download", async (peer, id) => {
  const result = await api.chat({ action: "download", peer, id });
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
});

handle("notify", (peer, name) => {
  if (window?.isFocused() || !Notification.isSupported() || !Number.isSafeInteger(peer) || typeof name !== "string") return;
  const notification = new Notification({ title: name.slice(0, 60), body: "K.F.C. Chat에 새 메시지가 도착했습니다." });
  notification.on("click", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    window.webContents.send("kfc:open-peer", peer);
  });
  notification.show();
});

function createWindow() {
  window = new BrowserWindow({
    width: 1220, height: 820, minWidth: 760, minHeight: 540,
    backgroundColor: "#faf9f5", autoHideMenuBar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false,
      sandbox: true, spellcheck: false, defaultEncoding: "UTF-8",
    },
  });
  window.setMenuBarVisibility(false);
  window.once("ready-to-show", () => window?.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => { if (url !== indexUrl) event.preventDefault(); });
  window.loadFile(index);
  window.on("closed", () => { window = undefined; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
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
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
