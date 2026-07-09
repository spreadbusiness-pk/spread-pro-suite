// Shared costing helpers — usable in client & server without side effects.
export type CostBreakdown = {
  paper_cost: number;
  ctp_cost: number;
  printing_cost: number;
  ink_cost: number;
  finishing_cost: number;
  binding_cost: number;
  labour_cost: number;
  transport_cost: number;
  misc_cost: number;
  total_cost: number;
  profit_pct: number;
  selling_price: number;
  net_profit: number;
};

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function computeTotals(input: Partial<CostBreakdown> & { override_selling?: number | null }): CostBreakdown {
  const paper = num(input.paper_cost);
  const ctp = num(input.ctp_cost);
  const printing = num(input.printing_cost);
  const ink = num(input.ink_cost);
  const finishing = num(input.finishing_cost);
  const binding = num(input.binding_cost);
  const labour = num(input.labour_cost);
  const transport = num(input.transport_cost);
  const misc = num(input.misc_cost);
  const total = paper + ctp + printing + ink + finishing + binding + labour + transport + misc;
  const profit_pct = num(input.profit_pct);
  const selling = input.override_selling != null && num(input.override_selling) > 0
    ? num(input.override_selling)
    : Math.round((total * (1 + profit_pct / 100)) * 100) / 100;
  const net = Math.round((selling - total) * 100) / 100;
  return {
    paper_cost: paper,
    ctp_cost: ctp,
    printing_cost: printing,
    ink_cost: ink,
    finishing_cost: finishing,
    binding_cost: binding,
    labour_cost: labour,
    transport_cost: transport,
    misc_cost: misc,
    total_cost: Math.round(total * 100) / 100,
    profit_pct,
    selling_price: selling,
    net_profit: net,
  };
}

export function formatCurrency(v: number, currency = "PKR"): string {
  try {
    return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${currency} ${v.toLocaleString()}`;
  }
}
