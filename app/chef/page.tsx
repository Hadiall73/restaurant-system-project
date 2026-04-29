"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Calendar, Users, TrendingUp, MessageSquare, Key, LogOut, ChefHat, Menu, X, Settings, Activity } from "lucide-react";
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
import PosConnect from "@/components/chef/PosConnect";

const NAV = [
  { id: "dashboard", label: "Live Dashboard", icon: LayoutDashboard },
  { id: "pos", label: "Kassensystem", icon: Activity },
  { id: "schedule", label: "Dienstplan", icon: Calendar },
  { id: "team", label: "Team", icon: Users },
  { id: "bookkeeping", label: "Buchhaltung", icon: TrendingUp },
  { id: "rechnungen", label: "Rechnungen", icon: Key },
  { id: "lager", label: "Lager", icon: Settings },
  { id: "steuer", label: "Steuer", icon: Settings },
  { id: "agent", label: "KI Agent", icon: MessageSquare },
];

export default function ChefPage() {
  const { profile, restaurant, setProfile, setRestaurant, setMembers, clear } = useStore();
  const router = useRouter();
  const [aktiv, setAktiv] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<"waiting" | "done">("done");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push("/auth"); return; }
      const userId = data.session.user.id;
      const email = data.session.user.email || "";

      // Load profile via server route
      const profRes = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email }),
      });
      const profJson = await profRes.json();
      const p = profJson.profile;
      if (p) {
        setProfile(p);
        if (p.role === "employee") { router.push("/employee"); return; }
        if (p.role === "developer") { router.push("/developer"); return; }
      }

      // Load restaurant via server route
      const restRes = await fetch(`/api/auth/get-restaurant?user_id=${userId}`);
      const restJson = await restRes.json();
      if (restJson.restaurant) { setRestaurant(restJson.restaurant); setSetupStep("done"); }
      else setSetupStep("waiting");
    });
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    clear();
    router.push("/auth");
  }

  const seiten: Record<string, React.ReactNode> = {
    dashboard: <RealtimeDashboard />,
    pos: <PosConnect />,
    schedule: <ScheduleManager />,
    team: <TeamManager />,
    bookkeeping: <Bookkeeping />,
    rechnungen: <Rechnungen />,
    lager: <Lager />,
    steuer: <Steuer />,
    agent: <KiAgent />,
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all">
            <LogOut size={17} /> Abmelden
          </button>
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
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {seiten[aktiv]}
        </main>
      </div>
    </div>
  );
}
