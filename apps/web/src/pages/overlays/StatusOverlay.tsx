import { useSearchParams } from "react-router-dom";

export default function StatusOverlay() {
  const [params] = useSearchParams();
  const text = params.get("text") || "LIVE";
  const color = params.get("color") || "#C7F000";
  return (
    <div style={{ background: "transparent", padding: 24, fontFamily: "Inter, sans-serif" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#141414", color, border: `3px solid ${color}`, padding: "10px 16px", fontWeight: 800 }}>
        <span style={{ width: 10, height: 10, background: color, borderRadius: 999 }} />
        {text}
      </div>
    </div>
  );
}
