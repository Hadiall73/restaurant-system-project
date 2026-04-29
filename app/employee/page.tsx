"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Clock, Euro, Calendar, CheckCircle, LogOut, ChefHat } from "lucide-react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff + 7); // next week
  return d;
}

export default function EmployeePage() {
  const { profile, restaurant, setProfile, setRestaurant, clear } = useStore();
  const router = useRouter();
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [totalHours, setTotalHours] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"dashboard" | "availability" | "schedule">("dashboard");
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.push("/auth"); return; }
      if (!profile) {
        supabase.from("profiles").select("*").eq("id", data.session.user.id).single()
          .then(({ data: p }) => p && setProfile(p));
      }
    });
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadEmployeeData();
  }, [profile, restaurant]);

  useEffect(() => {
    if (!currentShift?.actual_start) return;
    const interval = setInterval(() => {
      const h = (Date.now() - new Date(currentShift.actual_start).getTime()) / 3600000;
      setHoursWorked(h);
    }, 60000);
    setHoursWorked((Date.now() - new Date(currentShift.actual_start).getTime()) / 3600000);
    return () => clearInterval(interval);
  }, [currentShift]);

  async function loadEmployeeData() {
    if (!profile) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Find restaurant if not set
    if (!restaurant) {
      const { data: member } = await supabase.from("restaurant_members").select("restaurant_id, restaurants(*)").eq("user_id", profile.id).eq("is_active", true).single();
      if (member) setRestaurant((member as any).restaurants);
      else return;
    }

    const restaurantId = restaurant?.id;
    if (!restaurantId) return;

    const [shiftsRes, activeShiftRes] = await Promise.all([
      supabase.from("shifts").select("*").eq("restaurant_id", restaurantId).eq("user_id", profile.id).gte("start_time", monthStart).order("start_time", { ascending: false }),
      supabase.from("shifts").select("*").eq("restaurant_id", restaurantId).eq("user_id", profile.id).eq("is_clocked_in", true).single(),
    ]);

    if (shiftsRes.data) {
      setMyShifts(shiftsRes.data);
      const totalH = shiftsRes.data.filter(s => s.actual_end).reduce((sum, s) => sum + (new Date(s.actual_end).getTime() - new Date(s.actual_start || s.start_time).getTime()) / 3600000, 0);
      const totalE = shiftsRes.data.filter(s => s.actual_end).reduce((sum, s) => {
        const h = (new Date(s.actual_end).getTime() - new Date(s.actual_start || s.start_time).getTime()) / 3600000;
        return sum + h * Number(s.hourly_wage || 13);
      }, 0);
      setTotalHours(totalH);
      setTotalEarned(totalE);
    }
    if (activeShiftRes.data) setCurrentShift(activeShiftRes.data);
  }

  async function clockIn() {
    if (!profile || !restaurant) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data: shift } = await supabase.from("shifts").select("*").eq("restaurant_id", restaurant.id).eq("user_id", profile.id).gte("start_time", today).lte("start_time", today + "T23:59:59").single();
    if (!shift) { toast.error("Keine Schicht für heute geplant"); return; }
    const { error } = await supabase.from("shifts").update({ is_clocked_in: true, actual_start: new Date().toISOString() }).eq("id", shift.id);
    if (!error) { toast.success("Eingestempelt!"); setCurrentShift({ ...shift, is_clocked_in: true, actual_start: new Date().toISOString() }); }
  }

  async function clockOut() {
    if (!currentShift) return;
    const { error } = await supabase.from("shifts").update({ is_clocked_in: false, actual_end: new Date().toISOString() }).eq("id", currentShift.id);
    if (!error) { toast.success("Ausgestempelt!"); setCurrentShift(null); loadEmployeeData(); }
  }

  async function joinRestaurant() {
    if (!inviteCode.trim() || !profile) return;
    setJoining(true);
    const { data: rest } = await supabase.from("restaurants").select("*").eq("invite_code", inviteCode.trim().toLowerCase()).single();
    if (!rest) { toast.error("Ungültiger Code"); setJoining(false); return; }
    const { error } = await supabase.from("restaurant_members").upsert({ restaurant_id: rest.id, user_id: profile.id, role: "employee" });
    if (!error) { setRestaurant(rest); toast.success(`Willkommen bei ${rest.name}!`); loadEmployeeData(); }
    setJoining(false);
  }

  async function submitAvailability() {
    if (!profile || !restaurant) return;
    const weekStart = getMonday().toISOString().slice(0, 10);
    const payload: Record<string, any> = { restaurant_id: restaurant.id, user_id: profile.id, week_start: weekStart };
    DAY_KEYS.forEach(d => { payload[d] = !!availability[d]; payload[`${d}_note`] = notes[d] || null; });
    const { error } = await supabase.from("availability").upsert(payload, { onConflict: "restaurant_id,user_id,week_start" });
    if (!error) toast.success("Verfügbarkeit eingereicht!"); else toast.error("Fehler");
  }

  async function logout() {
    await supabase.auth.signOut();
    clear();
    router.push("/auth");
  }

  if (!restaurant) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-6">
          <ChefHat size={40} className="text-orange-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">Restaurant beitreten</h2>
          <p className="text-gray-400 text-sm mt-1">Gib den Einladungscode deines Chefs ein</p>
        </div>
        <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Einladungscode (z.B. a1b2c3d4)"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:border-orange-500 mb-4" />
        <button onClick={joinRestaurant} disabled={joining} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium transition-colors">
          {joining ? "Verbinde..." : "Beitreten"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center"><ChefHat size={18} className="text-white" /></div>
          <div><p className="text-white font-semibold text-sm">{restaurant.name}</p><p className="text-gray-400 text-xs">Hallo, {profile?.name}!</p></div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition-colors"><LogOut size={18} /></button>
      </div>

      {/* Clock in/out banner */}
      <div className={`mx-4 mt-4 rounded-2xl p-4 flex items-center justify-between ${currentShift ? "bg-green-500/10 border border-green-500/20" : "bg-gray-900 border border-gray-800"}`}>
        <div>
          {currentShift ? (
            <>
              <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-green-400 text-sm font-medium">Im Dienst</span></div>
              <p className="text-white text-lg font-bold">{hoursWorked.toFixed(1)}h · {(hoursWorked * Number(currentShift.hourly_wage || 13)).toFixed(2)} €</p>
            </>
          ) : (
            <>
              <p className="text-gray-400 text-sm">Heute keine aktive Schicht</p>
              <p className="text-white text-sm font-medium">Monat: {totalHours.toFixed(1)}h · {totalEarned.toFixed(2)} €</p>
            </>
          )}
        </div>
        <button onClick={currentShift ? clockOut : clockIn}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentShift ? "bg-red-500 hover:bg-red-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"}`}>
          {currentShift ? "Ausstempeln" : "Einstempeln"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 mt-4">
        {([["dashboard", "Übersicht"], ["schedule", "Dienstplan"], ["availability", "Verfügbarkeit"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === k ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400"}`}>{l}</button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {tab === "dashboard" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "Stunden (Monat)", value: `${totalHours.toFixed(1)}h`, icon: Clock, color: "text-blue-400" },
                { label: "Verdient (Monat)", value: `${totalEarned.toFixed(2)} €`, icon: Euro, color: "text-green-400" }].map(k => (
                <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <k.icon size={20} className={`${k.color} mb-2`} />
                  <p className="text-gray-400 text-xs">{k.label}</p>
                  <p className="text-white font-bold text-xl mt-1">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="font-semibold text-white mb-3">Letzte Schichten</h3>
              <div className="space-y-2">
                {myShifts.slice(0, 5).map(s => {
                  const h = s.actual_end ? (new Date(s.actual_end).getTime() - new Date(s.actual_start || s.start_time).getTime()) / 3600000 : null;
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
                      <div>
                        <p className="text-white text-sm">{new Date(s.start_time).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}</p>
                        <p className="text-gray-400 text-xs">{new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="text-right">
                        {h ? <><p className="text-white text-sm font-medium">{h.toFixed(1)}h</p><p className="text-green-400 text-xs">{(h * Number(s.hourly_wage || 13)).toFixed(2)} €</p></> : <span className="text-orange-400 text-xs">Geplant</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {tab === "schedule" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="font-semibold text-white mb-3">Mein Dienstplan (nächste 14 Tage)</h3>
            <div className="space-y-2">
              {myShifts.filter(s => new Date(s.start_time) >= new Date()).slice(0, 14).map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <Calendar size={16} className="text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{new Date(s.start_time).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
                    <p className="text-gray-400 text-xs">{new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className="text-orange-400 text-xs font-medium">{((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000).toFixed(1)}h</span>
                </div>
              ))}
              {myShifts.filter(s => new Date(s.start_time) >= new Date()).length === 0 && <p className="text-gray-500 text-sm text-center py-4">Keine geplanten Schichten</p>}
            </div>
          </div>
        )}

        {tab === "availability" && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="font-semibold text-white mb-1">Verfügbarkeit – nächste Woche</h3>
            <p className="text-gray-400 text-xs mb-4">{getMonday().toLocaleDateString("de-DE", { day: "numeric", month: "long" })} – reiche bis Donnerstag ein</p>
            <div className="space-y-3">
              {DAYS.map((day, i) => (
                <div key={day}>
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{day}</span>
                    <button onClick={() => setAvailability(prev => ({ ...prev, [DAY_KEYS[i]]: !prev[DAY_KEYS[i]] }))}
                      className={`w-12 h-6 rounded-full transition-colors relative ${availability[DAY_KEYS[i]] ? "bg-green-500" : "bg-gray-700"}`}>
                      <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${availability[DAY_KEYS[i]] ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                  {availability[DAY_KEYS[i]] && (
                    <input value={notes[DAY_KEYS[i]] || ""} onChange={e => setNotes(prev => ({ ...prev, [DAY_KEYS[i]]: e.target.value }))}
                      placeholder="Anmerkung (optional)"
                      className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500" />
                  )}
                </div>
              ))}
            </div>
            <button onClick={submitAvailability} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium mt-4 transition-colors flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Verfügbarkeit einreichen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
