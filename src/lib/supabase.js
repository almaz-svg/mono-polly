import { createClient } from '@supabase/supabase-js';

const clean = str => (str || '').replace(/[^\x20-\x7E]/g, '').trim();

const rawUrl = clean(import.meta.env.VITE_SUPABASE_URL);
const rawKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

const FALLBACK_URL = 'https://xyzxyzxyz.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5enh5enh5eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MDAwMDAwMDB9.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const supabaseUrl = rawUrl.startsWith('https://') ? rawUrl : FALLBACK_URL;
const supabaseAnonKey = rawKey.startsWith('eyJ') ? rawKey : FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
