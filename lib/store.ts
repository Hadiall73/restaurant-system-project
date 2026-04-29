import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Profile, Restaurant, RestaurantMember } from "./supabase";

interface AppState {
  profile: Profile | null;
  restaurant: Restaurant | null;
  members: RestaurantMember[];
  setProfile: (p: Profile | null) => void;
  setRestaurant: (r: Restaurant | null) => void;
  setMembers: (m: RestaurantMember[]) => void;
  clear: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      restaurant: null,
      members: [],
      setProfile: (profile) => set({ profile }),
      setRestaurant: (restaurant) => set({ restaurant }),
      setMembers: (members) => set({ members }),
      clear: () => set({ profile: null, restaurant: null, members: [] }),
    }),
    { name: "restaurant-app" }
  )
);
