"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { ChefHat, Lock, Mail, User, Eye, EyeOff, Phone } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { setProfile } = useStore();
  const router = useRouter();

  const devEmail = process.env.NEXT_PUBLIC_DEVELOPER_EMAIL || "alzoubihadii@gmail.com";

  async function handleLogin() {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErrorMsg(error.message); setLoading(false); return; }

      const res = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: data.user.id, email, name, phone }),
      });
      const json = await res.json();

      if (json.profile) {
        setProfile(json.profile);
        if (json.profile.role === "developer") router.push("/developer");
        else if (json.profile.role === "chef") router.push("/chef");
        else router.push("/employee");
      } else {
        setErrorMsg(json.error || "Profil konnte nicht geladen werden");
      }
      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message || "Verbindungsfehler");
      setLoading(false);
    }
  }

  async function handleRegister() {
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setErrorMsg(error.message); setLoading(false); return; }
      if (!data.user) { setErrorMsg("Registrierung fehlgeschlagen"); setLoading(false); return; }

      await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: data.user.id, email, name, phone }),
      });
      toast.success("Erfolgreich registriert!");
      setMode("login");
      setLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message || "Verbindungsfehler");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/30">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Restaurant Manager</h1>
          <p className="text-gray-400 mt-2 text-sm">KI-gestütztes Restaurant Management</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex rounded-xl bg-gray-800 p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "register" && (
              <>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Vollständiger Name"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-3.5 text-gray-400" />
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefonnummer" type="tel"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                </div>
              </>
            )}
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" type="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort"
                type={showPw ? "text" : "password"}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl px-4 py-3 text-red-400 text-sm">
                {errorMsg}
              </div>
            )}
            <button onClick={mode === "login" ? handleLogin : handleRegister} disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
              {loading ? "Laden..." : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </div>

          {mode === "register" && (
            <p className="text-xs text-gray-500 text-center mt-4">
              Als Mitarbeiter registrieren. Chef-Zugänge werden vom Administrator erstellt.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
