"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import type { Sale, Shift, DishOrder } from "@/lib/supabase";
import { TrendingUp, TrendingDown, Users, Euro, ShoppingBag, Clock, Wifi, Pencil, Check, X, Flame, BarChart2, FlaskConical, Trash2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import toast from "react-hot-toast";

interface HourlySales  { hour: string; amount: number; txn: number; }
interface DailySales   { day: string; date: string; amount: number; vw: number; }
interface PeakHour     { hour: string; avg: number; days: number; }
interface DishCount    { name: string; count: number; category: string; }

// ── Radial Gauge ──────────────────────────────────────────────────────────────
function RadialGauge({ value, max, label, unit, color, sublabel }: {
  value: number; max: number; label: string; unit?: string; color: string; sublabel?: string;
}) {
  const pct = Math.min(value / (max || 1), 1);
  const r = 52; const cx = 70; const cy = 70;
  const totalDeg = 260; const startAngle = 220;

  function polar(deg: number, radius: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function arcPath(fromDeg: number, toDeg: number, radius: number) {
    const start = polar(fromDeg, radius); const end = polar(toDeg, radius);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const sweep = toDeg > fromDeg ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} ${sweep} ${end.x} ${end.y}`;
  }

  const bgEndAngle   = startAngle + totalDeg;
  const fillEndAngle = startAngle + pct * totalDeg;

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={130} viewBox="0 0 140 130">
        <path d={arcPath(startAngle, bgEndAngle, r)} fill="none" stroke="#1f2937" strokeWidth={10} strokeLinecap="round" />
        {pct > 0 && <path d={arcPath(startAngle, fillEndAngle, r)} fill="none" stroke={pct >= 1 ? "#22c55e" : color} strokeWidth={10} strokeLinecap="round" />}
        <circle cx={polar(fillEndAngle, r).x} cy={polar(fillEndAngle, r).y} r={5} fill={pct >= 1 ? "#22c55e" : color} />
        <text x={cx} y={cy + 2}  textAnchor="middle" fill="white"   fontSize={14} fontWeight="bold">{value}{unit}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#6b7280" fontSize={9}>von {max}{unit}</text>
        {sublabel && <text x={cx} y={cy + 28} textAnchor="middle" fill="#f97316" fontSize={8}>{sublabel}</text>}
      </svg>
      <p className="text-xs text-gray-400 -mt-2">{label}</p>
    </div>
  );
}

// ── Custom Tooltip für Stoßzeiten ─────────────────────────────────────────────
function PeakTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1">{label} Uhr</p>
      <p className="text-orange-400 font-bold">{Number(payload[0].value).toFixed(2)} € Ø</p>
      <p className="text-gray-500">{payload[0].payload.days} Tage gemessen</p>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function RealtimeDashboard() {
  const { restaurant } = useStore();

  const [todaySales,   setTodaySales]   = useState<Sale[]>([]);
  const [activeShifts, setActiveShifts] = useState<(Shift & { profiles?: { name: string } })[]>([]);
  const [dishCounts,   setDishCounts]   = useState<DishCount[]>([]);
  const [hourlySales,  setHourlySales]  = useState<HourlySales[]>([]);
  const [dailySales,   setDailySales]   = useState<DailySales[]>([]);
  const [peakHours,    setPeakHours]    = useState<PeakHour[]>([]);
  const [yesterdayTotal, setYesterdayTotal] = useState(0);

  // Tagesziel
  const [dailyGoal,    setDailyGoal]    = useState(1000);
  const [editingGoal,  setEditingGoal]  = useState(false);
  const [goalInput,    setGoalInput]    = useState("");

  // Personal-Soll
  const [staffGoal,    setStaffGoal]    = useState(10);
  const [editingStaff, setEditingStaff] = useState(false);
  const [staffInput,   setStaffInput]   = useState("");
  const [demoModus,    setDemoModus]    = useState(false);

  useEffect(() => {
    const g = localStorage.getItem("dailyGoal");  if (g) setDailyGoal(Number(g));
    const s = localStorage.getItem("staffGoal");  if (s) setStaffGoal(Number(s));
  }, []);

  function genDemoData() {
    const PREISE = [3.50, 4.20, 5.50, 6.50, 9.90, 12.90, 13.50, 14.90, 16.50];
    const ZAHLARTEN: ("cash"|"card"|"online")[] = ["cash","card","card","card","online"];
    const pick = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
    const rnd  = (min: number, max: number) => Math.random() * (max - min) + min;
    const now  = new Date();
    const today = now.toISOString().slice(0, 10);

    // Heute-Sales
    const demoToday: Sale[] = [];
    for (let i = 0; i < 18; i++) {
      const h = Math.floor(rnd(11, 22));
      let amount = 0;
      for (let j = 0; j < Math.floor(rnd(1, 4)); j++) amount += pick(PREISE);
      demoToday.push({ id: `d${i}`, restaurant_id: "", amount: Math.round(amount*100)/100, tip: Math.random()>0.5?2:0, payment_method: pick(ZAHLARTEN), table_number: Math.floor(rnd(1,20)), recorded_at: `${today}T${String(h).padStart(2,"0")}:${String(Math.floor(rnd(0,59))).padStart(2,"0")}:00Z`, recorded_by: null } as any);
    }
    setTodaySales(demoToday);
    setYesterdayTotal(Math.round(rnd(600, 1400)));

    // Stündliche Aufteilung
    const byHour: Record<string, {amount:number;txn:number}> = {};
    demoToday.forEach(s => {
      const h = new Date(s.recorded_at).getHours();
      const lbl = `${h}:00`;
      if (!byHour[lbl]) byHour[lbl] = {amount:0,txn:0};
      byHour[lbl].amount += Number(s.amount);
      byHour[lbl].txn++;
    });
    setHourlySales(Object.entries(byHour).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([hour,v])=>({hour,...v})));

    // 7-Tage
    const daily: DailySales[] = [];
    const DAYS = ["So","Mo","Di","Mi","Do","Fr","Sa"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i*86400000);
      daily.push({ date: d.toISOString().slice(0,10), day: DAYS[d.getDay()], amount: Math.round(rnd(400,1600)*100)/100, vw: 0 });
    }
    setDailySales(daily);

    // Stoßzeiten
    const peaks: PeakHour[] = [
      {hour:"12",avg:280,days:14},{hour:"13",avg:320,days:14},{hour:"14",avg:210,days:14},
      {hour:"19",avg:350,days:14},{hour:"20",avg:420,days:14},{hour:"21",avg:380,days:14},
    ];
    setPeakHours(peaks);

    toast.success("Demo-Daten geladen!");
    setDemoModus(true);
  }

  function clearDemoData() {
    setDemoModus(false);
    loadData();
    toast.success("Echte Daten geladen");
  }

  function saveGoal() {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) { setDailyGoal(val); localStorage.setItem("dailyGoal", String(val)); toast.success(`Tagesziel: ${val.toFixed(0)} €`); }
    setEditingGoal(false);
  }
  function saveStaffGoal() {
    const val = parseInt(staffInput);
    if (!isNaN(val) && val > 0) { setStaffGoal(val); localStorage.setItem("staffGoal", String(val)); toast.success(`Personal-Soll: ${val}`); }
    setEditingStaff(false);
  }

  const loadData = useCallback(async () => {
    if (!restaurant) return;

    const today      = new Date().toISOString().slice(0, 10);
    const yesterday  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

    const [salesRes, shiftsRes, dishRes, weekRes, yRes] = await Promise.all([
      // Heute
      supabase.from("sales").select("*").eq("restaurant_id", restaurant.id)
        .gte("recorded_at", today + "T00:00:00").order("recorded_at", { ascending: true }),
      // Aktive Schichten
      supabase.from("shifts").select("*, profiles(name)").eq("restaurant_id", restaurant.id).eq("is_clocked_in", true),
      // Gerichte heute
      supabase.from("dish_orders").select("*, menu_items(name, category)").eq("restaurant_id", restaurant.id)
        .gte("ordered_at", today + "T00:00:00"),
      // Letzte 14 Tage für Wochengraph + Stoßzeiten
      supabase.from("sales").select("amount, recorded_at").eq("restaurant_id", restaurant.id)
        .gte("recorded_at", twoWeeksAgo + "T00:00:00").order("recorded_at", { ascending: true }),
      // Gestern für Vergleich
      supabase.from("sales").select("amount").eq("restaurant_id", restaurant.id)
        .gte("recorded_at", yesterday + "T00:00:00")
        .lt("recorded_at",  today    + "T00:00:00"),
    ]);

    // ── Heute ───────────────────────────────────────────────────────────────
    if (salesRes.data) {
      setTodaySales(salesRes.data);
      const byHour: Record<string, { amount: number; txn: number }> = {};
      salesRes.data.forEach(s => {
        const h = new Date(s.recorded_at).getHours();
        const lbl = `${h}:00`;
        if (!byHour[lbl]) byHour[lbl] = { amount: 0, txn: 0 };
        byHour[lbl].amount += Number(s.amount);
        byHour[lbl].txn++;
      });
      setHourlySales(
        Object.entries(byHour)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([hour, v]) => ({ hour, ...v }))
      );
    }

    // ── Gestern ─────────────────────────────────────────────────────────────
    if (yRes.data) {
      setYesterdayTotal(yRes.data.reduce((s, r) => s + Number(r.amount), 0));
    }

    // ── Schichten & Gerichte ─────────────────────────────────────────────────
    if (shiftsRes.data) setActiveShifts(shiftsRes.data as any);
    if (dishRes.data) {
      const counts: Record<string, DishCount> = {};
      dishRes.data.forEach((d: any) => {
        const name = d.menu_items?.name || "Unbekannt";
        const cat  = d.menu_items?.category || "";
        if (!counts[name]) counts[name] = { name, count: 0, category: cat };
        counts[name].count += d.quantity;
      });
      setDishCounts(Object.values(counts).sort((a, b) => b.count - a.count));
    }

    // ── 7-Tage Verlauf ───────────────────────────────────────────────────────
    if (weekRes.data) {
      const all = weekRes.data;

      // Tages-Gruppierung (letzte 7 Tage)
      const dayMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        dayMap[d] = 0;
      }
      all.forEach(s => {
        const d = s.recorded_at.slice(0, 10);
        if (d in dayMap) dayMap[d] += Number(s.amount);
      });

      const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      const dailyArr: DailySales[] = Object.entries(dayMap).map(([date, amount], i, arr) => ({
        date,
        day: DAY_NAMES[new Date(date).getDay()],
        amount,
        vw: arr[i - 7]?.[1] ?? 0,
      }));
      setDailySales(dailyArr);

      // Stoßzeiten: Ø pro Stunde über alle Tage
      const hourMap: Record<number, { total: number; days: Set<string> }> = {};
      all.forEach(s => {
        const h   = new Date(s.recorded_at).getHours();
        const day = s.recorded_at.slice(0, 10);
        if (!hourMap[h]) hourMap[h] = { total: 0, days: new Set() };
        hourMap[h].total += Number(s.amount);
        hourMap[h].days.add(day);
      });
      const peaks: PeakHour[] = Array.from({ length: 24 }, (_, h) => {
        const entry = hourMap[h];
        const days  = entry ? entry.days.size : 0;
        return { hour: `${h}`, avg: days > 0 ? entry.total / days : 0, days };
      }).filter(p => p.avg > 0);
      setPeakHours(peaks);
    }
  }, [restaurant]);

  useEffect(() => {
    loadData();
    if (!restaurant) return;
    const channel = supabase.channel(`restaurant-${restaurant.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales",      filter: `restaurant_id=eq.${restaurant.id}` }, () => { loadData(); toast.success("Neuer Umsatz!"); })
      .on("postgres_changes", { event: "*",      schema: "public", table: "shifts",     filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dish_orders",filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurant, loadData]);

  // ── Berechnungen ─────────────────────────────────────────────────────────
  const totalToday  = todaySales.reduce((s, r) => s + Number(r.amount), 0);
  const avgBon      = todaySales.length > 0 ? totalToday / todaySales.length : 0;
  const goalPct     = Math.round(Math.min((totalToday / dailyGoal) * 100, 100));
  const remaining   = Math.max(dailyGoal - totalToday, 0);
  const trendPct    = yesterdayTotal > 0 ? ((totalToday - yesterdayTotal) / yesterdayTotal) * 100 : null;
  const bestHour    = peakHours.length > 0 ? peakHours.reduce((a, b) => a.avg > b.avg ? a : b) : null;
  const bestDay     = dailySales.length > 0 ? [...dailySales].sort((a, b) => b.amount - a.amount)[0] : null;
  const weekTotal   = dailySales.reduce((s, d) => s + d.amount, 0);

  const PIE_COLORS = ["#f97316", "#3b82f6", "#8b5cf6"];
  const payBreakdown = ["cash", "card", "online"].map(m => ({
    name:  m === "cash" ? "Bar" : m === "card" ? "Karte" : "Online",
    value: todaySales.filter(s => s.payment_method === m).reduce((sum, s) => sum + Number(s.amount), 0),
  })).filter(d => d.value > 0);

  // Stoßzeiten-Heatmap: Intensitätsfarbe je nach Wert
  const maxPeak = peakHours.length > 0 ? Math.max(...peakHours.map(p => p.avg)) : 1;
  function peakColor(avg: number) {
    const pct = avg / maxPeak;
    if (pct > 0.75) return "#f97316";
    if (pct > 0.45) return "#fb923c";
    if (pct > 0.2)  return "#fed7aa";
    return "#78350f";
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-2">
          {!demoModus ? (
            <button onClick={genDemoData}
              className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
              <FlaskConical size={12} /> Testdaten laden
            </button>
          ) : (
            <button onClick={clearDemoData}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
              <Trash2 size={12} /> Demo ausblenden
            </button>
          )}
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">Live</span>
            <Wifi size={12} className="text-green-400" />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Umsatz Heute */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-orange-500 p-2.5 rounded-xl"><Euro size={18} className="text-white" /></div>
            {trendPct !== null && (
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${trendPct >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
                {trendPct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(trendPct).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm">Umsatz Heute</p>
          <p className="text-2xl font-bold text-white mt-1">{totalToday.toFixed(2)} €</p>
          <p className="text-gray-600 text-xs mt-1">Gestern: {yesterdayTotal.toFixed(2)} €</p>
        </div>

        {/* Transaktionen */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-blue-500 p-2.5 rounded-xl"><ShoppingBag size={18} className="text-white" /></div>
          </div>
          <p className="text-gray-400 text-sm">Transaktionen</p>
          <p className="text-2xl font-bold text-white mt-1">{todaySales.length}</p>
          <p className="text-gray-600 text-xs mt-1">Ø Bon: {avgBon.toFixed(2)} €</p>
        </div>

        {/* Wochenumsatz */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-purple-500 p-2.5 rounded-xl"><BarChart2 size={18} className="text-white" /></div>
          </div>
          <p className="text-gray-400 text-sm">7-Tage Umsatz</p>
          <p className="text-2xl font-bold text-white mt-1">{weekTotal.toFixed(0)} €</p>
          <p className="text-gray-600 text-xs mt-1">
            {bestDay ? `Bester Tag: ${bestDay.day} (${bestDay.amount.toFixed(0)} €)` : "–"}
          </p>
        </div>

        {/* Stoßzeit */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-rose-500 p-2.5 rounded-xl"><Flame size={18} className="text-white" /></div>
          </div>
          <p className="text-gray-400 text-sm">Beste Stoßzeit</p>
          <p className="text-2xl font-bold text-white mt-1">{bestHour ? `${bestHour.hour}:00` : "–"}</p>
          <p className="text-gray-600 text-xs mt-1">{bestHour ? `Ø ${bestHour.avg.toFixed(0)} € / Tag` : "Noch keine Daten"}</p>
        </div>
      </div>

      {/* ── 7-Tage Verlauf + Gauge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Umsatz letzte 7 Tage</h3>
            <span className="text-gray-500 text-xs">{weekTotal.toFixed(0)} € gesamt</span>
          </div>
          {dailySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailySales} barCategoryGap="30%">
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f97316" stopOpacity={1} />
                    <stop offset="100%" stopColor="#c2410c" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 12 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} width={50} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }}
                  formatter={(v: any) => [`${Number(v).toFixed(2)} €`, "Umsatz"]}
                  labelFormatter={(l) => {
                    const d = dailySales.find(s => s.day === l);
                    return d ? new Date(d.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" }) : l;
                  }}
                />
                <Bar dataKey="amount" name="Umsatz" fill="url(#barGrad)" radius={[6, 6, 0, 0]}>
                  {dailySales.map((entry, i) => (
                    <Cell key={i} fill={entry.date === today ? "#22c55e" : "url(#barGrad)"} />
                  ))}
                </Bar>
                <ReferenceLine y={dailyGoal} stroke="#f97316" strokeDasharray="4 4" label={{ value: "Ziel", fill: "#f97316", fontSize: 10, position: "right" }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Noch keine Daten</div>
          )}
          <p className="text-gray-600 text-xs mt-2">Grüner Balken = heute · Gestrichelte Linie = Tagesziel</p>
        </div>

        {/* Gauge Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="font-semibold text-white">Messwerte</h3>
          <div className="flex justify-around">
            <div className="flex flex-col items-center gap-1">
              <RadialGauge value={goalPct} max={100} label="Tagesziel" unit="%" color="#f97316" sublabel={goalPct >= 100 ? "Erreicht!" : undefined} />
              {editingGoal ? (
                <div className="flex items-center gap-1 mt-1">
                  <input autoFocus type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                    placeholder={String(dailyGoal)}
                    className="w-20 bg-gray-800 border border-orange-500 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                  <button onClick={saveGoal} className="text-green-400 hover:text-green-300"><Check size={13} /></button>
                  <button onClick={() => setEditingGoal(false)} className="text-red-400 hover:text-red-300"><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true); }}
                  className="flex items-center gap-1 text-gray-500 hover:text-orange-400 text-xs transition-colors">
                  <Pencil size={10} /> {dailyGoal.toFixed(0)} €
                </button>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <RadialGauge value={activeShifts.length} max={staffGoal} label="Personal" unit="" color="#3b82f6" />
              {editingStaff ? (
                <div className="flex items-center gap-1 mt-1">
                  <input autoFocus type="number" value={staffInput} onChange={e => setStaffInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveStaffGoal(); if (e.key === "Escape") setEditingStaff(false); }}
                    placeholder={String(staffGoal)}
                    className="w-16 bg-gray-800 border border-blue-500 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                  <button onClick={saveStaffGoal} className="text-green-400 hover:text-green-300"><Check size={13} /></button>
                  <button onClick={() => setEditingStaff(false)} className="text-red-400 hover:text-red-300"><X size={13} /></button>
                </div>
              ) : (
                <button onClick={() => { setStaffInput(String(staffGoal)); setEditingStaff(true); }}
                  className="flex items-center gap-1 text-gray-500 hover:text-blue-400 text-xs transition-colors">
                  <Pencil size={10} /> Soll: {staffGoal}
                </button>
              )}
            </div>
          </div>

          {/* Zahlungsarten Donut */}
          {payBreakdown.length > 0 ? (
            <div>
              <p className="text-xs text-gray-400 mb-2 text-center">Zahlungsarten</p>
              <div className="flex items-center gap-3">
                <PieChart width={80} height={80}>
                  <Pie data={payBreakdown} cx={35} cy={35} innerRadius={22} outerRadius={38} dataKey="value" strokeWidth={0}>
                    {payBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
                <div className="flex flex-col gap-1.5 flex-1">
                  {payBreakdown.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-gray-400 text-xs">{d.name}</span>
                      </div>
                      <span className="text-white text-xs font-medium">{d.value.toFixed(0)}€</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">Noch keine Zahlungen</div>
          )}

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Tagesziel</span>
              <span>{totalToday.toFixed(0)} / {dailyGoal.toFixed(0)} €</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="h-2 rounded-full transition-all" style={{ width: `${goalPct}%`, background: goalPct >= 100 ? "#22c55e" : "#f97316" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Stoßzeiten + Stunden-Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stoßzeiten Heatmap */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Flame size={16} className="text-rose-400" /> Stoßzeiten (letzte 14 Tage)
            </h3>
            {bestHour && (
              <span className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-1 rounded-full">
                Peak: {bestHour.hour}:00 Uhr
              </span>
            )}
          </div>
          {peakHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peakHours} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="hour" stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={h => `${h}h`} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={v => `${v}€`} width={42} />
                <Tooltip content={<PeakTooltip />} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {peakHours.map((p, i) => (
                    <Cell key={i} fill={peakColor(p.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-600 text-sm">Noch nicht genug Daten</div>
          )}
          <div className="flex items-center gap-3 mt-3">
            {[
              { color: "#f97316", label: "Sehr viel" },
              { color: "#fb923c", label: "Mittel" },
              { color: "#fed7aa", label: "Wenig" },
              { color: "#78350f", label: "Ruhig" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                <span className="text-gray-500 text-xs">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heutiger Stunden-Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Heute nach Stunde</h3>
          {hourlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={hourlySales}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} width={42} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }}
                  formatter={(v: any) => [`${Number(v).toFixed(2)} €`, "Umsatz"]}
                />
                <Area type="monotone" dataKey="amount" name="amount" stroke="#f97316" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center text-gray-600 text-sm">Noch keine Umsätze heute</div>
          )}
        </div>
      </div>

      {/* ── Personal im Dienst ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Jetzt im Dienst ({activeShifts.length})
        </h3>
        {activeShifts.length === 0 ? (
          <p className="text-gray-500 text-sm">Niemand ist gerade eingestempelt</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {activeShifts.map(shift => {
              const started     = shift.actual_start ? new Date(shift.actual_start) : new Date(shift.start_time);
              const hoursWorked = (Date.now() - started.getTime()) / 3600000;
              const earned      = hoursWorked * Number(shift.hourly_wage || 13);
              return (
                <div key={shift.id} className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                      {(shift as any).profiles?.name?.charAt(0) || "?"}
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <p className="text-white text-sm font-medium">{(shift as any).profiles?.name || "Unbekannt"}</p>
                  <p className="text-gray-400 text-xs flex items-center gap-1 mt-1">
                    <Clock size={10} /> {hoursWorked.toFixed(1)}h · {earned.toFixed(2)} €
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Top Gerichte ── */}
      {dishCounts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Bestellte Speisen heute</h3>
          <div className="space-y-2">
            {dishCounts.slice(0, 10).map((d, i) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-5 text-right">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium">{d.name}</span>
                    <span className="text-orange-400 font-bold text-sm">{d.count}x</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-orange-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min((d.count / (dishCounts[0]?.count || 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
