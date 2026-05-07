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

/**
 * ROBUST SYNC UTILITY (Restaurant System)
 * Implements a local-first sync strategy for complex restaurant data.
 */
export const RobustSync = {
  STORAGE_PREFIX: 'rs_sync_',

  // Generic method to save data locally when offline
  async saveLocally(table: string, data: any) {
    const key = `${this.STORAGE_PREFIX}${table}`;
    const existing = this.getLocalData(table);
    
    // We store a timestamp to implement Last-Write-Wins
    const entry = {
      ...data,
      _sync_timestamp: new Date().toISOString(),
      _synced: false
    };

    existing.push(entry);
    localStorage.setItem(key, JSON.stringify(existing));
    console.log(`[RobustSync] Saved ${table} entry locally.`);
  },

  getLocalData(table: string) {
    const data = localStorage.getItem(`${this.STORAGE_PREFIX}${table}`);
    return data ? JSON.parse(data) : [];
  },

  // Sync specific table to Supabase
  async syncTable(table: string, supabaseTable: string) {
    if (!navigator.onLine) return;

    const queue = this.getLocalData(table);
    if (queue.length === 0) return;

    console.log(`[RobustSync] Syncing ${queue.length} items for ${table}...`);

    const results = await Promise.all(
      queue.map(async (item) => {
        try {
          const { data, error } = await supabase
            .from(supabaseTable)
            .upsert(item, { onConflict: 'id' });
          
          if (error) throw error;
          return { id: item.id, success: true };
        } catch (e) {
          return { id: item.id, success: false, error: e };
        }
      })
    );

    const remaining = queue.filter((_, index) => !results[index].success);
    localStorage.setItem(`${this.STORAGE_PREFIX}${table}`, JSON.stringify(remaining));
    console.log(`[RobustSync] ${table} sync complete. ${queue.length - remaining.length} updated.`);
  },

  // Global sync for all restaurant modules
  async syncAll() {
    const modules = [
      { local: 'sales', remote: 'sales' },
      { local: 'shifts', remote: 'shifts' },
      { local: 'expenses', remote: 'expenses' },
      { local: 'menu', remote: 'menu_items' },
      { local: 'inventory', remote: 'inventory' },
    ];

    for (const mod of modules) {
      await this.syncTable(mod.local, mod.remote);
    }
  },

  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncAll());
    }
  }
};

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
  submitted_at: string;
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
  receipt_url?: string;
  recorded_by?: string;
  recorded_at: string;
}

export interface BookkeepingEntry {
  id: string;
  type: string;
  amount: number;
  description: string;
  entry_date: string;
}
