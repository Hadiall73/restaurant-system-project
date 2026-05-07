"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Calendar, CalendarDays, Users, TrendingUp, MessageSquare, Key, LogOut, ChefHat, Menu, X, Settings, FileUp, CreditCard, LifeBuoy, Star, AlertTriangle, Clock, QrCode } from "lucide-react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import RealtimeDashboard from "@/components/chef/RealtimeDashboard";
import ScheduleManager from "@/components/chef/ScheduleManager";
import TeamManager from "@/components/chef/TeamManager";
import Bookkeeping from "@/components/chef/Bookkeeping";
import KiAgent from "@/components/KiAgent";
import Lager from "@/components/Lager";
import Rechnungen from "@/components/Rechnungen";
import Steuer from "@/components/Steuer";
import Chat from "@/components/Chat";
import ReservierungenChef from "@/components/chef/Reservierungen";
import UmsatzImport from "@/components/chef/UmsatzImport";
import PosConnect from "@/components/chef/PosConnect";
import Support from "@/components/chef/Support";
import Abo from "@/components/chef/Abo";

const NAV = [
  { id: "dashboard",      label: "Übersicht",       icon: LayoutDashboard },
  { id: "reservierungen", label: "Reservierungen",  icon: CalendarDays },
  { id: "schedule",       label: "Dienstplan",      icon: Calendar },
  { id: "team",           label: "Team",            icon: Users },
  { id: "chat",           label: "Team Chat",       icon: MessageSquare },
  { id: "bookkeeping",    label: "Buchhaltung",     icon: TrendingUp },
  { id: "rechnungen",     label: "Rechnungen",      icon: Key },
  { id: "lager",          label: "Lager",           icon: Settings },
  { id: "steuer",         label: "Steuer",          icon: Settings },
  { id: "kasse",          label: "Kassensystem",        icon: CreditCard },
  { id: "import",         label: "Umsatz Import",       icon: FileUp },
  { id: "agent",          label: "KI Agent",            icon: MessageSquare },
  { id: "abo",            label: "Mein Abo",            icon: Star },
  { id: "support",        label: "Support",             icon: LifeBuoy },
];

