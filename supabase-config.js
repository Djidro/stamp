// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_laufif_03Bc66pEPcwPt-w_vboiTaN5';

// Initialize Supabase globally
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// GLOBAL AUTH HELPERS
// ============================================
window.getCurrentShop = async function() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return null;
        
        const { data: shop, error } = await window.supabase
            .from('shops')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (error) throw error;
        return shop;
    } catch (err) {
        console.error('getCurrentShop error:', err);
        return null;
    }
};

window.logout = async function() {
    await window.supabase.auth.signOut();
    window.location.href = 'login.html';
};

// ============================================
// THEME / DARK MODE
// ============================================
window.toggleDarkMode = function() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

console.log('✅ Supabase ready');
