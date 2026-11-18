import { NextResponse } from 'next/server';
import { getStore, resetStore, uid, now } from '@/lib/store';

export async function GET() {
  return NextResponse.json(getStore());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.action === 'reset') return NextResponse.json(resetStore());

  const s = getStore();

  if (b.action === 'approve' || b.action === 'reject') {
    const i = s.pendingApprovals.findIndex((a) => a.id === b.id);
    if (i < 0) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    const [a] = s.pendingApprovals.splice(i, 1);
    const sku = s.catalog.find((k) => k.id === a.skuId);
    const label = sku ? sku.name : 'Message';

    if (b.action === 'approve') {
      const reply = typeof b.reply === 'string' && b.reply.trim() ? b.reply.trim() : a.reply;
      if (a.kind === 'costhike' && sku && a.newPrice && a.newCost) {
        sku.cost = a.newCost;
        sku.price = a.newPrice;
      }
      s.kpis.recoveredRevenue += a.value;
      s.kpis.marginSaved += a.saved;
      s.kpis.hoursSaved = Math.round((s.kpis.hoursSaved + 0.25) * 100) / 100;
      s.activityLog.unshift({
        id: uid(), time: now(), kind: 'approved',
        summary: `Approved ${label}: "${reply.length > 70 ? reply.slice(0, 70) + '…' : reply}"`,
        amount: a.value || a.saved,
      });
    } else {
      s.activityLog.unshift({ id: uid(), time: now(), kind: 'rejected', summary: `Rejected ${label} request from ${a.customer}`, amount: 0 });
    }
    return NextResponse.json(s);
  }

  if (b.action === 'updateCatalog') {
    const sku = s.catalog.find((k) => k.id === b.id);
    if (!sku) return NextResponse.json({ error: 'SKU not found' }, { status: 404 });
    const cost = Number(b.cost), price = Number(b.price), min = Number(b.minMargin);
    if (![cost, price, min].every(Number.isFinite) || cost < 0 || price <= 0 || min < 0 || min >= 1)
      return NextResponse.json({ error: 'Invalid values: cost >= 0, price > 0, 0 <= minMargin < 1' }, { status: 400 });
    Object.assign(sku, { cost, price, minMargin: min });
    return NextResponse.json(s);
  }

  return NextResponse.json(s); // 'state' or unknown returns current state
}
