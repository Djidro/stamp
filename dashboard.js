// ============================================
// GLOBAL FUNCTIONS (for HTML onclick)
// ============================================
window.toggleSidebar = function() {
    document.querySelector('.sidebar')?.classList.toggle('open');
};

window.toggleDarkMode = function() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
};

window.logout = async function() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
};

window.openAddCustomer = function() {
    const modal = document.getElementById('customerModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeModal = function() {
    const modal = document.getElementById('customerModal');
    if (modal) modal.classList.add('hidden');
};

// These will be assigned after functions are defined
window.addCustomer = addCustomer;
window.deleteCustomer = deleteCustomer;
window.searchCustomers = searchCustomers;
window.showQR = showQR;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
window.sendBroadcast = sendBroadcast;
window.saveSettings = saveSettings;

// ============================================
// STATE
// ============================================
let currentShop = null;
let customers = [];
let visitsChart = null;
let currentQRData = null;

// ============================================
// AUTH GUARD
// ============================================
supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    initDashboard();
});

async function initDashboard() {
    // ✅ FIX: Use window.getCurrentShop()
    currentShop = await window.getCurrentShop();
    if (!currentShop) {
        showToast('Could not load shop data', 'error');
        return;
    }
    
    document.getElementById('shopNameDisplay').textContent = currentShop.shop_name || 'My Shop';
    document.getElementById('stampsRequired').value = currentShop.settings?.stamps_required || 6;
    document.getElementById('rewardName').value = currentShop.settings?.reward_type || 'Free Drink';
    
    loadOverview();
    loadCustomers();
    loadBroadcasts();
    
    // Navigation
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            showSection(section);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    // Broadcast preview
    document.getElementById('broadcastMessage').addEventListener('input', updatePreview);
    document.getElementById('broadcastTitle').addEventListener('input', updatePreview);
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
    document.getElementById('pageTitle').textContent = 
        sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 4000);
}

// Overview
async function loadOverview() {
    try {
        // Stats
        const { count: customerCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('shop_id', currentShop.id);
        
        const { data: visitData } = await supabase
            .from('visits')
            .select('action, created_at')
            .eq('shop_id', currentShop.id);
        
        const totalVisits = visitData?.filter(v => v.action === 'stamp').length || 0;
        const totalRedemptions = visitData?.filter(v => v.action === 'redeem').length || 0;
        
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = visitData?.filter(v => v.created_at?.startsWith(today)).length || 0;
        
        document.getElementById('totalCustomers').textContent = customerCount || 0;
        document.getElementById('totalVisits').textContent = totalVisits;
        document.getElementById('totalRedemptions').textContent = totalRedemptions;
        document.getElementById('todayVisits').textContent = todayVisits;
        
        // Chart
        const last7Days = Array.from({length: 7}, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });
        
        const visitCounts = last7Days.map(date => {
            return visitData?.filter(v => v.created_at?.startsWith(date)).length || 0;
        });
        
        const ctx = document.getElementById('visitsChart');
        if (!ctx) return;
        
        if (visitsChart) visitsChart.destroy();
        
        visitsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days.map(d => d.slice(5)),
                datasets: [{
                    label: 'Visits',
                    data: visitCounts,
                    borderColor: '#6F4E37',
                    backgroundColor: 'rgba(111, 78, 55, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
        
        // Recent activity
        const { data: recent } = await supabase
            .from('visits')
            .select('*, customers(name)')
            .eq('shop_id', currentShop.id)
            .order('created_at', { ascending: false })
            .limit(10);
        
        const list = document.getElementById('activityList');
        if (!list) return;
        
        if (!recent?.length) {
            list.innerHTML = '<p class="empty">No recent activity</p>';
            return;
        }
        
        list.innerHTML = recent.map(v => `
            <div class="activity-item">
                <span>${v.customers?.name || 'Unknown'} - ${v.action === 'stamp' ? '☕ Stamp' : '🎁 Redeem'}</span>
                <span style="color: var(--text-light); font-size: 0.85rem;">
                    ${new Date(v.created_at).toLocaleTimeString()}
                </span>
            </div>
        `).join('');
    } catch (err) {
        console.error('loadOverview error:', err);
    }
}

// Customers
async function loadCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('shop_id', currentShop.id)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        customers = data || [];
        renderCustomers(customers);
    } catch (err) {
        showToast(err.message);
    }
}

function renderCustomers(list) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No customers yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = list.map(c => `
        <tr>
            <td><code>${c.customer_code}</code></td>
            <td>${c.name}</td>
            <td>${c.phone}</td>
            <td><strong>${c.stamps}</strong></td>
            <td>${c.free_rewards}</td>
            <td>${c.total_visits}</td>
            <td><button onclick="showQR('${c.id}', '${c.name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline">Show QR</button></td>
            <td><button onclick="deleteCustomer('${c.id}')" class="btn btn-sm btn-danger">Delete</button></td>
        </tr>
    `).join('');
}

