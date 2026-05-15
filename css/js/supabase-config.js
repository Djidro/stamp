// ✅ YOUR SUPABASE CREDENTIALS - DO NOT SHARE PUBLICLY
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_laufif_03Bc66pEPcwPt-w_vboiTaN5';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth state helper
async function getCurrentShop() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    
    const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('id', session.user.id)
        .single();
    
    return shop;
}

// Logout helper
async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// Dark mode
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

// Init theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
