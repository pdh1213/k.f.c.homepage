import './mobile.css';
import { makeApi } from '../electron/api.cjs';
import type { Attachment, Scope } from '../lib/chat';

const maxFileSize = 4 * 1024 * 1024;
type Result<T> = { ok: true; data: T } | { ok: false; status?: number; message: string };

function pickFile(): Promise<Result<Attachment | null>> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    const finish = (result: Result<Attachment | null>) => {
      input.remove();
      resolve(result);
    };
    input.addEventListener('cancel', () => finish({ ok: true, data: null }), { once: true });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish({ ok: true, data: null });
      if (!file.size || file.size > maxFileSize) {
        return finish({ ok: false, message: '파일은 1바이트 이상, 4MB 이하로 선택해 주세요.' });
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const base64 = String(reader.result).split(',')[1];
        finish({ ok: true, data: { name: file.name, size: file.size, base64 } });
      }, { once: true });
      reader.addEventListener('error', () => finish({ ok: false, message: '파일을 읽지 못했습니다.' }), { once: true });
      reader.readAsDataURL(file);
    }, { once: true });
    document.body.append(input);
    input.click();
  });
}

const api = makeApi();
window.kfcChat = {
  platform: 'web',
  login: api.login,
  chat: api.chat,
  async logout() { await api.logout(); },
  async openClub() { window.open('https://kfc-robot-club.vercel.app/', '_blank', 'noopener,noreferrer'); },
  async update() { window.open('/download', '_blank', 'noopener,noreferrer'); },
  async copy(text) { await navigator.clipboard.writeText(text); },
  pickFile,
  async download(scope: Scope, id: number) {
    const result = await api.chat<{ name: string; base64: string }>({ action: 'download', ...scope, id });
    if (!result.ok) return result;
    const bytes = Uint8Array.from(atob(result.data.base64), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.data.name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, data: true };
  },
  async notify() { /* Browsers keep unread counts in the chat workspace. */ },
  onOpenPeer() { return () => {}; },
};
void import('../src/main');
