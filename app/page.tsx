'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Check, CheckCircle2, Clock, DollarSign, Inbox, RotateCcw,
  Search, Send, ShieldCheck, SlidersHorizontal, X, XCircle, Zap,
} from 'lucide-react';
import type { Approval, Sku, Store } from '@/lib/store';

type Step = { title: string; status: 'pass' | 'warn' | 'fail'; lines: string[] };
type Trace = { extraction: Step; marginCheck: Step; decision: Step };

const PRESETS = [
  { n: 1, label: 'After-Hours Lead → Auto-Close', text: "It's 10:42 PM and my AC is blowing warm air. Can someone do an AC tune-up tomorrow morning? Frisco, TX." },
  { n: 2, label: '20% Discount Request → Margin Guard', text: 'Hi! Can I get 20% off if I book two AC tune-up units this week?' },
  { n: 3, label: 'Supplier 19% Cost Hike → Price Alert', text: 'Supplier notice: water heater unit cost is up 19% effective Monday.' },
];

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pc = (n: number) => `${(n * 100).toFixed(1)}%`;
const api = async (url: string, body: object) =>
  (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

const TONE = {
  pass: { box: 'border-emerald-500/40 bg-emerald-500/5', text: 'text-emerald-400', Icon: CheckCircle2 },
  warn: { box: 'border-amber-500/40 bg-amber-500/5', text: 'text-amber-400', Icon: AlertTriangle },
  fail: { box: 'border-red-500/40 bg-red-500/5', text: 'text-red-400', Icon: XCircle },
};

function Kpi({ label, value, Icon, tone }: { label: string; value: string; Icon: typeof Clock; tone: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className={`flex items-center gap-2 text-sm text-zinc-400`}>
        <Icon className={`h-4 w-4 ${tone}`} /> {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function TraceStep({ step }: { step?: Step }) {
  if (!step) return <div className="h-24 rounded-lg border border-dashed border-zinc-800" />;
  const t = TONE[step.status];
  return (
    <div className={`rounded-lg border p-3 ${t.box}`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${t.text}`}>
        <t.Icon className="h-4 w-4" /> {step.title}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-zinc-300">
        {step.lines.map((l, i) => <li key={i}>{l}</li>)}
      </ul>
    </div>
  );
}

function CatalogRow({ sku, onSave }: { sku: Sku; onSave: (s: Sku) => void }) {
  const [d, setD] = useState({ cost: String(sku.cost), price: String(sku.price), min: String(Math.round(sku.minMargin * 100)) });
  useEffect(() => setD({ cost: String(sku.cost), price: String(sku.price), min: String(Math.round(sku.minMargin * 100)) }), [sku]);
  const cost = Number(d.cost), price = Number(d.price), min = Number(d.min) / 100;
  const m = price > 0 ? (price - cost) / price : 0;
  const save = () => onSave({ ...sku, cost, price, minMargin: min });
  const input = 'w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm tabular-nums focus:border-emerald-500 focus:outline-none';
  return (
    <tr className="border-t border-zinc-800">
      <td className="py-2 pr-3 text-sm">{sku.name}</td>
      <td className="pr-2"><input className={input} value={d.cost} onChange={(e) => setD({ ...d, cost: e.target.value })} onBlur={save} inputMode="decimal" aria-label={`${sku.name} cost`} /></td>
      <td className="pr-2"><input className={input} value={d.price} onChange={(e) => setD({ ...d, price: e.target.value })} onBlur={save} inputMode="decimal" aria-label={`${sku.name} price`} /></td>
      <td className="pr-2"><input className={input} value={d.min} onChange={(e) => setD({ ...d, min: e.target.value })} onBlur={save} inputMode="decimal" aria-label={`${sku.name} minimum margin percent`} /></td>
      <td className={`text-right text-sm font-medium tabular-nums ${m >= min ? 'text-emerald-400' : 'text-red-400'}`}>{pc(m)}</td>
    </tr>
  );
}

export default function Page() {
  const [store, setStore] = useState<Store | null>(null);
  const [text, setText] = useState('');
  const [trace, setTrace] = useState<Trace | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'log' | 'catalog'>('log');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => setStore(await (await fetch('/api/approve')).json()), []);
  useEffect(() => { load(); }, [load]);

  const run = async (message: string, preset: number | null) => {
    if (!message.trim()) return;
    setBusy(true); setError(''); setTrace(null);
    const r = await api('/api/ingest', { message, preset });
    if (r.error) setError(r.error); else { setTrace(r.trace); setStore(r.state); }
    setBusy(false);
  };
  const act = async (body: object) => {
    const r = await api('/api/approve', body);
    if (r.error) setError(r.error); else { setError(''); setStore(r); }
  };

  if (!store) return <main className="p-8 text-zinc-500">Loading SentinelLocal…</main>;
  const { kpis, catalog, pendingApprovals, activityLog } = store;
  const logTone = { 'auto-close': 'text-emerald-400', approved: 'text-emerald-400', rejected: 'text-red-400', alert: 'text-amber-400' };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      {/* Top bar */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
            <div>
              <h1 className="text-xl font-semibold">SentinelLocal</h1>
              <p className="text-xs text-zinc-500">After-hours revenue and margin sentinel · DFW service business</p>
            </div>
          </div>
          <button onClick={() => { setTrace(null); act({ action: 'reset' }); }} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm hover:border-zinc-500">
            <RotateCcw className="h-4 w-4" /> Reset Demo
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Recovered Revenue" value={usd(kpis.recoveredRevenue)} Icon={DollarSign} tone="text-emerald-400" />
          <Kpi label="Margin Saved" value={usd(kpis.marginSaved)} Icon={ShieldCheck} tone="text-emerald-400" />
          <Kpi label="Hours Saved" value={`${kpis.hoursSaved.toFixed(1)}h`} Icon={Clock} tone="text-zinc-100" />
          <Kpi label="Pending Approvals" value={String(pendingApprovals.length)} Icon={Inbox} tone={pendingApprovals.length ? 'text-amber-400' : 'text-zinc-100'} />
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {/* Simulator */}
      <section className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-300"><Zap className="h-4 w-4 text-amber-400" /> Inbound Simulator</h2>
          <div className="flex flex-col gap-2">
            {PRESETS.map((p) => (
              <button key={p.n} disabled={busy} onClick={() => { setText(p.text); run(p.text, p.n); }}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm hover:border-emerald-500 disabled:opacity-50">
                <span className="mr-2 text-zinc-500">{p.n}</span>{p.label}
              </button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Type a customer message or supplier notice…"
            className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm focus:border-emerald-500 focus:outline-none" />
          <button disabled={busy || !text.trim()} onClick={() => run(text, null)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-40">
            <Send className="h-4 w-4" /> {busy ? 'Running…' : 'Run Sentinel'}
          </button>
        </div>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-300"><Search className="h-4 w-4 text-zinc-400" /> Live Trace</h2>
          <TraceStep step={trace?.extraction} />
          <TraceStep step={trace?.marginCheck} />
          <TraceStep step={trace?.decision} />
        </div>
      </section>

      {/* Workspace */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-300"><Inbox className="h-4 w-4 text-amber-400" /> 1-Click Approval Queue</h2>
          {pendingApprovals.length === 0 && <p className="rounded-lg border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">Queue is clear. Run a preset to send something here.</p>}
          {pendingApprovals.map((a: Approval) => (
            <article key={a.id} className="space-y-2 rounded-lg border border-amber-500/30 bg-zinc-950 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-200">{a.customer}</span>
                <span className="rounded bg-amber-500/15 px-2 py-0.5 text-amber-400">{a.kind === 'costhike' ? 'Price alert' : a.kind === 'discount' ? 'Margin guard' : 'Review'}</span>
              </div>
              <p className="text-sm text-zinc-400">“{a.message}”</p>
              <p className="flex items-center gap-1.5 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {a.reason}</p>
              <textarea value={replies[a.id] ?? a.reply} onChange={(e) => setReplies({ ...replies, [a.id]: e.target.value })} rows={3}
                aria-label="Reply text" className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 p-2 text-sm focus:border-emerald-500 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => act({ action: 'approve', id: a.id, reply: replies[a.id] ?? a.reply })} className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"><Check className="h-4 w-4" /> Approve</button>
                <button onClick={() => act({ action: 'reject', id: a.id })} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-500/50 py-2 text-sm text-red-400 hover:bg-red-500/10"><X className="h-4 w-4" /> Reject</button>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex gap-2" role="tablist">
            {([['log', 'Live Activity Log', Activity], ['catalog', 'Catalog & Margin Rules', SlidersHorizontal]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          {tab === 'log' ? (
            <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
              {activityLog.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-3 rounded-lg bg-zinc-950 p-3 text-sm">
                  <div>
                    <div className={`text-xs ${logTone[l.kind]}`}>{l.kind.replace('-', ' ')} · <span className="text-zinc-500">{l.time}</span></div>
                    <div className="mt-0.5 text-zinc-300">{l.summary}</div>
                  </div>
                  {l.amount > 0 && <span className="tabular-nums text-emerald-400">{usd(l.amount)}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left">
                <thead className="text-xs text-zinc-500">
                  <tr><th className="pb-2 font-normal">Service</th><th className="font-normal">Cost $</th><th className="font-normal">Price $</th><th className="font-normal">Min margin %</th><th className="text-right font-normal">Margin</th></tr>
                </thead>
                <tbody>{catalog.map((s) => <CatalogRow key={s.id} sku={s} onSave={(v) => act({ action: 'updateCatalog', id: v.id, cost: v.cost, price: v.price, minMargin: v.minMargin })} />)}</tbody>
              </table>
              <p className="mt-3 text-xs text-zinc-500">Edits apply on blur. The sentinel uses these numbers on the next message.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
