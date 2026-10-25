"use client";

/**
 * Adapted from the GroupChat component supplied by the K.F.C. project owner.
 * Consecutive messages are grouped for presentation; persisted messages stay flat.
 */
import { Fragment, type ReactNode, type Ref } from "react";
import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import "blobatar/motion.css";
import "./group-chat.css";

export type ChatMessage = {
  id: string | number;
  userId: string;
  name: string;
  text: string;
  time?: string;
  createdAt?: string;
};

export type ChatMember = { id: string; name: string };

export type GroupChatProps = {
  messages: ChatMessage[];
  channel: string;
  members?: ChatMember[];
  currentUserId?: string;
  connected?: boolean;
  connectionLabel?: string;
  /** Supply only a real presence event. No typing indicator is simulated. */
  typing?: ChatMember;
  blobatar?: BlobatarOptions;
  className?: string;
  /** The existing server-backed form stays in the parent. */
  composer?: ReactNode;
  notice?: ReactNode;
  footerRef?: Ref<HTMLDivElement>;
};

function validDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dayKey(message: ChatMessage): string {
  return validDate(message.createdAt)?.toLocaleDateString("ko-KR") || "";
}

/** Group by immutable author ID, preserving messages and their stable IDs. */
export function groupConsecutiveMessages(messages: ChatMessage[]): ChatMessage[][] {
  return messages.reduce<ChatMessage[][]>((runs, message) => {
    const previous = runs.at(-1);
    const last = previous?.at(-1);
    const start = last && validDate(last.createdAt);
    const next = validDate(message.createdAt);
    const separated = !!(start && next && (next.getTime() - start.getTime() > 5 * 60 * 1000 || dayKey(last!) !== dayKey(message)));
    if (last && last.userId === message.userId && !separated) previous!.push(message);
    else runs.push([message]);
    return runs;
  }, []);
}

function messageTime(message: ChatMessage) {
  return message.time || validDate(message.createdAt)?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) || "";
}

export function GroupChat({
  messages,
  channel,
  members = [],
  currentUserId,
  connected = false,
  connectionLabel,
  typing,
  blobatar,
  className,
  composer,
  notice,
  footerRef,
}: GroupChatProps) {
  const runs = groupConsecutiveMessages(messages);
  const visibleMembers = members.slice(0, 5);
  const overflowCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <section className={["kfc-group-chat", className].filter(Boolean).join(" ")} aria-label={channel + " 그룹 채팅"}>
      <header className="kfc-chat-header">
        <div className="kfc-chat-channel">
          <span className="kfc-chat-club-mark"><img src="/kfc-logo.png" alt="K.F.C. 동아리 로고" /></span>
          <div>
            <span className="kfc-chat-overline">TEAM CHANNEL</span>
            <h2><span aria-hidden="true">#</span> {channel}</h2>
            <span className="kfc-chat-private"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="2" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg>그룹 구성원 전용 · {members.length}명</span>
          </div>
        </div>
        <div className="kfc-chat-header-right">
          {members.length > 0 && (
            <div className="kfc-chat-facepile" aria-label={"참여 구성원: " + members.map(member => member.name).join(", ")}>
              {visibleMembers.map(member => (
                <span key={member.id} title={member.name} className="kfc-chat-facepile-item">
                  <Blobatar name={member.id} {...blobatar} background="circle" alt="" className="kfc-chat-face" />
                </span>
              ))}
              {overflowCount > 0 && <span className="kfc-chat-facepile-extra" aria-hidden="true">+{overflowCount}</span>}
            </div>
          )}
          <span className={"kfc-chat-connection " + (connected ? "is-online" : "is-connecting")} role="status">
            <i aria-hidden="true" />{connectionLabel || (connected ? "실시간 연결됨" : "연결 확인 중")}
          </span>
        </div>
      </header>

      {notice && <div className="kfc-chat-notice" role="status">{notice}</div>}

      <div className="kfc-chat-scroll" tabIndex={0} aria-label="대화 기록 스크롤">
        <div className="kfc-chat-log" role="log" aria-live="polite" aria-relevant="additions text" aria-atomic="false" aria-label="그룹 대화 기록">
          {runs.length === 0 ? (
            <div className="kfc-chat-empty">
              <span className="kfc-chat-empty-orbit" aria-hidden="true"><img src="/kfc-logo.png" alt="" /></span>
              <span className="kfc-chat-overline">BUILD SOMETHING TOGETHER</span>
              <h3>우리 팀의 첫 대화를 시작해요</h3>
              <p>아이디어부터 다음 모임까지,<br />이 그룹의 구성원들과 함께 나눠 보세요.</p>
            </div>
          ) : runs.map((run, runIndex) => {
            const first = run[0]!;
            const mine = first.userId === currentUserId;
            const date = validDate(first.createdAt);
            const showDay = !!date && (runIndex === 0 || dayKey(runs[runIndex - 1]![0]!) !== dayKey(first));
            return (
              <Fragment key={first.id}>
                {showDay && <div className="kfc-chat-day"><time dateTime={date!.toISOString()}>{date!.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</time></div>}
                <div className={"kfc-chat-run " + (mine ? "is-mine" : "")}>
                  <div className="kfc-chat-avatar">
                    <Blobatar name={first.userId} {...blobatar} animate="hover" title={first.name} className="kfc-chat-face" />
                  </div>
                  <div className="kfc-chat-run-body">
                    <div className="kfc-chat-sender"><b>{first.name}</b>{mine && <span>나</span>}</div>
                    <div className="kfc-chat-bubbles">
                      {run.map(message => (
                        <article className="kfc-chat-message" key={message.id} aria-label={message.name + "의 메시지"}>
                          <p>{message.text}</p>
                          {messageTime(message) && <time dateTime={validDate(message.createdAt)?.toISOString()}>{messageTime(message)}</time>}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
          {typing && (
            <div className="kfc-chat-typing" role="status">
              <Blobatar name={typing.id} {...blobatar} alt="" className="kfc-chat-face" />
              <span>{typing.name}님이 입력 중입니다<span className="kfc-chat-typing-dots" aria-hidden="true"><i /><i /><i /></span></span>
            </div>
          )}
        </div>
        <div ref={footerRef} className="kfc-chat-end" aria-hidden="true" />
      </div>
      {composer && <div className="kfc-chat-composer">{composer}<p className="kfc-chat-composer-hint">서로 존중하는 말로 함께 성장해요.</p></div>}
    </section>
  );
}

export default GroupChat;

