export type Sku = { id: string; name: string; cost: number; price: number; minMargin: number };
export type Approval = {
  id: string;
  kind: 'discount' | 'costhike' | 'review';
  customer: string;
  message: string;
  reason: string;
  reply: string;
  skuId: string;
  value: number; // revenue recovered if approved
  saved: number; // margin protected if approved
  newCost?: number;
  newPrice?: number;
};
export type Log = {
  id: string;
  time: string;
  kind: 'auto-close' | 'approved' | 'rejected' | 'alert';
  summary: string;
  amount: number;
};
export type Store = {
  kpis: { recoveredRevenue: number; marginSaved: number; hoursSaved: number };
  catalog: Sku[];
  pendingApprovals: Approval[];
  activityLog: Log[];
};

const seed = (): Store => ({
  kpis: { recoveredRevenue: 14850, marginSaved: 3240, hoursSaved: 42.5 },
  catalog: [
    { id: 'ac', name: 'AC Tune-Up', cost: 95, price: 189, minMargin: 0.4 },
    { id: 'wh', name: 'Water Heater Install', cost: 620, price: 1090, minMargin: 0.35 },
    { id: 'drain', name: 'Emergency Drain Clearing', cost: 70, price: 210, minMargin: 0.5 },
    { id: 'duct', name: 'Duct Cleaning', cost: 180, price: 340, minMargin: 0.35 },
  ],
  pendingApprovals: [
    {
      id: 'seed-1',
      kind: 'discount',
      customer: 'Maria G. · Plano, TX',
      message: 'Can you do 15% off the water heater install if I book this week?',
      reason: '15% off drops margin to 33.1% (floor 35.0%)',
      reply:
        "Thanks, Maria! We can't do 15% off, but we can do the install at $954 (12% off) with a Friday slot. Want me to lock it in?",
      skuId: 'wh',
      value: 954,
      saved: 28,
    },
    {
      id: 'seed-2',
      kind: 'costhike',
      customer: 'Supplier notice · Lone Star HVAC Supply',
      message: 'Duct cleaning materials up 25% effective Monday.',
      reason: 'Cost $180 → $225 drops margin to 33.8% (floor 35.0%)',
      reply:
        'Internal: raise Duct Cleaning from $340 to $347 to hold the 35.0% margin floor. Notify scheduled customers?',
      skuId: 'duct',
      value: 0,
      saved: 175,
      newCost: 225,
      newPrice: 347,
    },
  ],
  activityLog: [
    { id: 'l1', time: 'Yesterday 11:42 PM', kind: 'auto-close', summary: 'Booked emergency drain clearing for Frisco lead', amount: 210 },
    { id: 'l2', time: 'Yesterday 9:15 PM', kind: 'auto-close', summary: 'Booked AC tune-up for McKinney homeowner', amount: 189 },
    { id: 'l3', time: 'Yesterday 6:30 PM', kind: 'alert', summary: 'Supplier +4% on drain parts absorbed, margin still above floor', amount: 0 },
  ],
});

const g = globalThis as unknown as { __sentinel?: Store };
export const getStore = (): Store => (g.__sentinel ??= seed());
export const resetStore = (): Store => (g.__sentinel = seed());

export const uid = () => Math.random().toString(36).slice(2, 9);
export const now = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const margin = (price: number, cost: number) => (price > 0 ? (price - cost) / price : 0);
