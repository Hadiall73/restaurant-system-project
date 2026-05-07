import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Letzten Tag eines Monats als YYYY-MM-DD (ohne UTC-Bug) */
function monthEnd(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate(); // day 0 = letzter Tag des Vormonats → funktioniert lokal
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Aktuellen Monat als YYYY-MM (ohne UTC-Bug) */
function currentMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurant_id = searchParams.get("restaurant_id");
  const month = searchParams.get("month") || currentMonth(); // YYYY-MM

  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });
  }

  // Datumsgrenzen — ohne UTC-Konvertierung
  const startDate = `${month}-01`;
  const endDate   = monthEnd(month);

  const admin = getAdmin();

  const [salesRes, expensesRes, shiftsRes, entriesRes] = await Promise.all([
    admin
      .from("sales")
      .select("amount, tip, recorded_at")
      .eq("restaurant_id", restaurant_id)
      .gte("recorded_at", `${startDate}T00:00:00`)
      .lte("recorded_at", `${endDate}T23:59:59`),

    admin
      .from("expenses")
      .select("amount_gross, amount_net, vat_amount, category, invoice_date")
      .eq("restaurant_id", restaurant_id)
      .gte("invoice_date", startDate)
      .lte("invoice_date", endDate),

    admin
      .from("shifts")
      .select("actual_start, actual_end, hourly_wage, user_id, profiles(name)")
      .eq("restaurant_id", restaurant_id)
      .gte("start_time", `${startDate}T00:00:00`)
      .lte("start_time", `${endDate}T23:59:59`)
      .not("actual_end", "is", null),

    admin
      .from("bookkeeping_entries")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .order("entry_date", { ascending: false }),
  ]);

  const sales    = salesRes.data    || [];
  const expenses = expensesRes.data || [];
  const shifts   = shiftsRes.data   || [];
  const entries  = entriesRes.data  || [];

  // ── Umsatz (Brutto) ──────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, r) => s + Number(r.amount) + Number(r.tip || 0), 0);

  // ── Ausgaben ─────────────────────────────────────────────────────────────
  // Brutto für die GuV-Ansicht
  const totalExpensesGross = expenses.reduce((s, e) => s + Number(e.amount_gross), 0);
  // Netto für die MwSt-Berechnung
  const totalExpensesNet   = expenses.reduce((s, e) => s + Number(e.amount_net),   0);

  // ── Personalkosten ───────────────────────────────────────────────────────
  const wagesByEmployee: Record<string, { name: string; hours: number; wages: number }> = {};
  shifts.forEach((shift: any) => {
    if (!shift.actual_start || !shift.actual_end) return;
    const hours = (new Date(shift.actual_end).getTime() - new Date(shift.actual_start).getTime()) / 3_600_000;
    const wages = hours * Number(shift.hourly_wage || 13);
    const uid   = shift.user_id;
    const name  = (shift.profiles as any)?.name || "Unbekannt";
    if (!wagesByEmployee[uid]) wagesByEmployee[uid] = { name, hours: 0, wages: 0 };
    wagesByEmployee[uid].hours += hours;
    wagesByEmployee[uid].wages += wages;
  });
  const totalWages = Object.values(wagesByEmployee).reduce((s, e) => s + e.wages, 0);

  // ── MwSt (korrekte Berechnung) ───────────────────────────────────────────
  // Umsatzsteuer: aus Brutto-Erlösen herausrechnen (19% Restaurantleistung)
  // Formel: USt = Brutto × 19/119  (nicht × 0,19, das wäre falsch!)
  const collectVat = sales.reduce((s, r) => s + (Number(r.amount) * 19) / 119, 0);

  // Vorsteuer: direkt aus den Ausgaben (dort bereits exakt erfasst)
  const inputVat   = expenses.reduce((s, e) => s + Number(e.vat_amount || 0), 0);

  // Umsatzsteuer-Zahllast (positiv = zahlen, negativ = Erstattung)
  const vatPayable = collectVat - inputVat;

  // ── Gewinn (Netto-Sicht) ─────────────────────────────────────────────────
  // Netto-Umsatz = Brutto ÷ 1,19  (19% Regel; exakte Aufteilung nur mit Artikeldaten möglich)
  const netRevenue = totalRevenue / 1.19;
  // Personalkosten sind bereits netto (keine MwSt auf Löhne)
  const profit     = netRevenue - totalExpensesNet - totalWages;
  const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

  // ── Ausgaben nach Kategorie ──────────────────────────────────────────────
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach((e: any) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount_gross);
  });

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    summary: {
      totalRevenue:    round2(totalRevenue),
      totalExpenses:   round2(totalExpensesGross),
      totalWages:      round2(totalWages),
      netRevenue:      round2(netRevenue),
      profit:          round2(profit),
      profitMargin:    round2(profitMargin),
      collectVat:      round2(collectVat),
      inputVat:        round2(inputVat),
      vatPayable:      round2(vatPayable),
    },
    expensesByCategory,
    wagesByEmployee: Object.values(wagesByEmployee).map(e => ({
      ...e,
      hours: round2(e.hours),
      wages: round2(e.wages),
    })),
    entries,
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
