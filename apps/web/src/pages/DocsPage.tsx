import { config } from "../lib/config";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl card p-6 space-y-6">
        <h1 className="font-display text-4xl font-bold">Documentation</h1>
        <section>
          <h2 className="font-display text-2xl font-bold">Quick start</h2>
          <pre className="mt-2 overflow-auto border-2 border-ink bg-ink p-4 text-sm text-white"><code>{`pnpm install
cp .env.example .env
# Fill Supabase and app URLs
pnpm dev`}</code></pre>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold">Required external services</h2>
          <ul className="mt-2 list-disc pl-5 text-muted space-y-1">
            <li>Supabase project for Auth, Postgres, Realtime, and RLS.</li>
            <li>VDO.Ninja official SDK/iframe integration uses VDO.Ninja infrastructure; availability and network behavior depend on their service and WebRTC conditions.</li>
            <li>OBS WebSocket is local to the user's OBS installation.</li>
            <li>WHIP/WHEP/RTMP require compatible external media infrastructure if configured.</li>
          </ul>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold">Free-tier limits</h2>
          <p className="text-muted mt-2">The app has no paywall, but hosting, Supabase, TURN, bandwidth, and external media providers have quotas/limits. Do not assume unlimited streaming capacity.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl font-bold">Community</h2>
          <a className="underline font-semibold" href={config.whatsappCommunityUrl} target="_blank" rel="noreferrer">{config.whatsappCommunityUrl}</a>
        </section>
      </div>
    </div>
  );
}