function searchCustomers() {
    const query = document.getElementById('customerSearch')?.value.toLowerCase() || '';
    const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query) ||
        c.customer_code.toLowerCase().includes(query)
    );
    renderCustomers(filtered);
}

function openAddCustomer() {
    const modal = document.getElementById('customerModal');
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('customerModal');
    if (modal) modal.classList.add('hidden');
}

async function addCustomer() {
    const name = document.getElementById('newCustomerName')?.value;
    const phone = document.getElementById('newCustomerPhone')?.value;
    
    if (!name || !phone) {
        showToast('Please fill all fields');
        return;
    }
    
    const prefix = (currentShop.shop_name || 'SHP').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const count = customers.length + 1;
    const code = `${prefix}-${String(count).padStart(3, '0')}`;
    
    try {
        const { error } = await supabase.from('customers').insert({
            shop_id: currentShop.id,
            customer_code: code,
            name,
            phone
        });
        
        if (error) throw error;
        
        showToast('Customer added!', 'success');
        closeModal();
        document.getElementById('newCustomerName').value = '';
        document.getElementById('newCustomerPhone').value = '';
        loadCustomers();
    } catch (err) {
        showToast(err.message);
    }
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return;
    
    try {
        await supabase.from('customers').delete().eq('id', id);
        showToast('Customer deleted', 'success');
        loadCustomers();
    } catch (err) {
        showToast(err.message);
    }
}

// QR Code
function showQR(customerId, name) {
    currentQRData = { id: customerId, name };
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.remove('hidden');
    
    const qrData = JSON.stringify({
        customer: customerId,
        shop: currentShop.id
    });
    
    const canvas = document.getElementById('qrCanvas');
    if (canvas && typeof QRCode !== 'undefined') {
        QRCode.toCanvas(canvas, qrData, {
            width: 250,
            margin: 2,
            color: { dark: '#6F4E37', light: '#FFFFFF' }
        });
    }
    
    const nameEl = document.getElementById('qrCustomerName');
    if (nameEl) nameEl.textContent = name;
}

function closeQrModal() {
    const modal = document.getElementById('qrModal');
    if (modal) modal.classList.add('hidden');
}

function downloadQR() {
    if (!currentQRData) return;
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-${currentQRData.name}.png`;
    link.href = canvas.toDataURL();
    link.click();
}
// ============================================
// BROADCAST
// ============================================
function updatePreview() {
    const title = document.getElementById('broadcastTitle')?.value || '';
    const msg = document.getElementById('broadcastMessage')?.value || '';
    const box = document.getElementById('previewBox');
    if (box) box.innerHTML = `<strong>${title || 'No Title'}</strong><br>${msg || 'Your message will appear here...'}`;
}
async function sendBroadcast() {
    // PREVENT DOUBLE CLICK
    const btn = document.querySelector('#broadcast button');
    if (btn.disabled) return;
    
    const title = document.getElementById('broadcastTitle')?.value?.trim();
    const message = document.getElementById('broadcastMessage')?.value?.trim();
    
    if (!title || !message) { showToast('Please fill title and message'); return; }
    
    // DISABLE button immediately
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    try {
        await supabase.from('notifications').insert({ 
            shop_id: currentShop.id, 
            title, 
            message, 
            sent_at: new Date().toISOString() 
        });
        
        const tg = await sendTelegramBroadcast(title, message, currentShop.id);
        showToast(tg?.sent ? `✅ Sent! (Telegram: ${tg.sent})` : '✅ Saved!', 'success');
        
        document.getElementById('broadcastTitle').value = '';
        document.getElementById('broadcastMessage').value = '';
        updatePreview();
        loadBroadcasts();
    } catch (err) { 
        showToast(err.message || 'Failed'); 
    } finally {
        // RE-ENABLE button after 2 seconds
        setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Send to All Customers';
        }, 2000);
    }
}

async function loadBroadcasts() {
    try {
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('shop_id', currentShop.id)
            .order('sent_at', { ascending: false })
            .limit(10);
        
        const container = document.getElementById('broadcastHistory');
        if (!container) return;
        
        if (!data?.length) {
            container.innerHTML = '<h4>Recent Broadcasts</h4><p class="empty">No broadcasts yet</p>';
            return;
        }
        
        let html = '<h4>Recent Broadcasts</h4>';
        data.forEach(n => {
            html += `<div class="history-item">
                <strong>📢 ${n.title}</strong>
                <p>${n.message}</p>
                <small>${new Date(n.sent_at).toLocaleString()}</small>
            </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error('loadBroadcasts error:', err);
    }
}

// ============================================
// SETTINGS
// ============================================
async function saveSettings() {
    const stamps = parseInt(document.getElementById('stampsRequired')?.value);
    const reward = document.getElementById('rewardName')?.value;
    
    if (!stamps || !reward) {
        showToast('Please fill all settings');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('shops')
            .update({ settings: { stamps_required: stamps, reward_type: reward } })
            .eq('id', currentShop.id);
        
        if (error) throw error;
        showToast('Settings saved!', 'success');
    } catch (err) {
        showToast(err.message);
    }
}
