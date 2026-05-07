"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CreditCard, CheckCircle, Zap, Shield, RefreshCw, Star, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

export default function Abo() {
  const { restaurant, profile } = useStore();
  const [loading, setLoading] = useState(false);

  const trialEnd  = restaurant?.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
  const trialLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null;
  const inTrial   = trialLeft !== null && trialLeft > 0 && !restaurant?.is_paid;
  const expired   = trialLeft !== null && trialLeft <= 0 && !restaurant?.is_paid;
  const isPaid    = restaurant?.is_paid;

  async function subscribe() {
    if (!restaurant || !profile) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id:   restaurant.id,
          restaurant_name: restaurant.name,
          email:           profile.email,
        }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(json.error || "Fehler beim Starten der Zahlung");
      }
    } catch {
      toast.error("Verbindungsfehler");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Mein Abo</h2>
        <p className="text-gray-400 text-sm mt-1">{restaurant?.name}</p>
      </div>

      {/* Status-Karte */}
      {isPaid && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle size={24} className="text-green-400" />
          </div>
          <div>
            <p className="text-green-300 font-bold text-lg">Aktiv — Vollzugriff</p>
            <p className="text-gray-400 text-sm">Dein Abo läuft. Alle Funktionen sind freigeschaltet.</p>
          </div>
        </div>
      )}

      {inTrial && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <Clock size={24} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="text-orange-300 font-bold text-lg">
              Kostenlose Testphase — noch {trialLeft} {trialLeft === 1 ? "Tag" : "Tage"}
            </p>
            <p className="text-gray-400 text-sm">
              Endet am {trialEnd?.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      )}

      {expired && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <p className="text-red-300 font-bold text-lg">Testphase abgelaufen</p>
            <p className="text-gray-400 text-sm">Bitte abonnieren um weiter alle Funktionen zu nutzen.</p>
          </div>
        </div>
      )}

      {/* Abo-Plan */}
      {!isPaid && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
                <Star size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold">Restaurant System Pro</p>
                <p className="text-gray-400 text-xs">Alles inklusive — keine Einschränkungen</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-2xl">99,99 €</p>
              <p className="text-gray-500 text-xs">pro Monat · jederzeit kündbar</p>
            </div>
          </div>

          <div className="p-6 space-y-3">
            {[
              "Echtzeit-Dashboard & Statistiken",
              "Kassensystem-Anbindung (Webhook & Bridge)",
              "Team-Chat, Dienstplan & Buchhaltung",
              "KI-Agent für Auswertungen",
              "Unbegrenzte Mitarbeiter",
              "Support direkt vom Entwickler",
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-green-400 shrink-0" />
                <span className="text-gray-300 text-sm">{f}</span>
              </div>
            ))}
          </div>

          <div className="px-6 pb-6">
            <button onClick={subscribe} disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-lg transition-colors flex items-center justify-center gap-3">
              {loading
                ? <><RefreshCw size={20} className="animate-spin" /> Weiterleitung zu Stripe...</>
                : <><CreditCard size={20} /> Jetzt abonnieren — 99,99 €/Monat</>}
            </button>
            <div className="flex items-center justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Shield size={12} /> Sicher über Stripe
              </div>
              <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                <Zap size={12} /> Sofort aktiv nach Zahlung
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bereits bezahlt */}
      {isPaid && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-white font-semibold">Abo-Details</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Plan</span>
              <span className="text-white">Restaurant System Pro</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Preis</span>
              <span className="text-white">99,99 €/Monat</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <span className="text-green-400 font-medium">Aktiv</span>
            </div>
          </div>
          <p className="text-gray-500 text-xs border-t border-gray-800 pt-4">
            Um dein Abo zu kündigen oder zu verwalten, wende dich an den Support.
          </p>
        </div>
      )}
    </div>
  );
}
