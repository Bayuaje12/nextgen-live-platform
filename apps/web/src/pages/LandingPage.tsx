import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Radio, Shield, Video, Users, MessageSquare, Monitor, Mic, Layout, CheckCircle2 } from "lucide-react";
import { config } from "../lib/config";

const features = [
  { icon: Video, title: "Live streaming", text: "Run creator broadcasts, events, and interactive sessions." },
  { icon: Users, title: "Multi-guest studio", text: "Host guests, moderators, and collaborative sessions." },
  { icon: MessageSquare, title: "Real-time chat", text: "Engage audiences with chat, moderation, and announcements." },
  { icon: Monitor, title: "OBS integration", text: "Use browser sources and local OBS WebSocket controls." },
  { icon: Mic, title: "Podcast & webinars", text: "Templates for podcasts, classrooms, interviews, and webinars." },
  { icon: Shield, title: "Secure by design", text: "Auth, role checks, RLS, validation, and safe defaults." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="border-b-2 border-ink bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
          <div className="font-display text-2xl font-bold"><span className="bg-lime px-2">{config.appName}</span></div>
          <nav className="hidden gap-4 font-semibold md:flex">
            <a href="#features">Features</a><a href="#how">How it works</a><a href="#obs">OBS</a><a href="#faq">FAQ</a><Link to="/docs">Docs</Link>
          </nav>
          <div className="flex gap-2">
            <Link to="/login" className="btn-secondary">Log in</Link>
            <Link to="/signup" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 p-4 py-16 md:grid-cols-2 md:items-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 inline-block border-2 border-ink bg-violet px-3 py-1 font-bold text-white shadow-brutal-sm">All features free. No paywall.</div>
          <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl">The all-in-one live studio for creators, teams, and communities.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">Stream, host guests, chat, record, teach, podcast, and run events from one responsive web platform.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Create your studio <ArrowRight size={18} /></Link>
            <Link to="/dashboard" className="btn-secondary">Open dashboard</Link>
          </div>
          <div className="mt-6 text-sm font-medium text-muted">Free app access. External infrastructure quotas still apply.</div>
        </motion.div>
        <div className="card p-4">
          <div className="border-2 border-ink bg-ink p-4 text-white shadow-brutal-sm">
            <div className="mb-3 flex items-center justify-between"><span className="bg-lime px-2 py-1 text-xs font-bold text-ink">LIVE STUDIO PREVIEW</span><span className="text-xs">12:34 • 4 participants</span></div>
            <div className="grid grid-cols-2 gap-2">
              {["Host", "Guest 1", "Guest 2", "Screen Share"].map((label) => (
                <div key={label} className="flex aspect-video items-center justify-center border-2 border-white/30 bg-zinc-800 font-semibold">{label}</div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Mic", "Camera", "Share", "Chat", "Record", "OBS"].map((c) => <span key={c} className="border border-white/40 px-2 py-1 text-xs">{c}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl p-4 py-12">
        <h2 className="font-display text-4xl font-bold">Built for every live format</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {features.map((f) => { const Icon = f.icon; return (
            <div key={f.title} className="card p-5">
              <Icon className="mb-3" />
              <h3 className="font-display text-xl font-bold">{f.title}</h3>
              <p className="mt-2 text-muted">{f.text}</p>
            </div>
          ); })}
        </div>
      </section>

      <section id="how" className="border-y-2 border-ink bg-white">
        <div className="mx-auto max-w-7xl p-4 py-12">
          <h2 className="font-display text-4xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[["1. Create", "Sign up, create a room, choose a template, and configure permissions."], ["2. Go live", "Invite guests, manage chat, share screens, and control your studio."], ["3. Produce", "Use overlays, OBS sources, recording, and viewer experiences."]].map(([t, d]) => (
              <div key={t} className="card p-5"><div className="font-display text-2xl font-bold">{t}</div><p className="mt-2 text-muted">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="obs" className="mx-auto max-w-7xl p-4 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="font-display text-3xl font-bold">OBS-ready workflows</h2>
            <ul className="mt-4 space-y-2">
              {["Browser Source overlays", "Local OBS WebSocket control bridge", "WHIP/WHEP when external endpoint configured", "RTMP via compatible external relay"].map((i) => (
                <li key={i} className="flex gap-2"><CheckCircle2 size={18} className="mt-0.5" /> <span>{i}</span></li>
              ))}
            </ul>
          </div>
          <div className="card bg-lime p-6">
            <h3 className="font-display text-2xl font-bold">Community</h3>
            <p className="mt-2">Join the WhatsApp channel for updates and community feedback.</p>
            <a className="btn-secondary mt-4" href={config.whatsappCommunityUrl} target="_blank" rel="noreferrer">Open WhatsApp Channel</a>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-7xl p-4 py-12">
        <h2 className="font-display text-4xl font-bold">FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ["Is it free?", "All app features are free. External infrastructure may have quotas or costs."],
            ["Does it work on mobile?", "The UI is responsive. Some browser capabilities like screen sharing vary by device/browser."],
            ["Is VDO.Ninja replaced?", "No. The platform integrates the official VDO.Ninja SDK and does not replace its signaling infrastructure."],
            ["Is cloud recording included?", "Browser-local recording is supported where available. Cloud recording requires configured storage infrastructure."],
          ].map(([q, a]) => (
            <div key={q} className="card p-5"><h3 className="font-bold">{q}</h3><p className="mt-2 text-muted">{a}</p></div>
          ))}
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div><div className="font-display text-xl font-bold">{config.appName}</div><div className="text-sm text-muted">Professional live streaming, built responsibly.</div></div>
          <div className="flex flex-wrap gap-4 font-semibold"><Link to="/docs">Docs</Link><a href={config.whatsappCommunityUrl} target="_blank" rel="noreferrer">Community</a><Link to="/login">Login</Link></div>
        </div>
      </footer>
    </div>
  );
}
