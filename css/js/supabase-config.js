// ============================================
// SUPABASE CONFIG - YOUR CREDENTIALS
// ============================================
const SUPABASE_URL = 'https://ooewanshekzpjfgtyyzx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_laufif_03Bc66pEPcwPt-w_vboiTaN5';

// ============================================
// SAFE INITIALIZATION
// ============================================
let supabase;

if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase loaded');
} else {
    console.error('❌ Supabase CDN failed. Check internet connection.');
    alert('Error: Could not load Supabase. Please check your internet connection and reload.');
    // Dummy object to prevent total crash
    supabase = {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null } }),
            signUp: () => Promise.resolve({ error: { message: 'Supabase not loaded' } }),
            signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase not loaded' } }),
            signOut: () => Promise.resolve({})
        },
        from: () => ({
            select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
            insert: () => Promise.resolve({ error: { message: 'Supabase not loaded' } }),
            update: () => Promise.resolve({ error: { message: 'Supabase not loaded' } }),
            delete: () => Promise.resolve({ error: { message: 'Supabase not loaded' } })
        })
    };
}

// ============================================
// AUTH HELPERS
// ============================================
async function getCurrentShop() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        
        const { data: shop, error } = await supabase
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
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// ============================================
// THEME / DARK MODE
// ============================================
function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
