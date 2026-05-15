let html5QrCode = null;
let currentCustomer = null;
let shopSettings = { stamps_required: 6 };

// Auth guard
supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    initScanner();
});

async function initScanner() {
    const shop = await getCurrentShop();
    if (shop?.settings) shopSettings = shop.settings;
    
    html5QrCode = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        console.error("Camera error:", err);
        showToast("Camera access denied or unavailable");
    });
}

function onScanSuccess(decodedText) {
    try {
        const data = JSON.parse(decodedText);
        if (data.customer && data.shop) {
            loadCustomer(data.customer, data.shop);
        }
    } catch (e) {
        // Try as plain code
        manualLookup(decodedText);
    }
}

function onScanFailure(error) {
    // Ignore continuous scanning errors
}

async function loadCustomer(customerId, shopId) {
    // Verify shop ownership
    const shop = await getCurrentShop();
    if (shop.id !== shopId) {
        showToast('Invalid QR: Not your customer');
        return;
    }
    
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('shop_id', shopId)
        .single();
    
    if (!customer) {
        showToast('Customer not found');
        return;
    }
    
    currentCustomer = customer;
    displayCustomer();
    
    // Stop scanning temporarily
    html5QrCode.pause();
}

function displayCustomer() {
    const result = document.getElementById('scanResult');
    result.classList.remove('hidden');
    
    document.getElementById('scannedName').textContent = currentCustomer.name;
    document.getElementById('currentStamps').textContent = currentCustomer.stamps;
    document.getElementById('requiredStamps').textContent = shopSettings.stamps_required || 6;
    
    // Stamp visual
    const visual = document.getElementById('stampVisual');
    const required = shopSettings.stamps_required || 6;
    visual.innerHTML = Array.from({length: required}, (_, i) => 
        `<span style="opacity: ${i < currentCustomer.stamps ? '1' : '0.3'}">☕</span>`
    ).join('');
    
    // Reward badge
    const badge = document.getElementById('rewardBadge');
    const redeemBtn = document.getElementById('redeemBtn');
    
    if (currentCustomer.free_rewards > 0 || currentCustomer.stamps >= required) {
        badge.classList.remove('hidden');
        redeemBtn.disabled = false;
    } else {
        badge.classList.add('hidden');
        redeemBtn.disabled = true;
    }
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
    
    const { error } = await supabase
        .from('customers')
        .update({ 
            stamps: newStamps, 
            free_rewards: newRewards,
            total_visits: currentCustomer.total_visits + 1
        })
        .eq('id', currentCustomer.id);
    
    if (error) {
        showToast(error.message);
        return;
    }
    
    // Log visit
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
    
    currentCustomer = updated;
    displayCustomer();
}

async function redeemReward() {
    if (!currentCustomer || currentCustomer.free_rewards < 1) {
        showToast('No rewards available');
        return;
    }
    
    const { error } = await supabase
        .from('customers')
        .update({ free_rewards: currentCustomer.free_rewards - 1 })
        .eq('id', currentCustomer.id);
    
    if (error) {
        showToast(error.message);
        return;
    }
    
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
    
    currentCustomer = updated;
    displayCustomer();
}

async function manualLookup(code) {
    const shop = await getCurrentShop();
    
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('customer_code', code || document.getElementById('manualCode').value)
        .single();
    
    if (!customer) {
        showToast('Customer not found');
        return;
    }
    
    currentCustomer = customer;
    displayCustomer();
    if (html5QrCode) html5QrCode.pause();
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 4000);
}

// Resume scanner when clicking back
window.addEventListener('beforeunload', () => {
    if (html5QrCode) html5QrCode.stop();
});
