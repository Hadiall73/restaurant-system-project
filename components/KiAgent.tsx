"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Trash2, Mic, MicOff, Volume2, VolumeX, Code } from "lucide-react";
import { useStore } from "@/lib/store";

interface Nachricht {
  rolle: "user" | "agent";
  text: string;
}

const BEISPIELE = [
  "Wie läuft das Geschäft heute? Fr fr",
  "Welche Artikel müssen bestellt werden?",
  "Schreib mir ein Python Script für meine Umsatzdaten",
  "Wie hoch sind meine Lohnkosten?",
  "Gib mir Tipps um mehr Umsatz zu machen",
  "Was war mein bester Tag diese Woche?",
];

export default function KiAgent() {
  const { restaurant } = useStore();
  const [nachrichten, setNachrichten] = useState<Nachricht[]>([
    {
      rolle: "agent",
      text: "Yo! Ich bin MAX 🤖⚡\n\nDein KI-Homie für alles rund ums Restaurant — no cap.\n\nIch kann:\n• 📊 Deine Zahlen analysieren (fr fr Echtzeit)\n• 💻 Code schreiben (Python, SQL, JS, whatever)\n• 🎤 Mit dir reden (Mikro-Button unten links)\n• 😂 Jokes machen während ich arbeite\n• 🍽️ Dein Restaurant rocken\n\nWas geht ab? Frag mich alles! 🔥",
    },
  ]);
  const [eingabe, setEingabe] = useState("");
  const [laden, setLaden] = useState(false);
  const [hoeren, setHoeren] = useState(false);
  const [sprechen, setSprechen] = useState(true);
  const [sprichtGerade, setSprichtGerade] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [nachrichten]);

  // Spracherkennung initialisieren
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "de-DE";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setHoeren(false);
      senden(text);
    };
    r.onerror = () => setHoeren(false);
    r.onend = () => setHoeren(false);
    recognitionRef.current = r;
  }, []);

  function toggleMic() {
    if (!recognitionRef.current) {
      alert("Spracherkennung wird von deinem Browser nicht unterstützt. Bitte Chrome oder Edge nutzen.");
      return;
    }
    if (hoeren) {
      recognitionRef.current.stop();
      setHoeren(false);
    } else {
      recognitionRef.current.start();
      setHoeren(true);
    }
  }

  function sprich(text: string) {
    if (!sprechen || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    // Code-Blöcke überspringen beim Vorlesen
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "... Code-Block ... ")
      .replace(/`[^`]*`/g, "")
      .replace(/[#*_]/g, "")
      .slice(0, 500);
    const u = new SpeechSynthesisUtterance(cleanText);
    u.lang = "de-DE";
    u.rate = 1.05;
    u.pitch = 1;
    u.onstart = () => setSprichtGerade(true);
    u.onend = () => setSprichtGerade(false);
    u.onerror = () => setSprichtGerade(false);
    window.speechSynthesis.speak(u);
  }

  function stopSprechen() {
    window.speechSynthesis.cancel();
    setSprichtGerade(false);
  }

  async function senden(text?: string) {
    const frage = text || eingabe.trim();
    if (!frage || laden) return;

    const neueNachricht: Nachricht = { rolle: "user", text: frage };
    setEingabe("");
    setNachrichten(prev => [...prev, neueNachricht]);
    setLaden(true);

    try {
      const verlauf = [...nachrichten.slice(1), neueNachricht];
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nachricht: frage,
          restaurant_id: restaurant?.id,
          verlauf,
        }),
      });
      const data = await res.json();
      const antwort = data.antwort || "No response, lowkey weird 💀";
      setNachrichten(prev => [...prev, { rolle: "agent", text: antwort }]);
      sprich(antwort);
    } catch {
      const fehler = "Bro ich hab kurz keinen Signal 😭 Versuch's nochmal!";
      setNachrichten(prev => [...prev, { rolle: "agent", text: fehler }]);
    } finally {
      setLaden(false);
    }
  }

  function chatLeeren() {
    window.speechSynthesis.cancel();
    setSprichtGerade(false);
    setNachrichten([{
      rolle: "agent",
      text: "Yo! Ich bin MAX 🤖⚡\n\nDein KI-Homie für alles rund ums Restaurant — no cap.\n\nIch kann:\n• 📊 Deine Zahlen analysieren (fr fr Echtzeit)\n• 💻 Code schreiben (Python, SQL, JS, whatever)\n• 🎤 Mit dir reden (Mikro-Button unten links)\n• 😂 Jokes machen während ich arbeite\n• 🍽️ Dein Restaurant rocken\n\nWas geht ab? Frag mich alles! 🔥",
    }]);
  }

  // Code-Blöcke farbig darstellen
  function renderText(text: string) {
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0].trim();
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className="my-2 rounded-xl overflow-hidden border border-gray-700">
            <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 border-b border-gray-700">
              <Code size={12} className="text-orange-400" />
              <span className="text-orange-400 text-xs font-mono">{lang || "code"}</span>
            </div>
            <pre className="bg-gray-950 px-4 py-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">{code}</pre>
          </div>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={i} className="bg-gray-700 text-orange-300 px-1 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            KI Agent <span className="text-orange-400">MAX</span>
            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Gen Z Mode 🔥</span>
          </h2>
          <p className="text-gray-400 text-sm mt-1">Dein Jarvis — sprich mit ihm oder tippe</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stimme an/aus */}
          <button onClick={() => { setSprechen(!sprechen); stopSprechen(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${sprechen ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
            {sprechen ? <Volume2 size={13} /> : <VolumeX size={13} />}
            {sprechen ? "Stimme an" : "Stimme aus"}
          </button>
          {nachrichten.length > 1 && (
            <button onClick={chatLeeren} className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs px-3 py-1.5 rounded-xl hover:bg-gray-800 transition-colors border border-gray-700">
              <Trash2 size={12} /> Leeren
            </button>
          )}
        </div>
      </div>

      {/* Beispiele */}
      <div className="flex flex-wrap gap-2">
        {BEISPIELE.map(b => (
          <button key={b} onClick={() => senden(b)} disabled={laden}
            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 px-3 py-1.5 rounded-full transition-colors border border-gray-700 hover:border-orange-500/50">
            {b}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden" style={{ minHeight: "450px" }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {nachrichten.map((n, i) => (
            <div key={i} className={`flex gap-3 ${n.rolle === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs ${n.rolle === "agent" ? "bg-orange-500" : "bg-gray-600"}`}>
                {n.rolle === "agent" ? "M" : <User size={14} />}
              </div>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                n.rolle === "agent"
                  ? "bg-gray-800 text-gray-100 rounded-tl-sm"
                  : "bg-orange-500 text-white rounded-tr-sm"
              }`}>
                {n.rolle === "agent" ? renderText(n.text) : <span className="whitespace-pre-wrap">{n.text}</span>}
              </div>
            </div>
          ))}

          {laden && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center font-bold text-white text-xs">M</div>
              <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 size={14} className="text-orange-400 animate-spin" />
                <span className="text-gray-400 text-sm">MAX ist am denken... 🧠</span>
              </div>
            </div>
          )}

          {sprichtGerade && (
            <div className="flex items-center gap-2 text-blue-400 text-xs pl-11">
              <Volume2 size={12} className="animate-pulse" />
              <span>MAX spricht...</span>
              <button onClick={stopSprechen} className="text-gray-500 hover:text-white underline">stoppen</button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Eingabe */}
        <div className="border-t border-gray-800 p-4">
          {hoeren && (
            <div className="flex items-center gap-2 text-red-400 text-xs mb-2 animate-pulse">
              <Mic size={12} />
              <span>Ich höre dich... sprich jetzt!</span>
            </div>
          )}
          <div className="flex gap-2">
            {/* Mikro */}
            <button onClick={toggleMic}
              className={`p-2.5 rounded-xl text-white transition-colors shrink-0 ${hoeren ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white"}`}>
              {hoeren ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <textarea
              value={eingabe}
              onChange={e => setEingabe(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); senden(); } }}
              placeholder={hoeren ? "🎤 Ich höre dich..." : "Frag MAX alles... Code, Zahlen, Jokes 🔥"}
              rows={1}
              disabled={laden || hoeren}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors resize-none disabled:opacity-50"
              style={{ maxHeight: "120px" }}
            />

            <button onClick={() => senden()} disabled={!eingabe.trim() || laden}
              className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition-colors shrink-0">
              <Send size={18} />
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-1.5 pl-1">🎤 Mikro · Enter senden · Shift+Enter neue Zeile · Stimme {sprechen ? "an" : "aus"}</p>
        </div>
      </div>
    </div>
  );
}
