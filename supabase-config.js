// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_laufif_03Bc66pEPcwPt-w_vboiTaN5';

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Make it globally available
window.supabase = supabase;

console.log('✅ Supabase ready');
