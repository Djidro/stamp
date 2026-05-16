// Make functions global for HTML onclick
window.manualLookup = manualLookup;
window.startScanner = startScanner;
window.stopScanner = stopScanner;
// Add any other functions used in onclick
let html5QrCode = null;
let currentCustomer = null;
let shopSettings = { stamps_required: 6 };

supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    initScanner();
});

async function initScanner() {
    try {
        const shop = await getCurrentShop();
        if (shop?.settings) shopSettings = shop.settings;
        
        html5QrCode = new Html5Qrcode("reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        );
    } catch (err) {
        console.error("Scanner init error:", err);
        showToast("Camera not available. Use manual entry below.");
    }
}

function onScanSuccess(decodedText) {
    try {
        const data = JSON.parse(decodedText);
        if (data.customer && data.shop) {
            loadCustomer(data.customer, data.shop);
        } else {
            showToast('Invalid QR format');
        }
    } catch (e) {
        // Try as plain text code
        manualLookup(decodedText);
    }
}

function onScanFailure(error) {
    // Silently ignore continuous scan failures
}

async function loadCustomer(customerId, shopId) {
    try {
        const shop = await getCurrentShop();
        if (!shop || shop.id !== shopId) {
            showToast('Invalid QR: Not your customer');
            return;
        }
        
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .single();
        
        if (error || !customer) {
            showToast('Customer not found');
            return;
        }
        
        currentCustomer = customer;
        displayCustomer();
        
        if (html5QrCode) html5QrCode.pause();
    } catch (err) {
        showToast(err.message);
    }
}

function displayCustomer() {
    if (!currentCustomer) return;
    
    const result = document.getElementById('scanResult');
    if (result) result.classList.remove('hidden');
    
    const nameEl = document.getElementById('scannedName');
    if (nameEl) nameEl.textContent = currentCustomer.name;
    
    const currentStamps = document.getElementById('currentStamps');
    const requiredStamps = document.getElementById('requiredStamps');
    if (currentStamps) currentStamps.textContent = currentCustomer.stamps;
    if (requiredStamps) requiredStamps.textContent = shopSettings.stamps_required || 6;
    
    const visual = document.getElementById('stampVisual');
    const required = shopSettings.stamps_required || 6;
    if (visual) {
        visual.innerHTML = Array.from({length: required}, (_, i) => 
            `<span style="opacity: ${i < currentCustomer.stamps ? '1' : '0.3'}">☕</span>`
        ).join('');
    }
    
    const badge = document.getElementById('rewardBadge');
    const redeemBtn = document.getElementById('redeemBtn');
    const hasReward = currentCustomer.free_rewards > 0 || currentCustomer.stamps >= required;
    
    if (badge) badge.classList.toggle('hidden', !hasReward);
    if (redeemBtn) redeemBtn.disabled = !hasReward;
}

async function addStamp() {
    if (!currentCustomer) return;
    
    const required = shopSettings.stamps_required || 6;
    let newStamps = currentCustomer.stamps + 1;
    let newRewards = currentCustomer.free_rewards;
    
    if (newStamps >= required) {
        newStamps = 0;
        newRewards += 1;
    }
    
    try {
        const { error } = await supabase
            .from('customers')
            .update({ 
                stamps: newStamps, 
                free_rewards: newRewards,
                total_visits: (currentCustomer.total_visits || 0) + 1
            })
            .eq('id', currentCustomer.id);
        
        if (error) throw error;
        
        await supabase.from('visits').insert({
            shop_id: currentCustomer.shop_id,
            customer_id: currentCustomer.id,
            action: 'stamp'
        });
        
        showToast(`Stamp added! ${newStamps}/${required}`, 'success');
        
        // Refresh
        const { data: updated } = await supabase
            .from('customers')
            .select('*')
            .eq('id', currentCustomer.id)
            .single();
        
        if (updated) {
            currentCustomer = updated;
            displayCustomer();
        }
    } catch (err) {
        showToast(err.message);
    }
}

async function redeemReward() {
    if (!currentCustomer || currentCustomer.free_rewards < 1) {
        showToast('No rewards available');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('customers')
            .update({ free_rewards: currentCustomer.free_rewards - 1 })
            .eq('id', currentCustomer.id);
        
        if (error) throw error;
        
        await supabase.from('visits').insert({
            shop_id: currentCustomer.shop_id,
            customer_id: currentCustomer.id,
            action: 'redeem',
            notes: 'Reward redeemed'
        });
        
        showToast('Reward redeemed! 🎁', 'success');
        
        const { data: updated } = await supabase
            .from('customers')
            .select('*')
            .eq('id', currentCustomer.id)
            .single();
        
        if (updated) {
            currentCustomer = updated;
            displayCustomer();
        }
    } catch (err) {
        showToast(err.message);
    }
}

async function manualLookup(code) {
    try {
        const shop = await getCurrentShop();
        const lookupCode = code || document.getElementById('manualCode')?.value;
        
        if (!lookupCode) {
            showToast('Enter a customer code');
            return;
        }
        
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('shop_id', shop.id)
            .eq('customer_code', lookupCode)
            .single();
        
        if (error || !customer) {
            showToast('Customer not found');
            return;
        }
        
        currentCustomer = customer;
        displayCustomer();
        if (html5QrCode) html5QrCode.pause();
    } catch (err) {
        showToast(err.message);
    }
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 4000);
}

window.addEventListener('beforeunload', () => {
    if (html5QrCode) {
        html5QrCode.stop().catch(() => {});
    }
});
