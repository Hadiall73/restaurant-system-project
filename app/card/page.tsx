"use client";
import QRCode from "react-qr-code";

const URL = "https://restaurant-system-murex.vercel.app/valid";

export default function CardPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 gap-8">

      {/* Karte */}
      <div className="w-80 rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)" }}>

        {/* Oben */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div>
            <p className="text-indigo-300 text-xs font-semibold tracking-widest uppercase">Zutrittskarte</p>
            <p className="text-white font-black text-lg mt-0.5">Max Mustermann</p>
            <p className="text-indigo-300 text-sm">Mitglied</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
            <span className="text-3xl">🪪</span>
          </div>
        </div>

        {/* QR Code */}
        <div className="mx-6 mb-4 bg-white rounded-2xl p-4 flex items-center justify-center">
          <QRCode value={URL} size={180} level="H" />
        </div>

        {/* Unten */}
        <div className="px-6 pb-6 flex items-center justify-between">
          <div>
            <p className="text-indigo-400 text-xs">Gültig bis</p>
            <p className="text-white text-sm font-bold">31.12.2026</p>
          </div>
          <div className="flex gap-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < 5 ? "bg-indigo-400" : "bg-indigo-800"}`} />
            ))}
          </div>
          <div className="text-right">
            <p className="text-indigo-400 text-xs">ID</p>
            <p className="text-white text-sm font-mono font-bold">#A4F2</p>
          </div>
        </div>
      </div>

      <p className="text-gray-600 text-xs text-center">QR scannen → immer grün ✓</p>
    </div>
  );
}
