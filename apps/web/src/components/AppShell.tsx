import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Radio, Settings, Shield, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { config } from "../lib/config";
import { useAuthStore } from "../store/auth";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/rooms/new", label: "Create Room", icon: Radio },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/admin", label: "Admin", icon: Shield },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-ink md:grid md:grid-cols-[260px_1fr]">
      <aside className={`border-r-2 border-ink bg-white p-4 ${open ? "block" : "hidden"} md:block`}>
        <Link to="/" className="mb-8 block font-display text-2xl font-bold">
          <span className="bg-lime px-2">{config.appName}</span>
        </Link>
        <nav className="space-y-2">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 border-2 border-ink px-3 py-2 font-semibold shadow-brutal-sm ${isActive ? "bg-lime" : "bg-white"}`
                }
                onClick={() => setOpen(false)}
              >
                <Icon size={18} /> {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-8 border-2 border-ink bg-background p-3 text-sm shadow-brutal-sm">
          <div className="font-semibold">{user?.email || "Guest"}</div>
          <button
            className="btn-secondary mt-3 w-full"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b-2 border-ink bg-white p-4 md:hidden">
          <Link to="/" className="font-display text-xl font-bold"><span className="bg-lime px-1">{config.appName}</span></Link>
          <button className="btn-secondary px-2 py-2" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
