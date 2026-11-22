const byId = id => document.getElementById(id);
const bridge = window.kfcPopup;
const draft = byId("draft");
const send = byId("send");
const root = document.querySelector(".popup");
let card;
let busy = false;

const formatter = new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" });

function updateSend() {
  send.disabled = busy || card?.sending || !draft.value.trim();
  draft.readOnly = busy || Boolean(card?.sending);
}
function feedback(message) {
  const label = byId("feedback");
  label.textContent = message;
  label.hidden = !message;
  label.title = message;
}
function render(next) {
  if (card?.thread !== next?.thread) { draft.value = ""; feedback(""); }
  card = next;
  if (!card) return updateSend();
  byId("initial").textContent = Array.from(card.sender.trim())[0] || "K";
  const photo = byId("photo");
  photo.hidden = !card.avatar;
  byId("initial").hidden = Boolean(card.avatar);
  if (card.avatar) photo.src = card.avatar;
  else photo.removeAttribute("src");
  byId("sender").textContent = card.sender;
  const at = new Date(card.time);
  byId("time").textContent = Number.isNaN(at.getTime()) ? "" : formatter.format(at);
  const room = byId("thread");
  room.textContent = card.thread.startsWith("r:") ? card.title : "";
  room.hidden = !room.textContent;
  byId("preview").textContent = card.text || "새 메시지가 도착했어요.";
  const nextButton = byId("next");
  nextButton.hidden = card.count <= 1;
  nextButton.textContent = card.count > 1 ? "다음 " + (card.count - 1) + " ›" : "";
  updateSend();
}

bridge.onState(render);
void bridge.state().then(render);
byId("open").onclick = () => { if (card) void bridge.open(card.id); };
byId("next").onclick = () => { if (card && !busy) void bridge.next(card.id); };
byId("close").onclick = () => { if (card && !busy) void bridge.dismiss(card.id); };
draft.oninput = updateSend;
root.onmouseenter = () => void bridge.hold(true);
root.onmouseleave = () => void bridge.hold(false);
document.addEventListener("keydown", event => {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "Escape" && card && !busy) { event.preventDefault(); void bridge.dismiss(card.id); }
});
draft.onkeydown = event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    byId("reply").requestSubmit();
  }
};
byId("reply").onsubmit = async event => {
  event.preventDefault();
  if (!card || busy || send.disabled) return;
  const current = card;
  const content = draft.value.trim();
  busy = true;
  feedback("");
  updateSend();
  try {
    const result = await bridge.reply(current.id, content);
    if (card?.thread !== current.thread) return;
    if (!result?.ok) feedback(result?.message ?? "보내지 못했어요. 다시 시도해 주세요.");
    else draft.value = "";
  } catch { if (card?.thread === current.thread) feedback("보내지 못했어요. 다시 시도해 주세요."); }
  finally { busy = false; updateSend(); }
};
