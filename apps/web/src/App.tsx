import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useGuestStore } from "./store/guest";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import RoomPage from "./pages/RoomPage";
import DocsPage from "./pages/DocsPage";
import ChatOverlay from "./pages/overlays/ChatOverlay";
import LowerThirdOverlay from "./pages/overlays/LowerThirdOverlay";
import CountdownOverlay from "./pages/overlays/CountdownOverlay";
import StatusOverlay from "./pages/overlays/StatusOverlay";

export default function App() {
  const init = useGuestStore((s) => s.init);
  useEffect(() => { void init(); }, [init]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/overlay/chat" element={<ChatOverlay />} />
      <Route path="/overlay/lower-third" element={<LowerThirdOverlay />} />
      <Route path="/overlay/countdown" element={<CountdownOverlay />} />
      <Route path="/overlay/status" element={<StatusOverlay />} />
      <Route path="/dashboard" element={<AppShell><DashboardPage /></AppShell>} />
      <Route path="/rooms/new" element={<AppShell><CreateRoomPage /></AppShell>} />
      <Route path="/room/:slug" element={<RoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
