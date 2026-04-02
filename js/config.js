// ============================================================
// SUPABASE CLIENT
// ============================================================
// In production these placeholders are replaced by inject-env.js at build time.
// For local dev, run `netlify dev` with a .env file containing SUPABASE_URL and SUPABASE_ANON_KEY.
const SUPABASE_URL      = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
