import { NextResponse } from 'next/server';
import { getStore, margin, uid, now, type Approval } from '@/lib/store';

type Step = { title: string; status: 'pass' | 'warn' | 'fail'; lines: string[] };

const KW: Record<string, RegExp> = {
  ac: /\bac\b|a\/c|air.?condition|tune-?up|cooling/i,
  wh: /water heater|heater/i,
  drain: /drain|clog|sewer/i,
  duct: /duct|vent/i,
};
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const pc = (n: number) => `${(n * 100).toFixed(1)}%`;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: Request) {
  const { message = '', preset = null } = await req.json().catch(() => ({}));
  const text = String(message).trim();
  if (!text) return NextResponse.json({ error: 'Message required' }, { status: 400 });
  const s = getStore();

  // ---- 1. Extraction ----
  const sku = s.catalog.find((k) => KW[k.id]?.test(text));
  const qm = text.match(/\b(\d+|one|two|three|four|five)\s*(x|units?|systems?|heaters?|visits?|jobs?|tune-?ups?)\b/i);
  const qty = Math.min(50, Math.max(1, qm ? WORDS[qm[1].toLowerCase()] ?? parseInt(qm[1], 10) : 1));
  const pm = text.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  const pct = pm ? parseFloat(pm[1]) : 0;
  const supplier = /supplier|vendor|wholesale|distributor/i.test(text);
  const intent =
    supplier && pct ? 'supplier_cost_change' : pct && /off|discount|deal|cheaper/i.test(text) ? 'discount_request' : 'lead';
  const tm = text.match(/(\d{1,2}):\d{2}\s*(am|pm)/i);
  const hr = tm ? (parseInt(tm[1], 10) % 12) + (tm[2].toLowerCase() === 'pm' ? 12 : 0) : -1;
  const afterHours =
    preset === 1 || /after.?hours|tonight|overnight|weekend/i.test(text) || hr >= 18 || (hr >= 0 && hr < 7);

  const extraction: Step = {
    title: 'Extraction',
    status: sku ? 'pass' : 'warn',
    lines: [
      `Intent: ${intent.replace(/_/g, ' ')}`,
      `SKU: ${sku ? sku.name : 'no catalog match'} × ${qty}`,
      `Percent mentioned: ${pct ? pct + '%' : 'none'}`,
      `After hours: ${afterHours ? 'yes' : 'no'}`,
    ],
  };

  const finish = (marginCheck: Step, decision: Step, outcome: 'auto-closed' | 'needs-approval') =>
    NextResponse.json({ trace: { extraction, marginCheck, decision }, outcome, state: s });

  const queue = (a: Omit<Approval, 'id'>) => s.pendingApprovals.unshift({ id: uid(), ...a });

  // ---- No SKU: human review ----
  if (!sku) {
    queue({
      kind: 'review', customer: 'Inbound message', message: text, reason: 'No catalog SKU matched', skuId: '', value: 0, saved: 0,
      reply: 'Thanks for reaching out! A team member will confirm details and pricing first thing in the morning.',
    });
    return finish(
      { title: 'Margin Check', status: 'warn', lines: ['Skipped: nothing in the catalog to price against'] },
      { title: 'Decision', status: 'warn', lines: ['Routed to approval queue for human review'] },
      'needs-approval',
    );
  }

  const { cost, price, minMargin: min } = sku;

  // ---- Supplier cost change ----
  if (intent === 'supplier_cost_change') {
    const newCost = round2(cost * (1 + pct / 100));
    const m = margin(price, newCost);
    const ok = m >= min;
    const mc: Step = {
      title: 'Margin Check', status: ok ? 'pass' : 'fail',
      lines: [`Cost ${usd(cost)} → ${usd(newCost)} (+${pct}%)`, `Margin at ${usd(price)}: ${pc(m)} vs floor ${pc(min)}`],
    };
    if (ok) {
      s.kpis.hoursSaved = round2(s.kpis.hoursSaved + 0.25);
      s.activityLog.unshift({ id: uid(), time: now(), kind: 'alert', summary: `Supplier +${pct}% on ${sku.name} absorbed, margin ${pc(m)}`, amount: 0 });
      return finish(mc, { title: 'Decision', status: 'pass', lines: ['Margin holds above floor', 'Logged, no price change needed'] }, 'auto-closed');
    }
    const newPrice = Math.ceil(newCost / (1 - min));
    queue({
      kind: 'costhike', customer: 'Supplier notice', message: text,
      reason: `Margin falls to ${pc(m)} (floor ${pc(min)})`, skuId: sku.id, value: 0,
      saved: (newPrice - price) * 25, newCost, newPrice,
      reply: `Internal: raise ${sku.name} from ${usd(price)} to ${usd(newPrice)} to hold the ${pc(min)} margin floor. Notify scheduled customers?`,
    });
    return finish(mc, { title: 'Decision', status: 'warn', lines: [`Price alert: suggest ${usd(newPrice)}`, 'Routed to approval queue'] }, 'needs-approval');
  }

  // ---- Discount request ----
  if (intent === 'discount_request') {
    const offer = round2(price * (1 - pct / 100));
    const m = margin(offer, cost);
    const ok = m >= min;
    const mc: Step = {
      title: 'Margin Check', status: ok ? 'pass' : 'fail',
      lines: [`${sku.name} at ${pct}% off: ${usd(offer)}`, `Margin ${pc(m)} vs floor ${pc(min)}`],
    };
    if (ok) {
      s.kpis.recoveredRevenue += offer * qty;
      s.kpis.hoursSaved = round2(s.kpis.hoursSaved + 0.5);
      s.activityLog.unshift({ id: uid(), time: now(), kind: 'auto-close', summary: `Closed ${qty}× ${sku.name} at ${pct}% off`, amount: offer * qty });
      return finish(mc, { title: 'Decision', status: 'pass', lines: ['Discount is within the margin floor', `Auto-closed ${usd(offer * qty)}`] }, 'auto-closed');
    }
    const floor = Math.ceil(cost / (1 - min));
    const off = Math.round((1 - floor / price) * 100);
    queue({
      kind: 'discount', customer: afterHours ? 'After-hours customer' : 'Customer', message: text,
      reason: `${pct}% off drops margin to ${pc(m)} (floor ${pc(min)})`, skuId: sku.id,
      value: floor * qty, saved: (floor - offer) * qty,
      reply: `Thanks for booking with us! We can't do ${pct}% off, but we can offer ${qty > 1 ? `all ${qty} at ` : ''}${usd(floor)}${qty > 1 ? ' each' : ''} (${off}% off). Want me to lock in a slot?`,
    });
    return finish(mc, { title: 'Decision', status: 'warn', lines: [`Margin Guard blocked ${pct}%`, `Counter-offer ready at ${usd(floor)}`, 'Routed to approval queue'] }, 'needs-approval');
  }

  // ---- Plain lead: auto-close ----
  const m = margin(price, cost);
  const mc: Step = { title: 'Margin Check', status: m >= min ? 'pass' : 'fail', lines: [`List price ${usd(price)}, cost ${usd(cost)}`, `Margin ${pc(m)} vs floor ${pc(min)}`] };
  if (m < min) {
    queue({ kind: 'review', customer: 'Inbound lead', message: text, reason: `Catalog margin ${pc(m)} is under the floor`, skuId: sku.id, value: price * qty, saved: 0,
      reply: `Thanks! We can fit you in tomorrow. ${sku.name} is ${usd(price)}.` });
    return finish(mc, { title: 'Decision', status: 'warn', lines: ['Catalog price breaks margin rule', 'Routed to approval queue'] }, 'needs-approval');
  }
  s.kpis.recoveredRevenue += price * qty;
  s.kpis.hoursSaved = round2(s.kpis.hoursSaved + 0.5);
  s.activityLog.unshift({ id: uid(), time: now(), kind: 'auto-close', summary: `${afterHours ? 'After-hours lead' : 'Lead'} booked: ${qty}× ${sku.name}`, amount: price * qty });
  return finish(
    mc,
    { title: 'Decision', status: 'pass', lines: [`Replied: "You're booked for 8:00 AM tomorrow, ${usd(price * qty)}. Reply C to confirm."`, `Auto-closed ${usd(price * qty)}`] },
    'auto-closed',
  );
}