export default function ChefPage() {
  const { profile, restaurant, setProfile, setRestaurant, setMembers, clear } = useStore();
  const router = useRouter();
  const [aktiv, setAktiv] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<"waiting" | "done">("done");
  const [loading, setLoading] = useState(false);
  const [trialToastShown, setTrialToastShown] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace("/auth"); return; }
      const userId = data.session.user.id;
      const email = data.session.user.email || "";

      // Load profile via server route
      const profRes = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ user_id: userId, email }),
      });
      const profJson = await profRes.json();
      const p = profJson.profile;
      if (p) {
        setProfile(p);
        if (p.role === "employee") { router.replace("/employee"); return; }
        if (p.role === "developer") { router.replace("/developer"); return; }
      }

      // Load restaurant via server route
      const restRes = await fetch(`/api/auth/get-restaurant?user_id=${userId}`);
      const restJson = await restRes.json();
      if (restJson.restaurant) {
        setRestaurant(restJson.restaurant);
        setSetupStep("done");
      } else setSetupStep("waiting");
    });
  }, []);

  // Trial-Benachrichtigung einmalig pro Session anzeigen
  useEffect(() => {
    if (!restaurant || trialToastShown) return;
    const trialEnd  = restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
    const trialLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
    if (restaurant.is_paid) return;
    if (trialLeft !== null && trialLeft > 0) {
      toast(`🎉 Willkommen! Du nutzt das System kostenlos — noch ${trialLeft} ${trialLeft === 1 ? "Tag" : "Tage"} verbleiben.`, {
        duration: 6000,
        style: { background: "#1f2937", color: "#fff", border: "1px solid #f97316", borderRadius: "12px" },
        icon: "⏳",
      });
    }
    setTrialToastShown(true);
  }, [restaurant]);

  async function logout() {
    await supabase.auth.signOut();
    clear();
    router.replace("/auth");
  }

  const seiten: Record<string, React.ReactNode> = {
    dashboard:      <RealtimeDashboard />,
    reservierungen: <ReservierungenChef />,
    schedule:       <ScheduleManager />,
    team:           <TeamManager />,
    chat:           <Chat isChef={true} />,
    bookkeeping:    <Bookkeeping />,
    rechnungen:     <Rechnungen />,
    lager:          <Lager />,
    steuer:         <Steuer />,
    kasse:          <PosConnect />,
    import:         <UmsatzImport />,
    agent:          <KiAgent />,
    abo:            <Abo />,
    support:        <Support />,
  };

  if (setupStep === "waiting") return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ChefHat size={28} className="text-orange-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Kein Restaurant gefunden</h2>
        <p className="text-gray-400 text-sm">Dein Zugang wurde noch nicht eingerichtet. Bitte wende dich an den Administrator.</p>
        <button onClick={logout} className="mt-6 text-gray-500 hover:text-white text-sm transition-colors">Abmelden</button>
      </div>
    </div>
  );

  // Paywall — Trial abgelaufen und nicht bezahlt
  const trialEnd  = restaurant?.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
  const trialLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
  const trialExpired = trialLeft !== null && trialLeft <= 0 && !restaurant?.is_paid;

  if (trialExpired) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
          <AlertTriangle size={36} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Testphase abgelaufen</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Deine 14-tägige kostenlose Testphase ist beendet.<br />
            Abonniere jetzt um weiterzumachen — alle deine Daten sind noch da.
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-bold">Restaurant System Pro</p>
              <p className="text-gray-500 text-xs">Alle Funktionen · jederzeit kündbar</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-xl">99,99 €</p>
              <p className="text-gray-500 text-xs">/Monat</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (!restaurant || !profile) return;
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurant_id: restaurant.id, restaurant_name: restaurant.name, email: profile.email }),
              });
              const json = await res.json();
              if (json.url) window.location.href = json.url;
              else toast.error("Fehler beim Starten der Zahlung");
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
            <Star size={18} /> Jetzt abonnieren — 99,99 €/Monat
          </button>
        </div>
        <button onClick={logout} className="text-gray-600 hover:text-gray-400 text-sm transition-colors">
          Abmelden
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ${menuOpen ? "translate-x-0" : "-translate-x-full"} lg:static lg:translate-x-0`}>
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"><ChefHat size={20} className="text-white" /></div>
            <div><p className="text-white font-bold text-sm truncate max-w-32">{restaurant?.name || "Restaurant"}</p><p className="text-gray-400 text-xs">Chef Dashboard</p></div>
          </div>
        </div>
        <nav className="p-4 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { setAktiv(item.id); setMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${aktiv === item.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
                <Icon size={17} /> {item.label}
                {item.id === "agent" && <span className="ml-auto bg-orange-400/30 text-orange-300 text-xs px-1.5 py-0.5 rounded-full">KI</span>}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-800">
          {/* Trial / Abo Banner */}
          {(() => {
            const trialEnd  = restaurant?.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
            const trialLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
            const expired   = trialLeft !== null && trialLeft <= 0 && !restaurant?.is_paid;
            const inTrial   = trialLeft !== null && trialLeft > 0 && !restaurant?.is_paid;
            if (restaurant?.is_paid) return null;
            if (expired) return (
              <button onClick={() => setAktiv("abo")}
                className="w-full flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <div className="text-left">
                  <p className="text-red-400 text-xs font-semibold">Trial abgelaufen</p>
                  <p className="text-red-500/70 text-xs">Jetzt abonnieren →</p>
                </div>
              </button>
            );
            if (inTrial) return (
              <button onClick={() => setAktiv("abo")}
                className="w-full flex items-center gap-2 px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 transition-colors">
                <Clock size={14} className="text-orange-400 shrink-0" />
                <div className="text-left">
                  <p className="text-orange-300 text-xs font-semibold">Trial: noch {trialLeft} {trialLeft === 1 ? "Tag" : "Tage"}</p>
                  <p className="text-orange-500/70 text-xs">Abo ansehen →</p>
                </div>
              </button>
            );
            return null;
          })()}
          <div className="p-4">
            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
              <LogOut size={17} /> Abmelden
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMenuOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-xl bg-gray-800 text-white">
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <p className="text-white font-semibold text-sm">{NAV.find(n => n.id === aktiv)?.label}</p>
        </header>
        <main className={`flex-1 overflow-hidden ${aktiv === "chat" ? "" : "overflow-y-auto p-4 lg:p-8"}`}>
          {seiten[aktiv]}
        </main>
      </div>
    </div>
  );
}
