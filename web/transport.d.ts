declare module '*api.cjs' {
// Types for the transport also used by the Windows app.
type Result<T> = { ok: true; data: T } | { ok: false; status?: number; message: string };
export function makeApi(): {
  login(username: string, password: string): Promise<Result<void>>;
  chat<T>(command: { action: string; [key: string]: unknown }): Promise<Result<T>>;
  logout(): Promise<Result<void>>;
};
}
