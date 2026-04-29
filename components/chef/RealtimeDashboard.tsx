"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import type { Sale, Shift, DishOrder } from "@/lib/supabase";
import { TrendingUp, Users, Euro, ShoppingBag, Clock, Wifi, Pencil, Check, X } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import toast from "react-hot-toast";

interface HourlySales { hour: string; amount: number; }
interface DishCount { name: string; count: number; category: string; }

function RadialGauge({ value, max, label, unit, color, sublabel }: {
  value: number; max: number; label: string; unit?: string; color: string; sublabel?: string;
}) {
  const pct = Math.min(value / (max || 1), 1);
  const r = 52;
  const cx = 70;
  const cy = 70;
  const totalDeg = 260;
  const startAngle = 220;

  function polar(deg: number, radius: number) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(fromDeg: number, toDeg: number, radius: number) {
    const start = polar(fromDeg, radius);
    const end = polar(toDeg, radius);
    const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    const sweep = toDeg > fromDeg ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} ${sweep} ${end.x} ${end.y}`;
  }

  const bgEndAngle = startAngle + totalDeg;
  const fillEndAngle = startAngle + pct * totalDeg;

  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={130} viewBox="0 0 140 130">
        <path d={arcPath(startAngle, bgEndAngle, r)} fill="none" stroke="#1f2937" strokeWidth={10} strokeLinecap="round" />
        {pct > 0 && (
          <path d={arcPath(startAngle, fillEndAngle, r)} fill="none" stroke={pct >= 1 ? "#22c55e" : color} strokeWidth={10} strokeLinecap="round" />
        )}
        <circle cx={polar(fillEndAngle, r).x} cy={polar(fillEndAngle, r).y} r={5} fill={pct >= 1 ? "#22c55e" : color} />
        <text x={cx} y={cy + 2} textAnchor="middle" fill="white" fontSize={14} fontWeight="bold">
          {value}{unit}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fill="#6b7280" fontSize={9}>
          von {max}{unit}
        </text>
        {sublabel && (
          <text x={cx} y={cy + 28} textAnchor="middle" fill="#f97316" fontSize={8}>
            {sublabel}
          </text>
        )}
      </svg>
      <p className="text-xs text-gray-400 -mt-2">{label}</p>
    </div>
  );
}

export default function RealtimeDashboard() {
  const { restaurant } = useStore();
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [activeShifts, setActiveShifts] = useState<(Shift & { profiles?: { name: string } })[]>([]);
  const [dishCounts, setDishCounts] = useState<DishCount[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([]);

  // Tagesziel — aus localStorage laden
  const [dailyGoal, setDailyGoal] = useState<number>(1000);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  // Personal-Soll — aus localStorage laden
  const [staffGoal, setStaffGoal] = useState<number>(10);
  const [editingStaff, setEditingStaff] = useState(false);
  const [staffInput, setStaffInput] = useState("");

  useEffect(() => {
    const savedGoal = localStorage.getItem("dailyGoal");
    if (savedGoal) setDailyGoal(Number(savedGoal));
    const savedStaff = localStorage.getItem("staffGoal");
    if (savedStaff) setStaffGoal(Number(savedStaff));
  }, []);

  function saveGoal() {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      setDailyGoal(val);
      localStorage.setItem("dailyGoal", String(val));
      toast.success(`Tagesziel auf ${val.toFixed(0)} € gesetzt`);
    }
    setEditingGoal(false);
  }

  function saveStaffGoal() {
    const val = parseInt(staffInput);
    if (!isNaN(val) && val > 0) {
      setStaffGoal(val);
      localStorage.setItem("staffGoal", String(val));
      toast.success(`Personal-Soll auf ${val} gesetzt`);
    }
    setEditingStaff(false);
  }

  const today = new Date().toISOString().slice(0, 10);

  const loadData = useCallback(async () => {
    if (!restaurant) return;

    const [salesRes, shiftsRes, dishRes] = await Promise.all([
      supabase.from("sales").select("*").eq("restaurant_id", restaurant.id).gte("recorded_at", today + "T00:00:00").order("recorded_at", { ascending: true }),
      supabase.from("shifts").select("*, profiles(name)").eq("restaurant_id", restaurant.id).eq("is_clocked_in", true),
      supabase.from("dish_orders").select("*, menu_items(name, category)").eq("restaurant_id", restaurant.id).gte("ordered_at", today + "T00:00:00"),
    ]);

    if (salesRes.data) {
      setTodaySales(salesRes.data);
      const byHour: Record<string, number> = {};
      salesRes.data.forEach(s => {
        const h = new Date(s.recorded_at).getHours();
        const label = `${h}:00`;
        byHour[label] = (byHour[label] || 0) + Number(s.amount);
      });
      setHourlySales(Object.entries(byHour).map(([hour, amount]) => ({ hour, amount })));
    }
    if (shiftsRes.data) setActiveShifts(shiftsRes.data as any);
    if (dishRes.data) {
      const counts: Record<string, DishCount> = {};
      dishRes.data.forEach((d: any) => {
        const name = d.menu_items?.name || "Unbekannt";
        const cat = d.menu_items?.category || "";
        if (!counts[name]) counts[name] = { name, count: 0, category: cat };
        counts[name].count += d.quantity;
      });
      setDishCounts(Object.values(counts).sort((a, b) => b.count - a.count));
    }
  }, [restaurant, today]);

  useEffect(() => {
    loadData();
    if (!restaurant) return;

    const channel = supabase.channel(`restaurant-${restaurant.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales", filter: `restaurant_id=eq.${restaurant.id}` }, () => { loadData(); toast.success("Neuer Umsatz eingetragen!"); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dish_orders", filter: `restaurant_id=eq.${restaurant.id}` }, () => loadData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant, loadData]);

  const totalToday = todaySales.reduce((s, r) => s + Number(r.amount), 0);
  const avgBon = todaySales.length > 0 ? totalToday / todaySales.length : 0;
  const goalPct = Math.round(Math.min((totalToday / dailyGoal) * 100, 100));
  const remaining = Math.max(dailyGoal - totalToday, 0);

  const PIE_COLORS = ["#f97316", "#3b82f6", "#8b5cf6"];
  const payBreakdown = ["cash", "card", "online"].map(m => ({
    name: m === "cash" ? "Bar" : m === "card" ? "Karte" : "Online",
    value: todaySales.filter(s => s.payment_method === m).reduce((sum, s) => sum + Number(s.amount), 0),
  })).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Live</span>
          <Wifi size={12} className="text-green-400" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Umsatz Heute", value: `${totalToday.toFixed(2)} €`, icon: Euro, color: "bg-orange-500", trend: "+12%" },
          { label: "Transaktionen", value: todaySales.length.toString(), icon: ShoppingBag, color: "bg-blue-500", trend: null },
          { label: "Fehlend zum Ziel", value: remaining > 0 ? `${remaining.toFixed(0)} €` : "Erreicht!", icon: TrendingUp, color: remaining > 0 ? "bg-purple-500" : "bg-green-500", trend: null },
          { label: "Aktive MA", value: activeShifts.length.toString(), icon: Users, color: "bg-green-500", trend: null },
        ].map((k) => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`${k.color} p-2.5 rounded-xl`}><k.icon size={18} className="text-white" /></div>
              {k.trend && <span className="text-green-400 text-xs font-medium bg-green-500/10 px-2 py-1 rounded-full">{k.trend}</span>}
            </div>
            <p className="text-gray-400 text-sm">{k.label}</p>
            <p className="text-2xl font-bold text-white mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hourly chart */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4">Umsatz nach Stunde</h3>
          {hourlySales.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={hourlySales}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="hour" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} tickFormatter={v => `${v}€`} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: "12px" }} formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
                <Area type="monotone" dataKey="amount" name="Umsatz" stroke="#f97316" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Noch keine Umsätze heute</div>
          )}
        </div>

        {/* Gauge Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="font-semibold text-white">Messwerte</h3>

          {/* Gauges */}
          <div className="flex justify-around">
            {/* Tagesziel Gauge */}
            <div className="flex flex-col items-center gap-1">
              <RadialGauge
                value={goalPct}
                max={100}
                label="Tagesziel"
                unit="%"
                color="#f97316"
                sublabel={goalPct >= 100 ? "Erreicht!" : undefined}
              />
              {editingGoal ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false); }}
                    placeholder={String(dailyGoal)}
                    className="w-20 bg-gray-800 border border-orange-500 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
                  />
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

            {/* Personal Gauge */}
            <div className="flex flex-col items-center gap-1">
              <RadialGauge
                value={activeShifts.length}
                max={staffGoal}
                label="Personal"
                unit=""
                color="#3b82f6"
              />
              {editingStaff ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    type="number"
                    value={staffInput}
                    onChange={e => setStaffInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveStaffGoal(); if (e.key === "Escape") setEditingStaff(false); }}
                    placeholder={String(staffGoal)}
                    className="w-16 bg-gray-800 border border-blue-500 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none"
                  />
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
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
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

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Tagesziel</span>
              <span>{totalToday.toFixed(0)} / {dailyGoal.toFixed(0)} €</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${goalPct}%`, background: goalPct >= 100 ? "#22c55e" : "#f97316" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Active Employees */}
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
              const started = shift.actual_start ? new Date(shift.actual_start) : new Date(shift.start_time);
              const hoursWorked = (Date.now() - started.getTime()) / 3600000;
              const earned = hoursWorked * Number(shift.hourly_wage || 13);
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
                    <Clock size={10} /> {hoursWorked.toFixed(1)}h · {earned.toFixed(2)}€
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min((d.count / (dishCounts[0]?.count || 1)) * 100, 100)}%` }} />
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
