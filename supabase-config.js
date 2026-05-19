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
        
        // ✅ CHECK PLAN & TRIAL
        if (shop) {
            const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at) : null;
            const now = new Date();
            const trialExpired = trialEnd && trialEnd < now;
            const needsPayment = shop.payment_status !== 'approved' && trialExpired;
            
            // If on dashboard and trial expired without payment, redirect to pricing
            if (needsPayment && window.location.pathname.includes('dashboard')) {
                window.location.href = 'pricing.html';
                return null;
            }
        }
        
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
    setTheme(next);
};

window.setTheme = function(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeIcon(theme);
};

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-icon');
    icons.forEach(icon => {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
}

// Detect saved theme, system preference, or default to light
function getPreferredTheme() {
    // Check saved preference first
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    
    // Default
    return 'light';
}

// Apply theme on load
const theme = getPreferredTheme();
document.documentElement.setAttribute('data-theme', theme);

// Update icons after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    updateThemeIcon(theme);
});

console.log('✅ Supabase ready | Theme:', theme);
