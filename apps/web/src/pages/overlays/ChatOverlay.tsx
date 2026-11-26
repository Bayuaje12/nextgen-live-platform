import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function ChatOverlay() {
  const [params] = useSearchParams();
  const roomId = params.get("roomId") || "";
  const [messages, setMessages] = useState<{ id: string; display_name: string; content: string }[]>([]);
  useEffect(() => {
    const sb = supabase;
    if (!sb || !roomId) return;
    const channel = sb.channel(`overlay-chat-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, (p) => {
        setMessages((m) => [...m.slice(-10), p.new as any]);
      }).subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [roomId]);
  return (
    <div style={{ background: "transparent", padding: 16, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ background: "rgba(20,20,20,0.85)", color: "#fff", border: "2px solid #C7F000", padding: "8px 12px", maxWidth: 520 }}>
            <div style={{ fontWeight: 700, color: "#C7F000", fontSize: 12 }}>{m.display_name}</div>
            <div style={{ fontSize: 14 }}>{m.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
