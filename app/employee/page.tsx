"use client";
import { useEffect, useState } from "react";
import { supabase, RobustSync } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Clock, Euro, Calendar, CheckCircle, LogOut, ChefHat, FileText, Download, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import Chat from "@/components/Chat";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function getMonday(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff + offset * 7);
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
  const [tab, setTab] = useState<"dashboard" | "availability" | "schedule" | "abrechnung" | "chat">("dashboard");
  const [abrMonth, setAbrMonth] = useState(new Date().toISOString().slice(0, 7));
  const [abrShifts, setAbrShifts] = useState<any[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [hoursWorked, setHoursWorked] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/auth"); return; }

      const res  = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ user_id: data.session.user.id, email: data.session.user.email }),
      });
      const json = await res.json();
      const p    = json.profile;

      if (!p) { router.replace("/auth"); return; }
      if (p.role === "chef")      { router.replace("/chef");      return; }
      if (p.role === "developer") { router.replace("/developer"); return; }
      setProfile(p);
    });
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadEmployeeData();
  }, [profile, restaurant]);

  // Echtzeit: Schichtänderungen vom Chef sofort anzeigen
  useEffect(() => {
    if (!profile || !restaurant) return;

    const channel = supabase
      .channel(`schedule-employee-${profile.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "shifts",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newShift = payload.new as any;
          setMyShifts(prev => {
            if (prev.find(s => s.id === newShift.id)) return prev;
            return [newShift, ...prev].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
          });
          toast.success("Neue Schicht wurde eingeplant!");
        } else if (payload.eventType === "UPDATE") {
          const updated = payload.new as any;
          setMyShifts(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
          if (!updated.actual_end && updated.actual_start === null) {
            toast("Schicht wurde aktualisiert", { icon: "📅" });
          }
          if (updated.is_clocked_in === false && updated.actual_end) {
            setCurrentShift(null);
          }
        } else if (payload.eventType === "DELETE") {
          const deleted = payload.old as any;
          setMyShifts(prev => prev.filter(s => s.id !== deleted.id));
          if (currentShift?.id === deleted.id) setCurrentShift(null);
          toast("Eine Schicht wurde entfernt", { icon: "🗑️" });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, restaurant?.id]);

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

    // Find restaurant via API (Service-Role umgeht RLS-Probleme)
    if (!restaurant) {
      const res = await fetch(`/api/auth/get-restaurant?user_id=${profile.id}&role=employee`);
      const json = await res.json();
      if (json.restaurant) setRestaurant(json.restaurant);
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
    
    try {
      const { data: shift } = await supabase.from("shifts").select("*").eq("restaurant_id", restaurant.id).eq("user_id", profile.id).gte("start_time", today).lte("start_time", today + "T23:59:59").single();
      if (!shift) { toast.error("Keine Schicht für heute geplant"); return; }
      
      const { error } = await supabase.from("shifts").update({ is_clocked_in: true, actual_start: new Date().toISOString() }).eq("id", shift.id);
      
      if (!error) { 
        toast.success("Eingestempelt!"); 
        setCurrentShift({ ...shift, is_clocked_in: true, actual_start: new Date().toISOString() }); 
      } else {
        throw error;
      }
    } catch (e) {
      console.log("Clock-in failed, saving locally...");
      const todayShift = { 
        user_id: profile.id, 
        restaurant_id: restaurant.id, 
        is_clocked_in: true, 
        actual_start: new Date().toISOString(), 
        type: 'CLOCK_IN' 
      };
      await RobustSync.saveLocally('shifts', todayShift);
      toast("Offline: Einstempelzeit wurde lokal gespeichert!", { icon: "☁️" });
      setCurrentShift({ ...profile, is_clocked_in: true, actual_start: new Date().toISOString() });
    }
  }

  async function clockOut() {
    if (!currentShift) return;
    try {
      const { error } = await supabase.from("shifts").update({ is_clocked_in: false, actual_end: new Date().toISOString() }).eq("id", currentShift.id);
      if (!error) { 
        toast.success("Ausgestempelt!"); 
        setCurrentShift(null); 
        loadEmployeeData(); 
      } else {
        throw error;
      }
    } catch (e) {
      console.log("Clock-out failed, saving locally...");
      await RobustSync.saveLocally('shifts', { 
        id: currentShift.id, 
        is_clocked_in: false, 
        actual_end: new Date().toISOString(), 
        type: 'CLOCK_OUT' 
      });
      toast("Offline: Ausstempelzeit lokal gespeichert!", { icon: "☁️" });
      setCurrentShift(null);
    }
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
    const weekStart = getMonday(1).toISOString().slice(0, 10);
    const payload: Record<string, any> = { restaurant_id: restaurant.id, user_id: profile.id, week_start: weekStart };
    DAY_KEYS.forEach(d => { payload[d] = !!availability[d]; payload[`${d}_note`] = notes[d] || null; });
    
    try {
      const { error } = await supabase.from("availability").upsert(payload, { onConflict: "restaurant_id,user_id,week_start" });
      if (!error) toast.success("Verfügbarkeit eingereicht!"); else throw error;
    } catch (e) {
      console.log("Availability submit failed, saving locally...");
      await RobustSync.saveLocally('availability', payload);
      toast("Offline: Verfügbarkeit lokal gespeichert!", { icon: "☁️" });
    }
  }

  async function loadAbrechnung(month: string) {
    if (!profile || !restaurant) return;
    const [y, m] = month.split("-").map(Number);
    // Lokale Datumsgrenzen ohne UTC-Verschiebung
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${month}-01T00:00:00`;
    const end = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59`;
    const { data } = await supabase
      .from("shifts")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("user_id", profile.id)
      .gte("start_time", start)
      .lte("start_time", end)
      .order("start_time", { ascending: true });
    setAbrShifts(data || []);
  }

  useEffect(() => {
    if (tab === "abrechnung" && profile && restaurant) loadAbrechnung(abrMonth);
  }, [tab, abrMonth, profile, restaurant]);

  function changeMonth(dir: 1 | -1) {
    const [y, m] = abrMonth.split("-").map(Number);
    let newY = y, newM = m + dir;
    if (newM > 12) { newM = 1; newY++; }
    if (newM < 1) { newM = 12; newY--; }
    setAbrMonth(`${newY}-${String(newM).padStart(2, "0")}`);
  }

  async function exportAbrechnungPDF() {
    const { jsPDF } = await import("jspdf");
    const [y, m] = abrMonth.split("-").map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const completed = abrShifts.filter(s => s.actual_end);
    const totalH = completed.reduce((s, sh) => s + (new Date(sh.actual_end).getTime() - new Date(sh.actual_start || sh.start_time).getTime()) / 3600000, 0);
    const totalEur = completed.reduce((s, sh) => {
      const h = (new Date(sh.actual_end).getTime() - new Date(sh.actual_start || sh.start_time).getTime()) / 3600000;
      return s + h * Number(sh.hourly_wage || 13);
    }, 0);
    const avgWage = completed.length > 0 ? completed.reduce((s, sh) => s + Number(sh.hourly_wage || 13), 0) / completed.length : 13;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    const gray = (v: number): [number, number, number] => [v, v, v];

    // ── Orange header bar ────────────────────────────────────────────────
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, W, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("LOHNABRECHNUNG", 14, 12);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Abrechnungszeitraum: ${monthName}`, 14, 20);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-DE")}`, W - 14, 20, { align: "right" });

    // ── Arbeitgeber / Arbeitnehmer Boxen ────────────────────────────────
    doc.setTextColor(...gray(30));
    const boxY = 36;

    // Arbeitgeber Box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, boxY, 85, 34, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(249, 115, 22);
    doc.text("ARBEITGEBER", 19, boxY + 7);
    doc.setTextColor(...gray(30));
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(restaurant?.name || "Restaurant", 19, boxY + 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray(100));
    doc.text("Gastronomie", 19, boxY + 22);

    // Arbeitnehmer Box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(111, boxY, 85, 34, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(249, 115, 22);
    doc.text("ARBEITNEHMER", 116, boxY + 7);
    doc.setTextColor(...gray(30));
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(profile?.name || "Mitarbeiter", 116, boxY + 15);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray(100));
    const memberInfo = abrShifts[0] ? `${avgWage.toFixed(2)} €/Std.` : "Stundenlohn";
    doc.text(memberInfo, 116, boxY + 22);
    doc.text(`Periode: ${monthName}`, 116, boxY + 29);

    // ── Trennlinie ───────────────────────────────────────────────────────
    const tableY = boxY + 44;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(14, tableY - 4, W - 14, tableY - 4);

    // ── Tabelle Header ───────────────────────────────────────────────────
    doc.setFillColor(31, 41, 55);
    doc.rect(14, tableY, W - 28, 8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const cols = [
      { label: "Nr.", x: 17 },
      { label: "Datum", x: 27 },
      { label: "Wochentag", x: 60 },
      { label: "Von", x: 98 },
      { label: "Bis", x: 116 },
      { label: "Stunden", x: 134 },
      { label: "Std.-Lohn", x: 155 },
      { label: "Betrag", x: W - 17, align: "right" as const },
    ];
    cols.forEach(c => doc.text(c.label, c.x, tableY + 5.5, { align: c.align || "left" }));

    // ── Tabellenzeilen ───────────────────────────────────────────────────
    let curY = tableY + 8;
    completed.forEach((s, i) => {
      const start = new Date(s.actual_start || s.start_time);
      const end = new Date(s.actual_end);
      const h = (end.getTime() - start.getTime()) / 3600000;
      const wage = Number(s.hourly_wage || 13);
      const earned = h * wage;

      if (i % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(14, curY, W - 28, 7, "F");
      }

      doc.setTextColor(...gray(30));
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(String(i + 1).padStart(2, "0"), 17, curY + 5);
      doc.text(start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }), 27, curY + 5);
      doc.text(start.toLocaleDateString("de-DE", { weekday: "long" }), 60, curY + 5);
      doc.text(start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), 98, curY + 5);
      doc.text(end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }), 116, curY + 5);
      doc.text(h.toFixed(2) + " h", 134, curY + 5);
      doc.text(wage.toFixed(2) + " €", 155, curY + 5);
      doc.setFont("helvetica", "bold");
      doc.text(earned.toFixed(2) + " €", W - 17, curY + 5, { align: "right" });
      doc.setFont("helvetica", "normal");

      // Zeilentrennlinie
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.1);
      doc.line(14, curY + 7, W - 14, curY + 7);
      curY += 7;
    });

    // ── Summenzeile ──────────────────────────────────────────────────────
    curY += 2;
    doc.setFillColor(31, 41, 55);
    doc.rect(14, curY, W - 28, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("GESAMT", 17, curY + 7);
    doc.text(`${completed.length} Schichten`, 60, curY + 7);
    doc.text(`${totalH.toFixed(2)} h`, 134, curY + 7);
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(10);
    doc.text(`${totalEur.toFixed(2)} €`, W - 17, curY + 7, { align: "right" });

    // ── Netto-Info Box ───────────────────────────────────────────────────
    curY += 18;
    doc.setFillColor(254, 247, 237);
    doc.roundedRect(14, curY, W - 28, 22, 3, 3, "F");
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(0.5);
    doc.line(14, curY, 14, curY + 22);

    doc.setTextColor(249, 115, 22);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("ABRECHNUNGSÜBERSICHT", 19, curY + 7);
    doc.setTextColor(...gray(30));
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gearbeitete Stunden:`, 19, curY + 14);
    doc.setFont("helvetica", "bold");
    doc.text(`${totalH.toFixed(2)} Stunden`, 75, curY + 14);
    doc.setFont("helvetica", "normal");
    doc.text(`Ø Stundenlohn:`, 110, curY + 14);
    doc.setFont("helvetica", "bold");
    doc.text(`${avgWage.toFixed(2)} €`, 150, curY + 14);

    doc.setFont("helvetica", "normal");
    doc.text(`Bruttolohn ${monthName}:`, 19, curY + 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(11);
    doc.text(`${totalEur.toFixed(2)} EUR`, 75, curY + 20);

    // ── Unterschriftenfeld ───────────────────────────────────────────────
    curY += 34;
    doc.setTextColor(...gray(150));
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(...gray(180));
    doc.setLineWidth(0.3);

    doc.line(14, curY + 10, 85, curY + 10);
    doc.text("Datum, Unterschrift Arbeitgeber", 14, curY + 15);

    doc.line(120, curY + 10, W - 14, curY + 10);
    doc.text("Datum, Unterschrift Arbeitnehmer", 120, curY + 15);

    // ── Footer ───────────────────────────────────────────────────────────
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 282, W, 15, "F");
    doc.setTextColor(...gray(150));
    doc.setFontSize(7);
    doc.text(`${restaurant?.name || "Restaurant"} · Lohnabrechnung ${monthName} · ${profile?.name || ""}`, W / 2, 290, { align: "center" });

    doc.save(`Lohnabrechnung_${profile?.name?.replace(/\s+/g, "_")}_${abrMonth}.pdf`);
    toast.success("PDF wird heruntergeladen!");
  }

  async function logout() {
    await supabase.auth.signOut();
    clear();
    router.replace("/auth");
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
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto pb-1">
        {([["dashboard", "Übersicht"], ["schedule", "Dienstplan"], ["availability", "Verfügbarkeit"], ["abrechnung", "Abrechnung"], ["chat", "💬 Chat"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-shrink-0 flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === k ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400"}`}>{l}</button>
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
                        <p className="text-gray-400 text-xs">{new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {s.end_time ? new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
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
                    <p className="text-gray-400 text-xs">{new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {s.end_time ? new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                  </div>
                  <span className="text-orange-400 text-xs font-medium">{s.end_time ? ((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3600000).toFixed(1) + "h" : "—"}</span>
                </div>
              ))}
              {myShifts.filter(s => new Date(s.start_time) >= new Date()).length === 0 && <p className="text-gray-500 text-sm text-center py-4">Keine geplanten Schichten</p>}
            </div>
          </div>
        )}

        {tab === "abrechnung" && (() => {
          const [y, m] = abrMonth.split("-").map(Number);
          const monthName = new Date(y, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
          const completed = abrShifts.filter(s => s.actual_end);
          const planned = abrShifts.filter(s => !s.actual_end);
          const totalH = completed.reduce((s, sh) => {
            return s + (new Date(sh.actual_end).getTime() - new Date(sh.actual_start || sh.start_time).getTime()) / 3600000;
          }, 0);
          const totalEur = completed.reduce((s, sh) => {
            const h = (new Date(sh.actual_end).getTime() - new Date(sh.actual_start || sh.start_time).getTime()) / 3600000;
            return s + h * Number(sh.hourly_wage || 13);
          }, 0);

          return (
            <div className="space-y-4">
              {/* Header: Monatsnavigation */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">{monthName}</p>
                  <p className="text-gray-400 text-xs">Monatliche Lohnabrechnung</p>
                </div>
                <button onClick={() => changeMonth(1)} disabled={abrMonth >= (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; })()}
                  className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Schichten", value: String(completed.length), icon: Calendar, color: "text-blue-400" },
                  { label: "Stunden", value: `${totalH.toFixed(1)}h`, icon: Clock, color: "text-orange-400" },
                  { label: "Verdient", value: `${totalEur.toFixed(2)} €`, icon: Euro, color: "text-green-400" },
                ].map(k => (
                  <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
                    <k.icon size={20} className={`${k.color} mx-auto mb-1`} />
                    <p className="text-white font-bold text-lg">{k.value}</p>
                    <p className="text-gray-500 text-xs">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* PDF-Download Button */}
              {completed.length > 0 && (
                <button onClick={exportAbrechnungPDF}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white py-3.5 rounded-2xl font-semibold text-sm transition-colors shadow-lg shadow-orange-500/20">
                  <Download size={18} />
                  Lohnabrechnung {monthName} als PDF herunterladen
                </button>
              )}

              {/* Schichten-Tabelle */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                  <FileText size={16} className="text-orange-400" />
                  <h3 className="font-semibold text-white">Abgeleistete Schichten</h3>
                </div>

                {completed.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText size={32} className="text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Keine abgeschlossenen Schichten</p>
                    <p className="text-gray-600 text-xs mt-1">in {monthName}</p>
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-gray-800/50">
                      {completed.map((s, i) => {
                        const start = new Date(s.actual_start || s.start_time);
                        const end = new Date(s.actual_end);
                        const h = (end.getTime() - start.getTime()) / 3600000;
                        const wage = Number(s.hourly_wage || 13);
                        const earned = h * wage;
                        return (
                          <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
                              <span className="text-gray-400 text-xs font-bold">{String(i + 1).padStart(2, "0")}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium">
                                {start.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                                {" · "}{wage.toFixed(2)} €/h
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-white text-sm font-semibold">{earned.toFixed(2)} €</p>
                              <p className="text-gray-500 text-xs">{h.toFixed(1)} Std.</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summe */}
                    <div className="border-t border-gray-700 bg-gray-800/50 px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold text-sm">Gesamt {monthName}</p>
                        <p className="text-gray-400 text-xs">{completed.length} Schichten · {totalH.toFixed(1)} Stunden</p>
                      </div>
                      <p className="text-green-400 font-bold text-xl">{totalEur.toFixed(2)} €</p>
                    </div>
                  </>
                )}
              </div>

              {/* Geplante Schichten */}
              {planned.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                    <Calendar size={16} className="text-orange-400" />
                    <h3 className="font-semibold text-white">Noch ausstehend ({planned.length})</h3>
                  </div>
                  <div className="divide-y divide-gray-800/50">
                    {planned.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 text-sm">
                            {new Date(s.start_time).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(s.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} – {new Date(s.end_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Geplant</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hinweis */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                <p className="text-blue-300 text-xs font-medium mb-1">Hinweis</p>
                <p className="text-gray-400 text-xs">Das PDF enthält eine professionelle Lohnabrechnung mit allen Schichten, Stunden und Gesamtlohn — geeignet für Steuerberater, Behörden oder als persönlicher Nachweis.</p>
              </div>
            </div>
          );
        })()}

        {tab === "chat" && <Chat isChef={false} />}

        {tab === "availability" && (() => {
          const SLOTS = ["Vormittag", "Mittag", "Abend"];
          function getSlots(dayKey: string): string[] {
            return notes[dayKey] ? notes[dayKey].split(",").filter(Boolean) : [];
          }
          function toggleSlot(dayKey: string, slot: string) {
            const current = getSlots(dayKey);
            const next = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
            setNotes(prev => ({ ...prev, [dayKey]: next.join(",") }));
            setAvailability(prev => ({ ...prev, [dayKey]: next.length > 0 }));
          }
          return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="font-semibold text-white mb-1">Verfügbarkeit – nächste Woche</h3>
              <p className="text-gray-400 text-xs mb-4">{getMonday(1).toLocaleDateString("de-DE", { day: "numeric", month: "long" })} – reiche bis Donnerstag ein</p>
              <div className="space-y-4">
                {DAYS.map((day, i) => {
                  const dk = DAY_KEYS[i];
                  const selected = getSlots(dk);
                  const isAvail = selected.length > 0;
                  return (
                    <div key={day} className={`rounded-xl p-3 border transition-colors ${isAvail ? "border-green-500/30 bg-green-500/5" : "border-gray-800 bg-gray-800/30"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${isAvail ? "text-white" : "text-gray-400"}`}>{day}</span>
                        {isAvail
                          ? <span className="text-xs text-green-400 font-medium">Verfügbar</span>
                          : <span className="text-xs text-gray-600">Nicht verfügbar</span>}
                      </div>
                      <div className="flex gap-2">
                        {SLOTS.map(slot => {
                          const active = selected.includes(slot);
                          return (
                            <button key={slot} onClick={() => toggleSlot(dk, slot)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}>
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-gray-500 text-xs mt-3 mb-4">Tippe auf einen Zeitraum um ihn auszuwählen. Mehrere Zeiten pro Tag sind möglich.</p>
              <button onClick={submitAvailability} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                <CheckCircle size={16} /> Verfügbarkeit einreichen
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
