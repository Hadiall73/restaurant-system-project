"use client";
import { useState } from "react";
import {
  LayoutDashboard, TrendingUp, Users, ShoppingCart,
  FileText, MessageSquare, ChefHat, Menu, X, Receipt
} from "lucide-react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "finanzen", label: "Finanzen", icon: TrendingUp },
  { id: "mitarbeiter", label: "Dienstplan", icon: Users },
  { id: "lager", label: "Wareneinkauf", icon: ShoppingCart },
  { id: "rechnungen", label: "Rechnungen", icon: Receipt },
  { id: "steuer", label: "Steuer", icon: FileText },
  { id: "agent", label: "KI Agent", icon: MessageSquare },
];

interface SidebarProps {
  aktiv: string;
  setAktiv: (id: string) => void;
}

export default function Sidebar({ aktiv, setAktiv }: SidebarProps) {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOffen(!offen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-gray-800 p-2 rounded-lg"
      >
        {offen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-40
        transform transition-transform duration-200
        ${offen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:block
      `}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2 rounded-xl">
              <ChefHat size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">Restaurant</h1>
              <p className="text-gray-400 text-xs">Manager Pro</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isAktiv = aktiv === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setAktiv(item.id); setOffen(false); }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${isAktiv
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
                {item.id === "agent" && (
                  <span className="ml-auto bg-orange-400 text-xs px-1.5 py-0.5 rounded-full text-white">KI</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-xs font-bold">C</div>
            <div>
              <p className="text-sm font-medium text-white">Chef</p>
              <p className="text-xs text-gray-400">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {offen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOffen(false)} />
      )}
    </>
  );
}
