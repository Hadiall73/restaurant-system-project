"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import {
  LifeBuoy, Send, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, Clock, MessageCircle, AlertCircle, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";

type Category = "general" | "bug" | "billing" | "feature";
type Status   = "open" | "in_progress" | "answered" | "closed";

interface Ticket {
  id:             string;
  subject:        string;
  message:        string;
  category:       Category;
  status:         Status;
  developer_reply: string | null;
  replied_at:     string | null;
  created_at:     string;
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "general",  label: "Allgemeine Frage" },
  { value: "bug",      label: "Fehler / Problem" },
  { value: "billing",  label: "Abrechnung / Abo" },
  { value: "feature",  label: "Funktionswunsch" },
];

const STATUS_META: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  open:        { label: "Offen",        color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", icon: Clock         },
  in_progress: { label: "In Bearbeitung", color: "text-blue-400 bg-blue-500/10 border-blue-500/30",   icon: RefreshCw     },
  answered:    { label: "Beantwortet",  color: "text-green-400 bg-green-500/10 border-green-500/30",  icon: CheckCircle   },
  closed:      { label: "Erledigt",     color: "text-gray-400 bg-gray-500/10 border-gray-500/30",     icon: XCircle       },
};

export default function Support() {
  const { profile, restaurant } = useStore();
  const [tickets,  setTickets]  = useState<Ticket[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [subject,  setSubject]  = useState("");
  const [message,  setMessage]  = useState("");
  const [category, setCategory] = useState<Category>("general");

  useEffect(() => {
    if (restaurant?.id) loadTickets();
  }, [restaurant?.id]);

  async function loadTickets() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/support?restaurant_id=${restaurant?.id}`);
      const json = await res.json();
      if (json.tickets) setTickets(json.tickets);
      else if (json.error) toast.error("Fehler: " + json.error);
    } catch {
      toast.error("Verbindungsfehler beim Laden");
    }
    setLoading(false);
  }

  async function submitTicket() {
    if (!subject.trim() || !message.trim()) {
      toast.error("Betreff und Nachricht ausfüllen");
      return;
    }
    if (!profile?.id || !restaurant?.id) {
      toast.error("Bitte warte kurz und versuche es erneut");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:       profile.id,
          restaurant_id: restaurant.id,
          subject, message, category,
        }),
      });
      const json = await res.json();
      if (json.ticket) {
        toast.success("Nachricht gesendet! Ich melde mich so schnell wie möglich.");
        setSubject(""); setMessage(""); setCategory("general");
        loadTickets();
      } else {
        toast.error("Fehler: " + (json.error || "Unbekannt"));
      }
    } catch {
      toast.error("Verbindungsfehler — bitte prüfe deine Internetverbindung");
    }
    setSending(false);
  }

  const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <LifeBuoy size={20} className="text-blue-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg">Support</h2>
          <p className="text-gray-400 text-xs">Direkt an den Entwickler — wir helfen dir schnell weiter</p>
        </div>
      </div>

      {/* Neue Nachricht */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <MessageCircle size={16} className="text-blue-400" /> Neue Nachricht
        </h3>

        {/* Kategorie */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {CATEGORIES.map(c => (
            <button key={c.value} onClick={() => setCategory(c.value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all border ${
                category === c.value
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
              }`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Betreff — z.B. Kassensystem verbindet sich nicht"
            maxLength={200}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Beschreibe dein Problem so genau wie möglich..."
            maxLength={2000}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-gray-500 text-xs">{message.length}/2000</p>
            <button onClick={submitTicket} disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
              {sending ? <><RefreshCw size={14} className="animate-spin" /> Sende...</> : <><Send size={14} /> Senden</>}
            </button>
          </div>
        </div>
      </div>

      {/* Nachrichten-Liste */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="font-semibold text-white flex items-center gap-2">
            Meine Nachrichten
            {openCount > 0 && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">{openCount} offen</span>
            )}
          </h3>
          <button onClick={loadTickets} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Lade...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle size={32} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Noch keine Nachrichten — alles läuft gut!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {tickets.map(t => {
              const meta = STATUS_META[t.status];
              const Icon = meta.icon;
              const isOpen = expanded === t.id;
              return (
                <div key={t.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800/30 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white text-sm font-medium truncate">{t.subject}</p>
                        {t.developer_reply && (
                          <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full shrink-0">Antwort</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.color}`}>
                          <Icon size={10} /> {meta.label}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {new Date(t.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Deine Nachricht */}
                      <div className="bg-gray-800/50 rounded-xl p-3">
                        <p className="text-gray-400 text-xs mb-1 font-medium">Deine Nachricht:</p>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{t.message}</p>
                      </div>
                      {/* Antwort vom Entwickler */}
                      {t.developer_reply && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                          <p className="text-blue-400 text-xs mb-1 font-medium flex items-center gap-1">
                            <CheckCircle size={11} /> Antwort vom Support:
                          </p>
                          <p className="text-gray-200 text-sm whitespace-pre-wrap">{t.developer_reply}</p>
                          {t.replied_at && (
                            <p className="text-gray-500 text-xs mt-2">
                              {new Date(t.replied_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
