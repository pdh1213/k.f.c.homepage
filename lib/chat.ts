export type Status = 'online' | 'dnd' | 'offline';
export type Account = { id: number; name: string; moderator: boolean };
export type Friend = { id: number; name: string; status: Status; pinned: boolean; muted: boolean; blocked: boolean; blocked_by: boolean };
export type Thread = { peer_id: number; last_id: number; content: string; created_at: string; unread: number };
export type Room = {
  id: number; title: string; owner_id: number | null; member_count: number; pinned: boolean; muted: boolean;
  last_id: number; content: string | null; updated_at: string; unread: number;
};
export type RoomPerson = { id: number; name: string };
export type Overview = { self: Account; friends: Friend[]; chats: Thread[]; rooms?: Room[] };
export type Scope = { peer: number } | { room: number };
export const scopeKey = (scope: Scope) => 'room' in scope ? `room:${scope.room}` : `peer:${scope.peer}`;
export const CODE_LANGUAGES = {
  text: '일반 텍스트', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
  cpp: 'C++', c: 'C', csharp: 'C#', java: 'Java', json: 'JSON', bash: 'Bash',
  html: 'HTML', css: 'CSS', sql: 'SQL', rust: 'Rust', arduino: 'Arduino', lua: 'Lua',
} as const;
export type CodeLanguage = keyof typeof CODE_LANGUAGES;
export type Quote = { id: number; sender_id: number; sender_name?: string; content: string };
export type Message = Quote & {
  sticker_key?: string | null;
  created_at: string; edited_at: string | null; deleted_at: string | null; code_language?: CodeLanguage | null;
  attachment_name: string | null; attachment_size: number | null;
  quote: Quote | null; reactions: { emoji: string; user_id: number }[];
};
export type History = { messages: Message[]; older: boolean; typing: boolean; typing_people?: string[]; read_through: number };
export type Attachment = { name: string; size: number; base64: string };
export type Report = {
  id: number; reason: string; excerpt: string | null; created_at: string; reviewed_at: string | null;
  reported: { name: string } | null; reporter: { name: string } | null;
};
type ApiResult<T> = { ok: true; data: T } | { ok: false; status?: number; message: string };
type Command = { action: string; [key: string]: unknown };

interface DesktopBridge {
  platform?: 'web';
  restore?(): Promise<ApiResult<boolean>>;
  monitorDownload?(key: string, id: number, review: string): Promise<ApiResult<boolean>>;
  login(username: string, password: string): Promise<ApiResult<void>>;
  logout(): Promise<void>;
  chat<T>(input: Command): Promise<ApiResult<T>>;
  openClub(): Promise<void>;
  update(): Promise<void>;
  copy(text: string): Promise<void>;
  pickFile(): Promise<ApiResult<Attachment | null>>;
  download(scope: Scope, id: number): Promise<ApiResult<boolean>>;
  notify(scope: Scope, name: string, after?: number): Promise<void>;
  startup?(enabled?: boolean): Promise<boolean>;
  showMini?(): Promise<boolean>;
  dismissPopups?(): Promise<void>;
  onOpenPeer(callback: (scope: Scope) => void): () => void;
}
declare global { interface Window { kfcChat?: DesktopBridge } }

export class ChatError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
export function value<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new ChatError(result.message, result.status);
  return result.data;
}
export function request<T>(input: Command) {
  const desktop = window.kfcChat;
  if (!desktop) return Promise.reject(new ChatError('Windows 앱에서 이용해 주세요.'));
  return desktop.chat<T>(input).then(value);
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : '다시 시도해 주세요.';
}
export const STATUS_TEXT = { online: '온라인', dnd: '방해 금지', offline: '오프라인' } as const;
export const EMOJI = ['👍', '❤️', '😂', '🎉', '😮', '👀'];
const timeFormat = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
export const time = (stamp: string) => timeFormat.format(new Date(stamp));
export const day = (stamp: string) => dateFormat.format(new Date(stamp));
export const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
