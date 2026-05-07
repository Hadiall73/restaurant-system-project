"use client";
import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

export default function ValidPage() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-green-500 flex flex-col items-center justify-center select-none"
      style={{ background: "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)" }}>

      {/* Pulsierender Ring */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute w-56 h-56 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "1.5s" }} />
        <div className="absolute w-44 h-44 rounded-full bg-white/15" />
        <div className="w-36 h-36 rounded-full bg-white/20 flex items-center justify-center">
          <CheckCircle size={80} className="text-white drop-shadow-2xl" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="text-white font-black text-6xl tracking-tight mb-2 drop-shadow-lg">GÜLTIG</h1>
      <p className="text-green-100 text-xl font-medium mb-1">✓ Zugang gewährt</p>
      <p className="text-green-200/70 text-sm font-mono mt-2">{time}</p>

      {/* Grüner Balken unten — für Lesegeräte die Balken erwarten */}
      <div className="fixed bottom-0 left-0 right-0 h-3 bg-white/20" />
    </div>
  );
}
