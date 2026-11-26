import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function CountdownOverlay() {
  const [params] = useSearchParams();
  const secondsParam = Number(params.get("seconds") || "300");
  const [remaining, setRemaining] = useState(Number.isFinite(secondsParam) ? secondsParam : 300);
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <div style={{ background: "transparent", minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Space Grotesk, Inter, sans-serif" }}>
      <div style={{ background: "#141414", color: "#C7F000", border: "4px solid #C7F000", padding: "24px 48px", fontSize: 72, fontWeight: 700 }}>
        {mm}:{ss}
      </div>
    </div>
  );
}
