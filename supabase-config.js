// supabase-config.js
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_laufif_03Bc66pEPcwPt-w_vboiTaN5';

// Make it global so all pages can use it
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase ready');
