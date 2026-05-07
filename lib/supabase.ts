import { createClient } from "@supabase/supabase-js";

const stripBOM = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1).trim() : s.trim();
const supabaseUrl = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co");
const supabaseAnonKey = stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder");

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.headers) {
    const clean: Record<string, string> = {};
    const entries = init.headers instanceof Headers
      ? Array.from(init.headers.entries())
      : Object.entries(init.headers as Record<string, string>);
    for (const [k, v] of entries) {
      // Remove BOM (0xFEFF) and any other non-ISO-8859-1 characters
      let cleaned = v;
      if (cleaned.charCodeAt(0) === 0xFEFF) cleaned = cleaned.slice(1);
      clean[k] = cleaned.replace(/[^\x00-\xFF]/g, "");
    }
    init = { ...init, headers: clean };
  }
  return fetch(input, init);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
  global: { fetch: safeFetch },
});

export type UserRole = "developer" | "chef" | "employee";

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  invite_code: string;
  license_key: string;
  owner_id: string;
  email?: string;
  is_active?: boolean;
  is_paid?: boolean;
  trial_ends_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_sub_id?: string | null;
  created_at?: string;
}

export interface RestaurantMember {
  id: string;
  restaurant_id: string;
  user_id: string;
  role: string;
  hourly_wage: number;
  position: string;
  profiles?: Profile;
}

export interface Sale {
  id: string;
  restaurant_id: string;
  amount: number;
  tip: number;
  payment_method: string;
  table_number?: number;
  recorded_at: string;
}

export interface Shift {
  id: string;
  restaurant_id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  actual_start?: string;
  actual_end?: string;
  is_clocked_in: boolean;
  hourly_wage: number;
  profiles?: Profile;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string;
  price: number;
}

export interface DishOrder {
  id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  menu_items?: MenuItem;
}

export interface Availability {
  id: string;
  restaurant_id: string;
  user_id: string;
  week_start: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  monday_note?: string;
  tuesday_note?: string;
  wednesday_note?: string;
  thursday_note?: string;
  friday_note?: string;
  saturday_note?: string;
  sunday_note?: string;
}

export interface Expense {
  id: string;
  restaurant_id: string;
  category: string;
  amount_net: number;
  amount_gross: number;
  vat_rate: number;
  vat_amount: number;
  supplier?: string;
  description?: string;
  invoice_date?: string;
}

export interface BookkeepingEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  entry_date: string;
}
