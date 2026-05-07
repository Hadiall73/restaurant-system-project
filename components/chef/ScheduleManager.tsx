"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { Calendar, Zap, Clock, Euro, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X, Check, BarChart2 } from "lucide-react";
import toast from "react-hot-toast";

const DAYS    = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS   = ["Vormittag", "Mittag", "Abend"];
const SLOT_COLORS: Record<string, string> = {
  Vormittag: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Mittag:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Abend:     "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

function getMonday(d = new Date()) {
  const copy = new Date(d);
  const day  = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy;
}

function dayOffset(weekStart: Date, dayIndex: number) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

/** Wahrscheinlichkeit → Farbe */
function probColor(p: number): string {
  if (p >= 1)   return "text-green-400 bg-green-500/10 border-green-500/30";
  if (p >= 0.6) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

function probLabel(p: number): string {
  if (p >= 1)   return "Voll";
  if (p >= 0.6) return `${Math.round(p * 100)}%`;
  return `${Math.round(p * 100)}%`;
}

type Shift = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  profiles?: { name: string };
};

type DaySummary = { totalAvailable: number; totalAssigned: number; coverageProb: number };
type SlotStat   = { available: number; assigned: number; needed: number; probability: number };

type EditState = { shift: Shift; start: string; end: string } | null;
type AddState  = { user_id: string; date: string } | null;

export default function ScheduleManager() {
  const { restaurant } = useStore();
  const [weekStart, setWeekStart]       = useState(getMonday());
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [shifts, setShifts]             = useState<Shift[]>([]);
  const [members, setMembers]           = useState<any[]>([]);
  const [generating, setGenerating]     = useState(false);
  const [view, setView]                 = useState<"plan" | "availability" | "stats">("plan");
  const [mode, setMode]                 = useState<"auto" | "manual">("auto");

  // Wahrscheinlichkeits-Ergebnisse vom letzten Generate
  const [daySummary, setDaySummary]     = useState<Record<string, DaySummary> | null>(null);
  const [slotStats, setSlotStats]       = useState<Record<string, Record<string, SlotStat>> | null>(null);

  const [editState, setEditState]       = useState<EditState>(null);
  const [savingEdit, setSavingEdit]     = useState(false);
  const [addState, setAddState]         = useState<AddState>(null);
  const [newStart, setNewStart]         = useState("08:00");
  const [newEnd, setNewEnd]             = useState("16:00");
  const [savingAdd, setSavingAdd]       = useState(false);

  const weekStr = weekStart.toISOString().slice(0, 10);

  useEffect(() => {
    if (!restaurant) return;
    loadWeekData();

    const channel = supabase
      .channel(`schedule-chef-${restaurant.id}-${weekStr}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "shifts",
        filter: `restaurant_id=eq.${restaurant.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setShifts(prev => {
            if (prev.find(s => s.id === (payload.new as Shift).id)) return prev;
            return [...prev, payload.new as Shift];
          });
        } else if (payload.eventType === "UPDATE") {
          setShifts(prev => prev.map(s => s.id === (payload.new as Shift).id ? { ...s, ...payload.new } : s));
        } else if (payload.eventType === "DELETE") {
          setShifts(prev => prev.filter(s => s.id !== (payload.old as Shift).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurant, weekStr]);

  async function loadWeekData() {
    if (!restaurant) return;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const [avRes, shiftRes, membersRes] = await Promise.all([
      supabase.from("availability").select("*, profiles(name)").eq("restaurant_id", restaurant.id).eq("week_start", weekStr),
      supabase.from("shifts").select("*, profiles(name)").eq("restaurant_id", restaurant.id)
        .gte("start_time", weekStr)
        .lte("start_time", weekEnd.toISOString().slice(0, 10) + "T23:59:59"),
      supabase.from("restaurant_members").select("*, profiles(name, id)").eq("restaurant_id", restaurant.id).eq("is_active", true),
    ]);

    if (avRes.data)     setAvailabilities(avRes.data);
    if (shiftRes.data)  setShifts(shiftRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    setDaySummary(null);
    setSlotStats(null);
  }

  async function generateSchedule() {
    if (!restaurant) return;
    if (availabilities.length === 0) { toast.error("Keine Verfügbarkeiten für diese Woche!"); return; }
    setGenerating(true);
    try {
      const res  = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurant.id, week_start: weekStr }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Fehler"); return; }

      setDaySummary(data.daySummary || null);
      setSlotStats(data.stats || null);
      toast.success(`${data.shifts_created} Schichten automatisch erstellt!`);
      loadWeekData();

      // Automatisch zu Stats-Ansicht wechseln
      setView("stats");
    } catch {
      toast.error("Verbindungsfehler");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteShift(shiftId: string) {
    const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
    if (error) { toast.error("Fehler beim Löschen"); return; }
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    toast.success("Schicht gelöscht");
  }

  async function saveEdit() {
    if (!editState) return;
    setSavingEdit(true);
    const date     = editState.shift.start_time.slice(0, 10);
    const startISO = `${date}T${editState.start}:00`;
    const endISO   = `${date}T${editState.end}:00`;

    if (editState.start >= editState.end) {
      toast.error("Endzeit muss nach Startzeit liegen");
      setSavingEdit(false); return;
    }
    const { error } = await supabase.from("shifts").update({ start_time: startISO, end_time: endISO }).eq("id", editState.shift.id);
    if (error) { toast.error("Fehler beim Speichern"); setSavingEdit(false); return; }
    setShifts(prev => prev.map(s => s.id === editState.shift.id ? { ...s, start_time: startISO, end_time: endISO } : s));
    toast.success("Schicht aktualisiert");
    setEditState(null);
    setSavingEdit(false);
  }

  async function saveAdd() {
    if (!addState || !restaurant) return;
    if (newStart >= newEnd) { toast.error("Endzeit muss nach Startzeit liegen"); return; }
    setSavingAdd(true);

    const startISO = `${addState.date}T${newStart}:00`;
    const endISO   = `${addState.date}T${newEnd}:00`;
    const member   = members.find(m => m.user_id === addState.user_id);

    const { data, error } = await supabase.from("shifts").insert({
      restaurant_id: restaurant.id,
      user_id:       addState.user_id,
      start_time:    startISO,
      end_time:      endISO,
      hourly_wage:   member?.hourly_wage || 13,
    }).select("*, profiles(name)").single();

    if (error) { toast.error("Fehler beim Hinzufügen"); setSavingAdd(false); return; }
    setShifts(prev => [...prev, data]);
    toast.success("Schicht hinzugefügt");
    setAddState(null);
    setSavingAdd(false);
  }

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(getMonday(d)); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(getMonday(d)); }

  // Grid aufbauen
  const scheduleGrid: Record<string, Record<string, Shift[]>> = {};
  members.forEach(m => { scheduleGrid[m.user_id] = {}; DAY_KEYS.forEach(d => scheduleGrid[m.user_id][d] = []); });
  shifts.forEach(shift => {
    if (!scheduleGrid[shift.user_id]) return;
    const day    = new Date(shift.start_time).getDay();
    const dayKey = DAY_KEYS[day === 0 ? 6 : day - 1];
    scheduleGrid[shift.user_id][dayKey]?.push(shift);
  });

  const wageSummary = members.map(m => {
    const empShifts = shifts.filter(s => s.user_id === m.user_id);
    const hours = empShifts.reduce((sum, s) => {
      if (!s.end_time) return sum;
      return sum + (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000;
    }, 0);
    return { ...m, hours, wage: hours * Number(m.hourly_wage || 13) };
  });

  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  // Gesamt-Abdeckungs-Wahrscheinlichkeit dieser Woche
  const weekCoverageProb = daySummary
    ? Object.values(daySummary).reduce((s, d) => s + d.coverageProb, 0) / 7
    : null;

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Dienstplan</h2>
          <p className="text-gray-400 text-sm mt-1">
            KW {weekStr}
            {weekCoverageProb !== null && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs border font-medium ${probColor(weekCoverageProb)}`}>
                Ø Abdeckung {Math.round(weekCoverageProb * 100)}%
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors">
            <ChevronLeft size={18} className="text-white" />
          </button>
          <button onClick={nextWeek} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl transition-colors">
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Modus-Umschalter ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-xl bg-gray-800 p-1">
          <button onClick={() => setMode("auto")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "auto" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
            <Zap size={15} /> Auto-Plan
          </button>
          <button onClick={() => setMode("manual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === "manual" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
            <Pencil size={15} /> Manuell
          </button>
        </div>

        {mode === "auto" && (
          <button onClick={generateSchedule} disabled={generating}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors">
            <Zap size={15} />
            {generating ? "Berechne..." : "Jetzt generieren"}
          </button>
        )}

        {mode === "auto" && availabilities.length > 0 && shifts.length === 0 && (
          <p className="text-gray-400 text-xs">
            {availabilities.length} Verfügbarkeiten eingegangen → Klick auf „Jetzt generieren"
          </p>
        )}
        {mode === "manual" && (
          <p className="text-gray-400 text-sm">Klicke auf <strong className="text-white">+</strong> zum Hinzufügen, auf den Stift zum Bearbeiten</p>
        )}
      </div>

      {/* Auto-Plan Erklärungsbox */}
      {mode === "auto" && shifts.length === 0 && availabilities.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <p className="text-white text-sm font-semibold flex items-center gap-2">
            <BarChart2 size={16} className="text-orange-400" />
            Wie der Auto-Plan funktioniert
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {[
              { step: "1", title: "Verfügbarkeit", desc: "Mitarbeiter-Slots (Vormittag/Mittag/Abend) werden eingelesen" },
              { step: "2", title: "Wahrscheinlichkeit", desc: "Pro Slot wird berechnet wie gut die Besetzung ist (z.B. 85%)" },
              { step: "3", title: "Faire Verteilung", desc: "Wer weniger Stunden hat bekommt Vorrang — automatisch ausgeglichen" },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold shrink-0">{item.step}</div>
                <div>
                  <p className="text-white text-xs font-medium">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab-Leiste ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {([
          ["plan",         `Dienstplan (${shifts.length})`],
          ["availability", `Verfügbarkeiten (${availabilities.length})`],
          ["stats",        "Wahrscheinlichkeiten"],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === key ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Plan-Grid ───────────────────────────────────────────────────────── */}
      {view === "plan" && (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium w-36">Mitarbeiter</th>
                    {DAYS.map((d, i) => {
                      const dk = DAY_KEYS[i];
                      const prob = daySummary?.[dk]?.coverageProb;
                      return (
                        <th key={d} className={`px-2 py-3 text-center font-medium text-xs ${i >= 4 ? "text-orange-400" : "text-gray-400"}`}>
                          <div>{d.slice(0, 2)}</div>
                          <div className="text-gray-600 font-normal">{dayOffset(weekStart, i).slice(5)}</div>
                          {prob !== undefined && (
                            <div className={`mt-1 px-1.5 py-0.5 rounded-full text-xs border font-bold ${probColor(prob)}`}>
                              {probLabel(prob)}
                            </div>
                          )}
                        </th>
                      );
                    })}
                    <th className="px-3 py-3 text-center text-gray-400 font-medium text-xs">Std / Lohn</th>
                  </tr>
                </thead>
                <tbody>
                  {wageSummary.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500 text-sm">Noch keine Mitarbeiter</td></tr>
                  )}
                  {wageSummary.map(m => (
                    <tr key={m.user_id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold shrink-0">
                            {m.profiles?.name?.charAt(0)}
                          </div>
                          <span className="text-white text-xs font-medium truncate max-w-24">{m.profiles?.name}</span>
                        </div>
                      </td>
                      {DAY_KEYS.map((dayKey, dayIdx) => {
                        const dayShifts = scheduleGrid[m.user_id]?.[dayKey] || [];
                        const av        = availabilities.find(a => a.user_id === m.user_id);
                        const canWork   = av?.[dayKey];
                        const slots     = av ? (av[`${dayKey}_note`] || "").split(",").filter(Boolean) : [];
                        const date      = dayOffset(weekStart, dayIdx);
                        return (
                          <td key={dayKey} className="px-1 py-2 text-center align-top">
                            <div className="space-y-1 min-h-[28px]">
                              {dayShifts.map(s => (
                                <div key={s.id} className="relative group bg-orange-500/15 border border-orange-500/30 text-orange-300 px-1.5 py-1 rounded-lg text-xs font-medium">
                                  <div>{fmt(s.start_time)}–{fmt(s.end_time)}</div>
                                  <div className={`flex justify-center gap-1 mt-0.5 ${mode === "manual" ? "flex" : "hidden group-hover:flex"}`}>
                                    <button onClick={() => setEditState({ shift: s, start: fmt(s.start_time), end: fmt(s.end_time) })}
                                      className="p-0.5 rounded bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors">
                                      <Pencil size={10} />
                                    </button>
                                    <button onClick={() => deleteShift(s.id)}
                                      className="p-0.5 rounded bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors">
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {/* Verfügbarkeits-Slots anzeigen (wenn keine Schicht) */}
                              {dayShifts.length === 0 && canWork && slots.length > 0 && (
                                <div className="flex flex-col gap-0.5">
                                  {slots.map((slot: string) => (
                                    <span key={slot} className="text-xs px-1 py-0.5 rounded border opacity-50"
                                      style={{ fontSize: "9px" }}>
                                      {slot.slice(0, 4)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => { setAddState({ user_id: m.user_id, date }); setNewStart("08:00"); setNewEnd("16:00"); }}
                                className={`w-full flex items-center justify-center rounded-lg text-xs transition-colors py-0.5
                                  ${mode === "manual"
                                    ? "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-dashed border-gray-700"
                                    : dayShifts.length === 0
                                      ? canWork ? "text-green-700 hover:text-green-400" : "text-gray-700 hover:text-gray-500"
                                      : "hidden"
                                  }`}>
                                {mode === "manual" ? <Plus size={11} /> : canWork ? "✓" : "–"}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <p className="text-white text-xs font-medium">{m.hours.toFixed(1)}h</p>
                        <p className="text-green-400 text-xs">{m.wage.toFixed(0)}€</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Statistiken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Geplante Stunden",       value: `${wageSummary.reduce((s, m) => s + m.hours, 0).toFixed(0)}h`,         icon: Clock,    color: "text-blue-400"   },
              { label: "Personalkosten",          value: `${wageSummary.reduce((s, m) => s + m.wage, 0).toFixed(2)} €`,         icon: Euro,     color: "text-orange-400" },
              { label: "Mitarbeiter eingeplant",  value: `${wageSummary.filter(m => m.hours > 0).length} / ${members.length}`,  icon: Calendar, color: "text-green-400"  },
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Verfügbarkeiten ─────────────────────────────────────────────────── */}
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
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Mitarbeiter</th>
                    {DAYS.map(d => (
                      <th key={d} className="px-2 py-3 text-center text-gray-400 font-medium text-xs">{d.slice(0, 2)}</th>
                    ))}
                    <th className="px-3 py-3 text-center text-gray-400 font-medium text-xs">Tage</th>
                  </tr>
                </thead>
                <tbody>
                  {availabilities.map(av => {
                    const totalDays = DAY_KEYS.filter(d => av[d]).length;
                    return (
                      <tr key={av.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold">
                              {av.profiles?.name?.charAt(0)}
                            </div>
                            <span className="text-white text-sm font-medium">{av.profiles?.name}</span>
                          </div>
                        </td>
                        {DAY_KEYS.map(dayKey => {
                          const available = av[dayKey];
                          const slots = (av[`${dayKey}_note`] || "").split(",").filter(Boolean);
                          return (
                            <td key={dayKey} className="px-2 py-3 text-center">
                              {available ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  {slots.length > 0 ? slots.map((slot: string) => (
                                    <span key={slot} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${
                                      slot === "Vormittag" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" :
                                      slot === "Mittag"    ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                                      "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                    }`} style={{ fontSize: "9px" }}>
                                      {slot.slice(0, 4)}
                                    </span>
                                  )) : (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">✓</span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/10 text-red-700 text-xs">✗</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className="text-white text-sm font-bold">{totalDays}</span>
                          <span className="text-gray-500 text-xs">/7</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Wahrscheinlichkeiten ────────────────────────────────────────────── */}
      {view === "stats" && (
        <div className="space-y-4">
          {!daySummary && !slotStats ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <BarChart2 size={40} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-400">Noch kein Plan generiert</p>
              <p className="text-gray-600 text-sm mt-1">Drücke „Jetzt generieren" um die Wahrscheinlichkeitsanalyse zu sehen</p>
              {availabilities.length > 0 && (
                <button onClick={generateSchedule} disabled={generating}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 mx-auto">
                  <Zap size={15} /> {generating ? "Berechne..." : "Jetzt generieren"}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Tagesübersicht */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart2 size={16} className="text-orange-400" />
                  Besetzungs-Wahrscheinlichkeit pro Tag
                </h3>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, i) => {
                    const dk   = DAY_KEYS[i];
                    const ds   = daySummary?.[dk];
                    const prob = ds?.coverageProb ?? 0;
                    return (
                      <div key={day} className={`rounded-xl p-3 border text-center ${probColor(prob)}`}>
                        <p className="text-xs font-medium">{day.slice(0, 2)}</p>
                        <p className="text-lg font-bold mt-1">{Math.round(prob * 100)}%</p>
                        <p className="text-xs opacity-70 mt-0.5">{ds?.totalAssigned ?? 0}/{ds?.totalAvailable ?? 0}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-gray-500 text-xs mt-3 text-center">
                  Format: eingeplant / verfügbar · 100% = Mindestbesetzung erfüllt
                </p>
              </div>

              {/* Slot-Details */}
              {slotStats && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-gray-800">
                    <h3 className="text-white font-semibold">Slot-Details (Vormittag / Mittag / Abend)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left px-4 py-2 text-gray-400">Tag</th>
                          {SLOTS.map(slot => (
                            <th key={slot} className="px-3 py-2 text-center text-gray-400" colSpan={2}>{slot}</th>
                          ))}
                        </tr>
                        <tr className="border-b border-gray-800">
                          <th className="px-4 py-1 text-gray-600"></th>
                          {SLOTS.map(slot => (
                            <>
                              <th key={slot + "-avail"} className="px-2 py-1 text-gray-600 text-center">verfügbar</th>
                              <th key={slot + "-prob"}  className="px-2 py-1 text-gray-600 text-center">Deckung</th>
                            </>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((day, i) => {
                          const dk = DAY_KEYS[i];
                          const ds = slotStats[dk] || {};
                          return (
                            <tr key={day} className={`border-b border-gray-800/50 ${i >= 4 ? "bg-orange-500/5" : ""}`}>
                              <td className="px-4 py-2 text-white font-medium">{day.slice(0, 2)}</td>
                              {SLOTS.map(slot => {
                                const ss   = ds[slot];
                                const prob = ss?.probability ?? 0;
                                return (
                                  <>
                                    <td key={slot + "-a"} className="px-2 py-2 text-center text-gray-400">{ss?.available ?? 0}</td>
                                    <td key={slot + "-p"} className="px-2 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${probColor(prob)}`}>
                                        {ss ? `${Math.round(prob * 100)}%` : "–"}
                                      </span>
                                    </td>
                                  </>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Legende */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Vollständig besetzt", color: "text-green-400 border-green-500/30 bg-green-500/10", desc: "100% – Mindestbesetzung erfüllt" },
                  { label: "Knapp besetzt",        color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", desc: "60–99% – Ausreichend, aber eng" },
                  { label: "Unterbesetzt",          color: "text-red-400 border-red-500/30 bg-red-500/10", desc: "< 60% – Zu wenig Personal" },
                ].map(l => (
                  <div key={l.label} className={`rounded-xl p-3 border ${l.color}`}>
                    <p className="text-xs font-semibold">{l.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{l.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal: Schicht bearbeiten ─────────────────────────────────────────── */}
      {editState && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditState(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Schicht bearbeiten</h3>
              <button onClick={() => setEditState(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {editState.shift.profiles?.name} · {new Date(editState.shift.start_time).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Von</label>
                <input type="time" value={editState.start}
                  onChange={e => setEditState(prev => prev ? { ...prev, start: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                <input type="time" value={editState.end}
                  onChange={e => setEditState(prev => prev ? { ...prev, end: e.target.value } : null)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditState(null)} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Abbrechen</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Check size={15} /> {savingEdit ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Schicht hinzufügen ─────────────────────────────────────────── */}
      {addState && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setAddState(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold text-lg">Schicht hinzufügen</h3>
              <button onClick={() => setAddState(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {members.find(m => m.user_id === addState.user_id)?.profiles?.name} · {new Date(addState.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Von</label>
                <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAddState(null)} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">Abbrechen</button>
              <button onClick={saveAdd} disabled={savingAdd}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <Plus size={15} /> {savingAdd ? "Hinzufügen..." : "Hinzufügen"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
