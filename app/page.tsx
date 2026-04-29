"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { ChefHat } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { setProfile } = useStore();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push("/auth"); return; }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
      if (!profile) { router.push("/auth"); return; }
      setProfile(profile);
      if (profile.role === "developer") router.push("/developer");
      else if (profile.role === "chef") router.push("/chef");
      else router.push("/employee");
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30 animate-pulse">
          <ChefHat size={32} className="text-white" />
        </div>
        <p className="text-gray-400 text-sm">Laden...</p>
      </div>
    </div>
  );
}
