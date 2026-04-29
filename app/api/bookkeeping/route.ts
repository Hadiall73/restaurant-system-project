import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurant_id = searchParams.get("restaurant_id");
  const month = searchParams.get("month"); // YYYY-MM

  if (!restaurant_id) return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });

  const startDate = month ? `${month}-01` : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const endDate = month
    ? new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0).toISOString().slice(0, 10)
    : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);

  const supabaseAdmin = getAdmin();
  const [salesRes, expensesRes, shiftsRes, entriesRes] = await Promise.all([
    supabaseAdmin.from("sales").select("amount, tip, recorded_at").eq("restaurant_id", restaurant_id).gte("recorded_at", startDate).lte("recorded_at", endDate + "T23:59:59"),
    supabaseAdmin.from("expenses").select("amount_gross, amount_net, vat_amount, category, invoice_date").eq("restaurant_id", restaurant_id).gte("invoice_date", startDate).lte("invoice_date", endDate),
    supabaseAdmin.from("shifts").select("actual_start, actual_end, hourly_wage, user_id, profiles(name)").eq("restaurant_id", restaurant_id).gte("start_time", startDate).lte("start_time", endDate + "T23:59:59").not("actual_end", "is", null),
    supabaseAdmin.from("bookkeeping_entries").select("*").eq("restaurant_id", restaurant_id).gte("entry_date", startDate).lte("entry_date", endDate).order("entry_date", { ascending: false }),
  ]);

  const totalRevenue = (salesRes.data || []).reduce((s, r) => s + Number(r.amount) + Number(r.tip || 0), 0);
  const totalExpenses = (expensesRes.data || []).reduce((s, e) => s + Number(e.amount_gross), 0);
  const totalVat = (salesRes.data || []).reduce((s, r) => s + Number(r.amount) * 0.19, 0);
  const inputVat = (expensesRes.data || []).reduce((s, e) => s + Number(e.vat_amount || 0), 0);
  const vatPayable = totalVat - inputVat;

  const wagesByEmployee: Record<string, { name: string; hours: number; wages: number }> = {};
  (shiftsRes.data || []).forEach((shift: any) => {
    if (!shift.actual_start || !shift.actual_end) return;
    const hours = (new Date(shift.actual_end).getTime() - new Date(shift.actual_start).getTime()) / 3600000;
    const wages = hours * Number(shift.hourly_wage || 13);
    const name = shift.profiles?.name || shift.user_id;
    if (!wagesByEmployee[shift.user_id]) wagesByEmployee[shift.user_id] = { name, hours: 0, wages: 0 };
    wagesByEmployee[shift.user_id].hours += hours;
    wagesByEmployee[shift.user_id].wages += wages;
  });
  const totalWages = Object.values(wagesByEmployee).reduce((s, e) => s + e.wages, 0);
  const profit = totalRevenue - totalExpenses - totalWages;

  const expensesByCategory: Record<string, number> = {};
  (expensesRes.data || []).forEach((e: any) => {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount_gross);
  });

  return NextResponse.json({
    period: { start: startDate, end: endDate },
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalWages: Math.round(totalWages * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      profitMargin: totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0,
      vatPayable: Math.round(vatPayable * 100) / 100,
      inputVat: Math.round(inputVat * 100) / 100,
    },
    expensesByCategory,
    wagesByEmployee: Object.values(wagesByEmployee),
    entries: entriesRes.data || [],
  });
}
