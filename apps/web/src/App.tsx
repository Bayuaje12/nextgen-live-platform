import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuthStore } from "./store/auth";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import RoomPage from "./pages/RoomPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import DocsPage from "./pages/DocsPage";
import ChatOverlay from "./pages/overlays/ChatOverlay";
import LowerThirdOverlay from "./pages/overlays/LowerThirdOverlay";
import CountdownOverlay from "./pages/overlays/CountdownOverlay";
import StatusOverlay from "./pages/overlays/StatusOverlay";

export default function App() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/overlay/chat" element={<ChatOverlay />} />
      <Route path="/overlay/lower-third" element={<LowerThirdOverlay />} />
      <Route path="/overlay/countdown" element={<CountdownOverlay />} />
      <Route path="/overlay/status" element={<StatusOverlay />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <DashboardPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rooms/new"
        element={
          <ProtectedRoute>
            <AppShell>
              <CreateRoomPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="/room/:slug" element={<RoomPage />} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <SettingsPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AppShell>
              <AdminPage />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
