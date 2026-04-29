"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Nachricht {
  rolle: "user" | "agent";
  text: string;
}

const BEISPIELE = [
  "Was war mein bester Tag diese Woche?",
  "Welche Artikel müssen bestellt werden?",
  "Erstell den Dienstplan für nächste Woche",
  "Wie hoch ist meine Gewinnmarge?",
  "Wann muss ich die Umsatzsteuer zahlen?",
];

export default function KiAgent() {
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([
    {
      rolle: "agent",
      text: "Hallo! Ich bin dein Restaurant-KI-Assistent. Ich habe Zugriff auf deine Umsätze, Lagerbestände, Mitarbeiter und Steuerdaten. Was kann ich für dich tun?",
    },
  ]);
  const [eingabe, setEingabe] = useState("");
  const [laden, setLaden] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nachrichten]);

  async function senden(text?: string) {
    const frage = text || eingabe.trim();
    if (!frage || laden) return;

    setEingabe("");
    setNachrichten((prev) => [...prev, { rolle: "user", text: frage }]);
    setLaden(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nachricht: frage }),
      });
      const data = await res.json();
      setNachrichten((prev) => [...prev, { rolle: "agent", text: data.antwort }]);
    } catch {
      setNachrichten((prev) => [...prev, { rolle: "agent", text: "Fehler beim Verbinden. Bitte API Key in .env.local eintragen." }]);
    } finally {
      setLaden(false);
    }
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-white">KI Agent</h2>
        <p className="text-gray-400 text-sm mt-1">Dein persönlicher Restaurant-Assistent</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BEISPIELE.map((b) => (
          <button
            key={b}
            onClick={() => senden(b)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full transition-colors border border-gray-700"
          >
            {b}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden" style={{ minHeight: "400px" }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {nachrichten.map((n, i) => (
            <div key={i} className={`flex gap-3 ${n.rolle === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.rolle === "agent" ? "bg-orange-500" : "bg-gray-700"}`}>
                {n.rolle === "agent" ? <Bot size={16} className="text-white" /> : <User size={16} className="text-white" />}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                n.rolle === "agent"
                  ? "bg-gray-800 text-gray-100 rounded-tl-sm"
                  : "bg-orange-500 text-white rounded-tr-sm"
              }`}>
                {n.text}
              </div>
            </div>
          ))}
          {laden && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 size={14} className="text-gray-400 animate-spin" />
                <span className="text-gray-400 text-sm">Analysiere Daten...</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-gray-800 p-4">
          <div className="flex gap-3">
            <input
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && senden()}
              placeholder="Frag mich etwas über dein Restaurant..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <button
              onClick={() => senden()}
              disabled={!eingabe.trim() || laden}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
