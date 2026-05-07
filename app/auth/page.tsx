"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import {
  ChefHat, Lock, Mail, User, Eye, EyeOff, KeyRound,
  Building2, Sparkles, CheckCircle2, ArrowRight,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type Mode = "login" | "register" | "onboard";

export default function AuthPage() {
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Onboarding fields
  const [restaurantName, setRestaurantName] = useState("");
  const [licenseKey, setLicenseKey]         = useState("");
  const [onboardDone, setOnboardDone]       = useState<{ invite_code: string; trial_ends_at: string; restaurant_name: string } | null>(null);

  const { setProfile } = useStore();
  const router = useRouter();

  function reset() {
    setErrorMsg(""); setEmail(""); setPassword(""); setName(""); setInviteCode("");
    setRestaurantName(""); setLicenseKey(""); setOnboardDone(null);
  }
  function switchMode(m: Mode) { setMode(m); setErrorMsg(""); }

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setLoading(true); setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setErrorMsg("E-Mail oder Passwort falsch"); setLoading(false); return; }

      const res  = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ user_id: data.user.id, email, name: data.user.user_metadata?.name || "" }),
      });
      const json = await res.json();
      if (json.profile) {
        setProfile(json.profile);
        if      (json.profile.role === "developer") router.replace("/developer");
        else if (json.profile.role === "chef")      router.replace("/chef");
        else                                         router.replace("/employee");
      } else {
        setErrorMsg("Profil konnte nicht geladen werden");
      }
    } catch { setErrorMsg("Verbindungsfehler"); }
    setLoading(false);
  }

  // ── Mitarbeiter-Registrierung ─────────────────────────────────────────────
  async function handleRegister() {
    if (!name.trim())        { setErrorMsg("Bitte gib deinen Namen ein"); return; }
    if (!inviteCode.trim())  { setErrorMsg("Bitte gib den Einladungscode ein"); return; }
    if (password.length < 6) { setErrorMsg("Passwort muss mindestens 6 Zeichen haben"); return; }

    setLoading(true); setErrorMsg("");
    try {
      const res  = await fetch("/api/auth/register-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, invite_code: inviteCode }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error || "Registrierung fehlgeschlagen"); setLoading(false); return; }

      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !data.user) {
        toast.success(`Willkommen bei ${json.restaurant_name}! Bitte jetzt einloggen.`);
        reset(); setMode("login"); setLoading(false); return;
      }

      const profileRes  = await fetch("/api/auth/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ user_id: data.user.id, email, name }),
      });
      const profileJson = await profileRes.json();
      if (profileJson.profile) {
        toast.success(`Willkommen bei ${json.restaurant_name}!`);
        setProfile(profileJson.profile);
        router.replace("/employee");
      } else {
        toast.success("Registriert! Bitte einloggen.");
        setMode("login");
      }
    } catch { setErrorMsg("Verbindungsfehler"); }
    setLoading(false);
  }

  // ── Restaurant-Onboarding ─────────────────────────────────────────────────
  async function handleOnboard() {
    if (!restaurantName.trim()) { setErrorMsg("Bitte gib den Restaurantnamen ein"); return; }
    if (!name.trim())           { setErrorMsg("Bitte gib deinen Namen ein"); return; }
    if (!licenseKey.trim())     { setErrorMsg("Bitte gib den Lizenzschlüssel ein"); return; }
    if (password.length < 6)   { setErrorMsg("Passwort muss mindestens 6 Zeichen haben"); return; }

    setLoading(true); setErrorMsg("");
    try {
      const res  = await fetch("/api/auth/register-restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_name: restaurantName,
          chef_name:       name,
          chef_email:      email,
          chef_password:   password,
          license_key:     licenseKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setErrorMsg(json.error || "Registrierung fehlgeschlagen"); setLoading(false); return; }

      // Direkt einloggen
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginError && data.user) {
        const profileRes  = await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${data.session?.access_token}` },
          body: JSON.stringify({ user_id: data.user.id, email, name }),
        });
        const profileJson = await profileRes.json();
        if (profileJson.profile) setProfile(profileJson.profile);
      }

      setOnboardDone({ invite_code: json.invite_code, trial_ends_at: json.trial_ends_at, restaurant_name: json.restaurant_name });
    } catch { setErrorMsg("Verbindungsfehler"); }
    setLoading(false);
  }

  // ── Onboarding Success Screen ─────────────────────────────────────────────
  if (onboardDone) {
    const trialEnd  = new Date(onboardDone.trial_ends_at);
    const daysLeft  = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-green-500/30 rounded-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Restaurant eingerichtet!</h2>
              <p className="text-gray-400 text-sm mt-1">{onboardDone.restaurant_name} ist jetzt live</p>
            </div>

            {/* Trial Info */}
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-4 text-left">
              <p className="text-orange-300 font-semibold text-sm mb-1">
                🎉 {daysLeft} Tage kostenlos testen
              </p>
              <p className="text-gray-400 text-xs">
                Dein Testzeitraum läuft bis zum <strong className="text-white">{trialEnd.toLocaleDateString("de-DE")}</strong>.
                Danach: <strong className="text-white">99,99 €/Monat</strong>.
              </p>
            </div>

            {/* Invite Code */}
            <div className="bg-gray-800 rounded-xl p-4 text-left">
              <p className="text-gray-400 text-xs mb-2">Einladungscode für deine Mitarbeiter:</p>
              <p className="font-mono text-orange-400 text-xl font-bold tracking-widest text-center">
                {onboardDone.invite_code}
              </p>
              <p className="text-gray-500 text-xs mt-2 text-center">
                Mitarbeiter geben diesen Code bei der Registrierung ein
              </p>
            </div>

            <button
              onClick={() => router.replace("/chef")}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
              Zum Dashboard <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Hauptformular ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-lg shadow-orange-500/30">
            <ChefHat size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Restaurant Manager</h1>
          <p className="text-gray-400 mt-2 text-sm">KI-gestütztes Restaurant Management</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl space-y-6">

          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-800 p-1 gap-1">
            <button onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${mode === "login" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              Anmelden
            </button>
            <button onClick={() => switchMode("onboard")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${mode === "onboard" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              <Sparkles size={11} /> Restaurant starten
            </button>
            <button onClick={() => switchMode("register")}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${mode === "register" ? "bg-orange-500 text-white shadow" : "text-gray-400 hover:text-white"}`}>
              Als Mitarbeiter
            </button>
          </div>

          {/* ── LOGIN ── */}
          {mode === "login" && (
            <div className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail" type="email"
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Passwort"
                  type={showPw ? "text" : "password"} onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errorMsg && <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{errorMsg}</div>}
              <button onClick={handleLogin} disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
                {loading ? "Anmelden..." : "Anmelden"}
              </button>
            </div>
          )}

          {/* ── RESTAURANT ONBOARDING ── */}
          {mode === "onboard" && (
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-orange-300 text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Sparkles size={12} /> 14 Tage kostenlos — dann 99,99 €/Monat
                </p>
                <p className="text-gray-400 text-xs">
                  Du brauchst einen <strong className="text-white">Lizenzschlüssel</strong>. In weniger als 2 Minuten ist dein Restaurant live.
                </p>
              </div>

              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)}
                  placeholder="Name deines Restaurants *"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name (Chef) *"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Deine E-Mail *" type="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort (min. 6 Zeichen) *" type={showPw ? "text" : "password"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Lizenzschlüssel */}
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-3.5 text-orange-400" />
                <input value={licenseKey} onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                  placeholder="RESTO-XXX-XXXX-XXXX *"
                  className="w-full bg-gray-800 border border-orange-500/40 rounded-xl pl-9 pr-4 py-3 text-sm text-orange-300 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors font-mono tracking-wider" />
              </div>
              <p className="text-gray-600 text-xs -mt-2">
                Keinen Schlüssel? Kontaktiere uns für ein Abo.
              </p>

              {errorMsg && <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{errorMsg}</div>}

              <button onClick={handleOnboard} disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                {loading ? "Wird eingerichtet..." : <><Sparkles size={16} /> Restaurant jetzt starten</>}
              </button>
            </div>
          )}

          {/* ── MITARBEITER REGISTRIERUNG ── */}
          {mode === "register" && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                <p className="text-blue-400 text-xs">
                  Du brauchst den <strong>Einladungscode</strong> von deinem Chef. Kein E-Mail bestätigen nötig.
                </p>
              </div>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Vollständiger Name *"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-Mail *" type="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort (min. 6 Zeichen) *" type={showPw ? "text" : "password"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-10 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" />
                <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-white">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-3.5 text-gray-400" />
                <input value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Einladungscode vom Chef *"
                  className="w-full bg-gray-800 border border-orange-500/30 rounded-xl pl-9 pr-4 py-3 text-sm text-orange-300 placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors font-mono tracking-widest" />
              </div>
              {errorMsg && <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{errorMsg}</div>}
              <button onClick={handleRegister} disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
                {loading ? "Registrieren..." : "Jetzt registrieren & einloggen"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
