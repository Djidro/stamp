// ============================================
// SUPABASE CONFIG
// ============================================
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZXdhbnNoZWt6cGpmZ3R5eXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjAwMjgsImV4cCI6MjA5NDM5NjAyOH0.AGd2ciUMPt1w4UqHpinJNQni08r0GPP-5-R7z_fvPn4';

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
