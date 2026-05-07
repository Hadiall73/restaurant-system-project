"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import {
  Send, Paperclip, Trash2, Download, Play, Pause,
  ImageIcon, Film, Mic, FileText, ShieldCheck, X, Loader2
} from "lucide-react";
import toast from "react-hot-toast";

type MsgType = "text" | "image" | "video" | "audio" | "file";

type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  type: MsgType;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  profiles?: { name: string; role: string };
};

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileType(file: File): MsgType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

function AudioPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2 min-w-48">
      <audio ref={audioRef} src={url}
        onTimeUpdate={() => setProgress((audioRef.current!.currentTime / audioRef.current!.duration) * 100 || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }} />
      <button onClick={toggle} className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
        {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <Mic size={12} className="text-white/50 shrink-0" />
    </div>
  );
}

export default function Chat({ isChef = false }: { isChef?: boolean }) {
  const { restaurant, profile } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!restaurant) return;
    loadMessages();

    // Polling alle 4 Sekunden (Realtime wird durch RLS blockiert)
    const poll = setInterval(loadMessages, 4000);
    return () => clearInterval(poll);
  }, [restaurant?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    if (!restaurant) return;
    try {
      const res = await fetch(`/api/chat?restaurant_id=${restaurant.id}`);
      const json = await res.json();
      if (json.missing_table) {
        toast("Tabelle 'messages' fehlt – SQL im README", { icon: "⚠️" });
        return;
      }
      if (!res.ok) return;
      if (json.messages) setMessages(json.messages as Message[]);
    } catch {
      // Netzwerkfehler still ignorieren (Polling läuft weiter)
    }
  }

  async function sendText() {
    if (!text.trim() || !restaurant || !profile) return;
    setSending(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurant_id: restaurant.id, sender_id: profile.id, content: text.trim(), type: "text" }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.error === "MISSING_TABLE") toast.error("Tabelle 'messages' fehlt – bitte in Supabase anlegen");
      else toast.error(`Fehler beim Senden: ${json.error || res.status}`);
    } else {
      setText("");
      if (json.message) setMessages(prev => [...prev, json.message as Message]);
    }
    setSending(false);
  }

  async function uploadFile(file: File) {
    if (!restaurant || !profile) return;
    if (file.size > 50 * 1024 * 1024) { toast.error("Datei max. 50 MB"); return; }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path);
      const type = getFileType(file);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurant.id, sender_id: profile.id, type, file_url: publicUrl, file_name: file.name, file_size: file.size }),
      });
      if (!res.ok) throw new Error("insert failed");
    } catch {
      toast.error("Upload fehlgeschlagen");
    }
    setUploading(false);
  }

  async function deleteMessage(id: string) {
    const res = await fetch(`/api/chat?id=${id}&sender_id=${profile?.id}&is_chef=${isChef}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Fehler beim Löschen");
    } else {
      setMessages(prev => prev.filter(m => m.id !== id));
    }
  }

  function renderMedia(msg: Message) {
    if (msg.type === "image" && msg.file_url) return (
      <img src={msg.file_url} alt={msg.file_name || "Bild"}
        onClick={() => setPreview(msg.file_url!)}
        className="max-w-xs max-h-64 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity" />
    );
    if (msg.type === "video" && msg.file_url) return (
      <video src={msg.file_url} controls className="max-w-xs max-h-64 rounded-xl" />
    );
    if (msg.type === "audio" && msg.file_url) return (
      <AudioPlayer url={msg.file_url} />
    );
    if (msg.type === "file" && msg.file_url) return (
      <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2.5 hover:bg-black/30 transition-colors">
        <FileText size={20} className="text-white/70 shrink-0" />
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate max-w-48">{msg.file_name}</p>
          {msg.file_size && <p className="text-white/50 text-xs">{formatSize(msg.file_size)}</p>}
        </div>
        <Download size={14} className="text-white/50 shrink-0" />
      </a>
    );
    return null;
  }

  const isMine = (msg: Message) => msg.sender_id === profile?.id;
  const canDelete = (msg: Message) => isMine(msg) || isChef;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 lg:px-6 py-3 border-b border-gray-800 flex items-center gap-3 shrink-0">
        <h2 className="text-white font-bold flex items-center gap-2">
          Team Chat
          {isChef && <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={11} /> Admin</span>}
        </h2>
        <p className="text-gray-500 text-xs ml-auto">
          {isChef ? "Alle Nachrichten · als Admin löschen" : "Chat mit deinem Team"}
        </p>
      </div>

      {/* Nachrichten */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16 text-gray-600">
              <p className="text-lg">Noch keine Nachrichten</p>
              <p className="text-sm mt-1">Schreibe die erste Nachricht!</p>
            </div>
          )}

          {messages.map(msg => {
            const mine = isMine(msg);
            const isChefMsg = msg.profiles?.role === "chef" || msg.profiles?.role === "developer";
            return (
              <div key={msg.id} className={`flex gap-2 group ${mine ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 self-end
                  ${isChefMsg ? "bg-orange-500 text-white" : "bg-gray-700 text-gray-300"}`}>
                  {msg.profiles?.name?.charAt(0) || "?"}
                </div>

                <div className={`flex flex-col max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                  {/* Name + Rolle */}
                  <div className={`flex items-center gap-1.5 mb-1 ${mine ? "flex-row-reverse" : ""}`}>
                    <span className="text-gray-400 text-xs">{mine ? "Du" : msg.profiles?.name}</span>
                    {isChefMsg && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <ShieldCheck size={9} /> Chef
                      </span>
                    )}
                    <span className="text-gray-600 text-xs">
                      {new Date(msg.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* Nachricht */}
                  <div className={`relative rounded-2xl px-4 py-2.5 ${
                    mine
                      ? "bg-orange-500 text-white rounded-tr-sm"
                      : isChefMsg
                        ? "bg-orange-500/15 border border-orange-500/30 text-gray-100 rounded-tl-sm"
                        : "bg-gray-800 text-gray-100 rounded-tl-sm"
                  }`}>
                    {msg.type === "text" && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                    {renderMedia(msg)}

                    {/* Löschen */}
                    {canDelete(msg) && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className={`absolute -top-2 ${mine ? "-left-2" : "-right-2"} w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex transition-all`}>
                        <X size={10} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Eingabe */}
        <div className="border-t border-gray-800 p-3">
          <div className="flex items-end gap-2">
            {/* Datei-Upload */}
            <input ref={fileRef} type="file" className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50 shrink-0">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>

            {/* Text */}
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              placeholder="Nachricht schreiben... (Enter zum Senden)"
              rows={1}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
              style={{ maxHeight: "120px" }}
            />

            <button onClick={sendText} disabled={!text.trim() || sending}
              className="p-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white transition-colors shrink-0">
              <Send size={18} />
            </button>
          </div>

          {/* Upload Hinweis */}
          <p className="text-gray-600 text-xs mt-1.5 pl-1">
            📎 Bilder, Videos, Audio & Dateien bis 50 MB · Shift+Enter für neue Zeile
          </p>
        </div>
      </div>

      {/* Bild-Vollbild */}
      {preview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button onClick={() => setPreview(null)} className="absolute top-4 right-4 text-white p-2 rounded-xl bg-gray-800 hover:bg-gray-700">
            <X size={20} />
          </button>
          <img src={preview} alt="Vorschau" className="max-w-full max-h-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
