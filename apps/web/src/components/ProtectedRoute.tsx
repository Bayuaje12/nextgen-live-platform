import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuthStore();
  const location = useLocation();
  if (!initialized || loading) return <div className="p-8 font-semibold">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
