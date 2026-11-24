const api = window.miniChat;
const el = id => document.getElementById(id);
const select = el("target"), history = el("history"), draft = el("draft"), form = el("compose");
const drafts = new Map(), retries = new Map(), lastRead = new Map();
const formatter = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });
let account, targets = [], selected = "", shown = "", optionsKey = "", inboxKey = "";
let isVisible = false;
let fetching = false, sending = false, generation = 0;

function notice(value) {
  el("notice").textContent = value;
  el("notice").hidden = !value;
}

function setSelection(key) {
  if (selected) drafts.set(selected, draft.value);
  el("new-count").hidden = !key || !el("total").textContent;
  selected = key;
  generation++;
  select.value = key;
  draft.value = drafts.get(key) ?? "";
  shown = "";
  history.replaceChildren();
  notice("");
  refreshControls();
  void refreshHistory();
}

function refreshControls() {
  const target = targets.find(row => row.key === selected);
  history.hidden = !target;
  el("inbox").hidden = Boolean(target);
  el("back").hidden = !target;
  form.hidden = !target;
  draft.readOnly = sending;
  draft.disabled = Boolean(target?.blocked);
  el("send").disabled = !target || target.blocked || sending || !draft.value.trim();
}

function render(state) {
  if (account?.id !== state.account?.id) {
    drafts.clear();
    retries.clear();
    lastRead.clear();
    selected = "";
    draft.value = "";
    generation++;
    shown = "";
    history.replaceChildren();
    notice("");
  }
  const opened = state.visible && !isVisible;
  isVisible = state.visible;
  account = state.account;
  targets = state.targets;
  const nextOptions = JSON.stringify(targets.map(row => [row.key, row.label]));
  if (optionsKey !== nextOptions) {
    optionsKey = nextOptions;
    const groups = ["친구", "채팅방"].map(label => Object.assign(document.createElement("optgroup"), { label }));
    for (const row of targets) groups[row.key.startsWith("r:") ? 1 : 0].append(new Option(row.label, row.key));
    select.replaceChildren(new Option("친구 또는 채팅방 선택", ""), ...groups.filter(group => group.children.length));
  }
  select.disabled = !account || !targets.length;
  if (selected && !targets.some(row => row.key === selected)) setSelection("");
  select.value = selected;
  const unread = targets.filter(row => row.unread > 0).sort((a,b) => b.activity.localeCompare(a.activity));
  const nextInbox = JSON.stringify(unread);
  if (inboxKey !== nextInbox) {
    inboxKey = nextInbox;
    el("threads").replaceChildren(...unread.map(row => {
      const button = Object.assign(document.createElement("button"), { className: "thread", type: "button" });
      const label = document.createElement("b"), count = document.createElement("em"), preview = document.createElement("small");
      label.textContent = row.label;
      count.textContent = row.unread > 99 ? "99+" : String(row.unread);
      preview.textContent = row.preview || "새 메시지가 도착했어요.";
      button.append(label, count, preview);
      button.onclick = () => setSelection(row.key);
      return button;
    }));
  }
  const count = unread.reduce((total,row) => total + row.unread, 0);
  el("total").textContent = count ? String(count) : "";
  el("new-count").hidden = !selected || count === 0;
  el("new-count").textContent = "새 메시지 " + count;
  el("empty").hidden = unread.length > 0;
  el("empty").textContent = account ? "새 메시지가 없어요. 위에서 친구나 채팅방을 선택해 대화를 시작하세요." : "로그인하면 새 메시지를 확인할 수 있어요.";
  refreshControls();
  if (opened) void refreshHistory();
}

async function refreshHistory() {
  if (!isVisible || !selected || fetching) return;
  const key = selected, current = generation;
  fetching = true;
  try {
    const result = await api.history(key);
    if (current !== generation || !result?.ok) return;
    const messages = result.data.messages ?? [];
    const signature = JSON.stringify(messages.map(row => [row.id,row.content,row.deleted_at,row.attachment_name]));
    const wasBottom = history.scrollHeight - history.clientHeight - history.scrollTop < 25;
    if (signature !== shown) {
      shown = signature;
      const nodes = messages.map(row => {
        const item = document.createElement("article");
        item.className = row.sender_id === account?.id ? "message mine" : "message";
        const label = document.createElement("b"), content = document.createElement("span"), time = document.createElement("time");
        label.textContent = row.sender_name ?? (row.sender_id === account?.id ? account.name : "동아리원");
        content.textContent = row.content || row.attachment_name || "";
        const stamp = new Date(row.created_at);
        time.textContent = Number.isNaN(stamp.getTime()) ? "" : formatter.format(stamp);
        item.append(label,content,time);
        return item;
      });
      if (!nodes.length) nodes.push(Object.assign(document.createElement("p"), { className: "empty", textContent: "첫 메시지를 보내 보세요." }));
      history.replaceChildren(...nodes);
      if (wasBottom) history.scrollTop = history.scrollHeight;
    }
    const through = messages.at(-1)?.id;
    if (through && through !== lastRead.get(key) && document.hasFocus() &&
      history.scrollHeight - history.clientHeight - history.scrollTop < 25) {
      const result = await api.read(key, through);
      if (result?.ok && current === generation) lastRead.set(key, through);
    }
  } catch {} finally {
    fetching = false;
    if (current !== generation && selected) void refreshHistory();
  }
}

select.onchange = () => setSelection(select.value);
el("back").onclick = () => setSelection("");
el("open").onclick = () => void api.open(selected);
el("hide").onclick = () => void api.hide();
draft.oninput = refreshControls;
draft.onkeydown = event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    form.requestSubmit();
  }
};
form.onsubmit = async event => {
  event.preventDefault();
  if (sending || !selected || el("send").disabled) return;
  const current = generation, key = selected, value = draft.value.trim();
  let pending = retries.get(key);
  if (!pending || pending.value !== value) {
    pending = { value, id: crypto.randomUUID() };
    retries.set(key, pending);
  }
  sending = true;
  notice("");
  refreshControls();
  try {
    const result = await api.send(key, value, pending.id);
    if (result?.ok) {
      if (retries.get(key) === pending) { retries.delete(key); drafts.delete(key); }
      if (current === generation) { draft.value = ""; void refreshHistory(); }
    } else if (current === generation) notice(result?.message ?? "메시지를 보내지 못했어요.");
  } catch { if (current === generation) notice("메시지를 보내지 못했어요."); }
  finally { sending = false; refreshControls(); }
};
api.onState(render);
void api.state().then(render);
window.addEventListener("focus", () => void refreshHistory());
setInterval(refreshHistory, 3200);
