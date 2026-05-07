# 🤖 AI Collaboration Guide: Restaurant & POS Systems
This document serves as the bridge between the cloud architect (DEER) and the local AI assistant (Ollama/Llama3.2).

## 🎯 Project Goal
Establish a secure, stable, and offline-first development environment for the Kassensystem and Restaurantsystem.

## 🛠️ Technical Architecture
### 1. Database & Security (Supabase)
- **RLS (Row Level Security):** ENABLED on all tables. 
- **Auth:** User roles are strictly enforced (`chef`, `employee`, `developer`).
- **Security Rule:** NEVER disable RLS. Use service-role keys only in server-side logic.

### 2. Offline-First Strategy (The "RobustSync" Logic)
Both projects use a local-first approach to prevent data loss during internet outages.
- **Kassensystem:** Uses a simple queue in `localStorage` for orders.
- **Restaurantsystem:** Uses `RobustSync` (in `lib/supabase.ts`) for complex data (Inventory, Shifts, Expenses).
- **Logic:** Data is saved to `localStorage` (prefix `rs_sync_`) $\rightarrow$ Sync trigger on `window.addEventListener('online')` $\rightarrow$ `upsert` into Supabase.

## 📂 Project Structure
- **Kassensystem:** `C:\Users\bib\kassensystem`
- **Restaurantsystem:** `C:\Users\bib\Desktop\restaurant-system`
- **Core Logic:** Always check `lib/supabase.ts` before implementing new data flows.

## 📝 Instructions for Local AI
When helping the user with these projects:
1. **Read First:** Always check the existing `lib/supabase.ts` to understand the sync logic.
2. **Maintain Consistency:** If adding new features, ensure they integrate with the `RobustSync` utility.
3. **Safety First:** Do not suggest removing RLS or bypassing security policies.
4. **Strategic Check:** For major architectural changes (e.g., changing the database schema), advise the user to consult **DEER** first.
5. **Code Style:** Maintain the existing Tailwind CSS / Next.js App Router pattern.

## 🔄 Sync Cycle
Cloud AI (DEER) $\rightarrow$ Updates this guide $\rightarrow$ Local AI (Llama3.2) reads guide $\rightarrow$ Executes micro-tasks $\rightarrow$ User reports results back to DEER.
