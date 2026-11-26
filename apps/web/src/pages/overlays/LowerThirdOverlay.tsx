import { useSearchParams } from "react-router-dom";

export default function LowerThirdOverlay() {
  const [params] = useSearchParams();
  const name = params.get("name") || "Guest Name";
  const title = params.get("title") || "Live Stream";
  return (
    <div style={{ background: "transparent", minHeight: "100vh", display: "flex", alignItems: "end", padding: 32, fontFamily: "Inter, sans-serif" }}>
      <div style={{ border: "3px solid #141414", boxShadow: "6px 6px 0 #141414", background: "#fff", padding: "16px 24px" }}>
        <div style={{ background: "#C7F000", display: "inline-block", padding: "2px 8px", fontWeight: 800, fontSize: 12 }}>LIVE</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: "#141414" }}>{name}</div>
        <div style={{ fontSize: 16, color: "#444" }}>{title}</div>
      </div>
    </div>
  );
}
