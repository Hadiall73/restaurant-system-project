"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { Calendar, Sparkles, Clock, Euro, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export default function ScheduleManager() {
  const { restaurant } = useStore();
  const [weekStart, setWeekStart] = useState(getMonday());
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<"plan" | "availability">("plan");

  const weekStr = weekStart.toISOString().slice(0, 10);

  useEffect(() => {
    if (!restaurant) return;
    loadWeekData();
  }, [restaurant, weekStr]);

  async function loadWeekData() {
    if (!restaurant) return;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [avRes, shiftRes, membersRes] = await Promise.all([
      supabase.from("availability").select("*, profiles(name)").eq("restaurant_id", restaurant.id).eq("week_start", weekStr),
      supabase.from("shifts").select("*, profiles(name)").eq("restaurant_id", restaurant.id).gte("start_time", weekStr).lte("start_time", weekEnd.toISOString().slice(0, 10) + "T23:59:59"),
      supabase.from("restaurant_members").select("*, profiles(name, id)").eq("restaurant_id", restaurant.id).eq("is_active", true),
    ]);
    if (avRes.data) setAvailabilities(avRes.data);
    if (shiftRes.data) setShifts(shiftRes.data);
    if (membersRes.data) setMembers(membersRes.data);
  }

  async function generateSchedule() {
    if (!restaurant) return;
    if (availabilities.length === 0) { toast.error("Keine Verfügbarkeiten für diese Woche!"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurant.id, week_start: weekStr }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Fehler"); return; }
      toast.success(`${data.shifts_created} Schichten erstellt! KI: ${data.plan.reasoning}`);
      loadWeekData();
    } catch { toast.error("Verbindungsfehler"); }
    finally { setGenerating(false); }
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }

  // Build schedule grid
  const scheduleGrid: Record<string, Record<string, any[]>> = {};
  members.forEach(m => { scheduleGrid[m.user_id] = {}; DAY_KEYS.forEach(d => scheduleGrid[m.user_id][d] = []); });
  shifts.forEach(shift => {
    if (!scheduleGrid[shift.user_id]) return;
    const day = new Date(shift.start_time).getDay();
    const dayKey = DAY_KEYS[day === 0 ? 6 : day - 1];
    scheduleGrid[shift.user_id][dayKey]?.push(shift);
  });

  // Wage summary per employee
  const wageSummary = members.map(m => {
    const empShifts = shifts.filter(s => s.user_id === m.user_id);
    const hours = empShifts.reduce((sum, s) => {
      const h = (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000;
      return sum + h;
    }, 0);
    const wage = hours * Number(m.hourly_wage || 13);
    return { ...m, hours, wage };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Dienstplan</h2>
          <p className="text-gray-400 text-sm mt-1">KI-gestützte Planung basierend auf Verfügbarkeiten</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors"><ChevronLeft size={18} className="text-white" /></button>
          <span className="text-white text-sm font-medium px-3">KW {weekStr}</span>
          <button onClick={nextWeek} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors"><ChevronRight size={18} className="text-white" /></button>
          <button onClick={generateSchedule} disabled={generating}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
            <Sparkles size={16} />
            {generating ? "KI plant..." : "KI Dienstplan"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["plan", "Dienstplan"], ["availability", "Verfügbarkeiten"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === key ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {label} {key === "availability" ? `(${availabilities.length})` : `(${shifts.length})`}
          </button>
        ))}
      </div>

      {view === "plan" && (
        <>
          {/* Schedule Grid */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-36">Mitarbeiter</th>
                    {DAYS.map((d, i) => (
                      <th key={d} className={`px-2 py-3 text-center text-gray-400 font-medium text-xs ${i >= 4 ? "text-orange-400" : ""}`}>{d.slice(0, 2)}</th>
                    ))}
                    <th className="px-3 py-3 text-center text-gray-400 font-medium text-xs">Std / Lohn</th>
                  </tr>
                </thead>
                <tbody>
                  {wageSummary.map(m => (
                    <tr key={m.user_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                            {m.profiles?.name?.charAt(0)}
                          </div>
                          <span className="text-white text-xs font-medium">{m.profiles?.name}</span>
                        </div>
                      </td>
                      {DAY_KEYS.map(dayKey => {
                        const dayShifts = scheduleGrid[m.user_id]?.[dayKey] || [];
                        const av = availabilities.find(a => a.user_id === m.user_id);
                        const canWork = av?.[dayKey];
                        return (
                          <td key={dayKey} className="px-2 py-3 text-center">
                            {dayShifts.length > 0 ? (
                              dayShifts.map((s: any) => (
                                <span key={s.id} className="block bg-orange-500/20 text-orange-300 px-1.5 py-1 rounded-lg text-xs font-medium">
                                  {new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–{new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              ))
                            ) : canWork ? (
                              <span className="text-green-700 text-xs">✓</span>
                            ) : (
                              <span className="text-gray-700 text-xs">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center">
                        <p className="text-white text-xs font-medium">{m.hours.toFixed(1)}h</p>
                        <p className="text-green-400 text-xs">{m.wage.toFixed(0)}€</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wage summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Geplante Stunden", value: `${wageSummary.reduce((s, m) => s + m.hours, 0).toFixed(0)}h`, icon: Clock, color: "text-blue-400" },
              { label: "Personalkosten", value: `${wageSummary.reduce((s, m) => s + m.wage, 0).toFixed(2)} €`, icon: Euro, color: "text-orange-400" },
              { label: "Mitarbeiter aktiv", value: members.length.toString(), icon: Calendar, color: "text-green-400" },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4">
                <k.icon size={24} className={k.color} />
                <div>
                  <p className="text-gray-400 text-xs">{k.label}</p>
                  <p className="text-white font-bold text-xl">{k.value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {view === "availability" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {availabilities.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>Keine Verfügbarkeiten für diese Woche eingereicht</p>
              <p className="text-sm mt-1">Mitarbeiter können in ihrer App Verfügbarkeiten einreichen</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Mitarbeiter</th>
                    {DAYS.map(d => <th key={d} className="px-2 py-3 text-center text-gray-400 font-medium text-xs">{d.slice(0, 2)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {availabilities.map(av => (
                    <tr key={av.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                            {av.profiles?.name?.charAt(0)}
                          </div>
                          <span className="text-white text-sm font-medium">{av.profiles?.name}</span>
                        </div>
                      </td>
                      {DAY_KEYS.map(dayKey => (
                        <td key={dayKey} className="px-2 py-3 text-center">
                          {av[dayKey] ? (
                            <span title={av[`${dayKey}_note`] || ""} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">✓</span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-700 text-xs">✗</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
