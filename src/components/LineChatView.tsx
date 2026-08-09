import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import { fetchLineMessages, fetchLineRooms } from "../lib/api";
import type { LineMessageView, LineRoomSummary } from "../../shared/contracts";

type Tab = "all" | "group" | "room";

const TYPE_ICON: Record<string, string> = { group: "👥", room: "💬", user: "👤" };

const NON_TEXT_LABEL: Record<string, string> = {
  image: "[圖片]",
  video: "[影片]",
  audio: "[語音]",
  sticker: "[貼圖]",
  file: "[檔案]",
  location: "[位置]",
};

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function formatListTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "昨天";
  const mmdd = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? mmdd : `${d.getFullYear()}/${mmdd}`;
}

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function messageLabel(m: LineMessageView): string {
  if (m.messageType === "text") return m.text ?? "";
  return NON_TEXT_LABEL[m.messageType] ?? `[${m.messageType}]`;
}

function roomTitle(r: LineRoomSummary): string {
  if (r.roomType === "group") return r.name || `群組 ${shortId(r.roomId)}`;
  if (r.roomType === "room") return `聊天室 ${shortId(r.roomId)}`;
  return `1:1 ${shortId(r.roomId)}`;
}

export default function LineChatView() {
  const [rooms, setRooms] = useState<LineRoomSummary[]>([]);
  const [botUserId, setBotUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<LineRoomSummary | null>(null);
  const [messages, setMessages] = useState<LineMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLineRooms()
      .then((res) => {
        if (cancelled) return;
        setRooms(res.rooms);
        setBotUserId(res.botUserId ?? null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openRoom = (r: LineRoomSummary) => {
    setSelected(r);
    setLoadingMsg(true);
    setMessages([]);
    setHasMore(true);
    fetchLineMessages(r.roomType, r.roomId, 200, 0)
      .then((res) => {
        setMessages(res.messages);
        setHasMore(res.messages.length === 200);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingMsg(false));
  };

  const closeRoom = () => {
    setSelected(null);
    setMessages([]);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!selected || loadingMsg || loadingMore || !hasMore) return;
    const target = e.currentTarget;
    // Load more when scrolled to the top (scrollTop === 0)
    if (target.scrollTop <= 50) {
      setLoadingMore(true);
      prevScrollHeightRef.current = target.scrollHeight;
      fetchLineMessages(selected.roomType, selected.roomId, 200, messages.length)
        .then((res) => {
          if (res.messages.length > 0) {
            setMessages((prev) => [...prev, ...res.messages]);
          }
          setHasMore(res.messages.length === 200);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoadingMore(false));
    }
  };

  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      if (prevScrollHeightRef.current > 0) {
        // Adjust scroll position after loading older messages so it doesn't jump to the very top
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight - prevScrollHeightRef.current;
        prevScrollHeightRef.current = 0; // reset
      } else if (messages.length > 0 && !loadingMore) {
        // Initial load, scroll to bottom
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    }
  }, [messages]);

  const filtered = useMemo(() => {
    if (tab === "all") return rooms;
    return rooms.filter((r) => r.roomType === tab);
  }, [rooms, tab]);

  const counts = useMemo(
    () => ({
      all: rooms.length,
      group: rooms.filter((r) => r.roomType === "group").length,
      room: rooms.filter((r) => r.roomType === "room").length,
    }),
    [rooms]
  );

  // getLineMessages returns newest first; display oldest → newest like the LINE app.
  // ⚡ Bolt Optimization: Use O(N) reverse instead of O(N log N) sort with expensive Date parsing.
  // The backend query `ORDER BY created_at DESC` already guarantees the order.
  const sortedMessages = useMemo(
    () => [...messages].reverse(),
    [messages]
  );

  return (
    <section className="page-section line-view">
      <div className="line-header">
        <div>
          <h2>💬 聊天紀錄</h2>
          <p>LINE bot 儲存的對話存檔,依群組 / 聊天室分類。</p>
        </div>
        <div className="line-tabs">
          <button type="button" className={tab === "all" ? "active" : ""} onClick={() => { setTab("all"); closeRoom(); }}>全部 ({counts.all})</button>
          <button type="button" className={tab === "group" ? "active" : ""} onClick={() => { setTab("group"); closeRoom(); }}>群組 ({counts.group})</button>
          <button type="button" className={tab === "room" ? "active" : ""} onClick={() => { setTab("room"); closeRoom(); }}>聊天室 ({counts.room})</button>
        </div>
      </div>

      <div className="line-app">
        {/* Conversation list (left) */}
        <div className={`line-list ${selected ? "line-list-hidden" : ""}`}>
          {error && <div className="line-error">⚠️ {error}</div>}
          {loading && <div className="line-empty">載入中…</div>}
          {!loading && filtered.length === 0 && (
            <div className="line-empty">
              {tab === "all"
                ? "尚無聊天紀錄。bot 在對話中收到訊息後會自動存檔。"
                : tab === "group"
                  ? "尚無群組紀錄。"
                  : "尚無聊天室紀錄。"}
            </div>
          )}
          {filtered.map((r) => (
            <button type="button" key={`${r.roomType}:${r.roomId}`} className="line-room" onClick={() => openRoom(r)}>
              <span className="line-avatar" style={{ background: `hsl(${hashHue(r.roomId)} 60% 45%)` }}>
                {TYPE_ICON[r.roomType] ?? "💬"}
              </span>
              <span className="line-room-main">
                <span className="line-room-top">
                  <span className="line-room-name">{roomTitle(r)}</span>
                  <span className="line-room-time">{formatListTime(r.lastMessageAt)}</span>
                </span>
                <span className="line-room-preview">
                  {r.lastMessageText ??
                    (r.lastMessageType ? (NON_TEXT_LABEL[r.lastMessageType] ?? `[${r.lastMessageType}]`) : "—")}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Chat pane (right) */}
        <div className={`line-chat ${selected ? "" : "line-chat-idle"}`}>
          {selected ? (
            <>
              <div className="line-chat-header">
                <button type="button" className="line-back" onClick={closeRoom} aria-label="返回">←</button>
                <span className="line-chat-title">{roomTitle(selected)}</span>
                <span className="line-chat-count">{selected.messageCount} 則</span>
              </div>
              <div className="line-messages" onScroll={handleScroll} ref={messagesContainerRef}>
                {loadingMore && <div className="line-loading-more" style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '14px' }}>載入更多紀錄中…</div>}
                {loadingMsg && <div className="line-empty">載入中…</div>}
                {!loadingMsg && sortedMessages.length === 0 && <div className="line-empty">尚無訊息。</div>}
                {sortedMessages.map((m) => {
                  const mine = botUserId !== null && m.userId === botUserId;
                  return (
                    <div key={m.id} className={`line-msg ${mine ? "mine" : ""}`}>
                      {!mine && (
                        m.pictureUrl ? (
                          <img
                            src={m.pictureUrl}
                            alt="avatar"
                            className="line-msg-avatar"
                            title={m.userName || m.userId || ""}
                          />
                        ) : (
                          <span
                            className="line-msg-avatar"
                            style={{ background: m.userId ? `hsl(${hashHue(m.userId)} 55% 50%)` : "#bbbbbb" }}
                            title={m.userName || m.userId || ""}
                          >
                            {m.userName
                              ? m.userName.slice(0, 2)
                              : m.userId
                                ? m.userId.slice(-2).toUpperCase()
                                : "?"}
                          </span>
                        )
                      )}
                      <div className="line-msg-body">
                        <div className="line-bubble">{messageLabel(m)}</div>
                        <span className="line-msg-time">{formatMsgTime(m.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="line-empty line-chat-placeholder">← 選擇左側對話查看聊天內容</div>
          )}
        </div>
      </div>
    </section>
  );
}
