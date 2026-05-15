let currentShop = null;
let customers = [];
let visitsChart = null;
let currentQRData = null;

supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    initDashboard();
});

async function initDashboard() {
    currentShop = await getCurrentShop();
    if (!currentShop) return;
    
    document.getElementById('shopNameDisplay').textContent = currentShop.shop_name;
    document.getElementById('stampsRequired').value = currentShop.settings?.stamps_required || 6;
    document.getElementById('rewardName').value = currentShop.settings?.reward_type || 'Free Drink';
    
    loadOverview();
    loadCustomers();
    loadBroadcasts();
    
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            showSection(section);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
    
    document.getElementById('broadcastMessage').addEventListener('input', updatePreview);
    document.getElementById('broadcastTitle').addEventListener('input', updatePreview);
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.getElementById('pageTitle').textContent = 
        sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast hidden', 4000);
}

async function loadOverview() {
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
    
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });
    
    const visitCounts = last7Days.map(date => {
        return visitData?.filter(v => v.created_at?.startsWith(date)).length || 0;
    });
    
    const ctx = document.getElementById('visitsChart').getContext('2d');
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
    
    const { data: recent } = await supabase
        .from('visits')
        .select('*, customers(name)')
        .eq('shop_id', currentShop.id)
        .order('created_at', { ascending: false })
        .limit(10);
    
    const list = document.getElementById('activityList');
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
}

async function loadCustomers() {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('created_at', { ascending: false });
    
    if (error) { showToast(error.message); return; }
    
    customers = data || [];
    renderCustomers(customers);
}

function renderCustomers(list) {
    const tbody = document.getElementById('customersTableBody');
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
            <td><button onclick="showQR('${c.id}', '${c.name}')" class="btn btn-sm btn-outline">Show QR</button></td>
            <td><button onclick="deleteCustomer('${c.id}')" class="btn btn-sm btn-danger">Delete</button></td>
        </tr>
    `).join('');
}

function searchCustomers() {
    const query = document.getElementById('customerSearch').value.toLowerCase();
    const filtered = customers.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query) ||
        c.customer_code.toLowerCase().includes(query)
    );
    renderCustomers(filtered);
}

function openAddCustomer() { document.getElementById('customerModal').classList.remove('hidden'); }
function closeModal() { document.getElementById('customerModal').classList.add('hidden'); }

async function addCustomer() {
    const name = document.getElementById('newCustomerName').value;
    const phone = document.getElementById('newCustomerPhone').value;
    
    if (!name || !phone) { showToast('Please fill all fields'); return; }
    
    const prefix = currentShop.shop_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const count = customers.length + 1;
    const code = `${prefix}-${String(count).padStart(3, '0')}`;
    
    const { error } = await supabase.from('customers').insert({
        shop_id: currentShop.id,
        customer_code: code,
        name,
        phone
    });
    
    if (error) { showToast(error.message); return; }
    
    showToast('Customer added!', 'success');
    closeModal();
    loadCustomers();
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return;
    await supabase.from('customers').delete().eq('id', id);
    showToast('Customer deleted', 'success');
    loadCustomers();
}

function showQR(customerId, name) {
    currentQRData = { id: customerId, name };
    document.getElementById('qrModal').classList.remove('hidden');
    
    const qrData = JSON.stringify({ customer: customerId, shop: currentShop.id });
    
    QRCode.toCanvas(document.getElementById('qrCanvas'), qrData, {
        width: 250,
        margin: 2,
        color: { dark: '#6F4E37', light: '#FFFFFF' }
    });
    
    document.getElementById('qrCustomerName').textContent = name;
}

function closeQrModal() { document.getElementById('qrModal').classList.add('hidden'); }

function downloadQR() {
    const canvas = document.getElementById('qrCanvas');
    const link = document.createElement('a');
    link.download = `qr-${currentQRData.name}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

function updatePreview() {
    const title = document.getElementById('broadcastTitle').value;
    const msg = document.getElementById('broadcastMessage').value;
    document.getElementById('previewBox').innerHTML = `
        <strong>${title || 'No Title'}</strong><br>
        ${msg || 'Your message will appear here...'}
    `;
}

async function sendBroadcast() {
    const title = document.getElementById('broadcastTitle').value;
    const message = document.getElementById('broadcastMessage').value;
    
    if (!title || !message) { showToast('Please fill title and message'); return; }
    
    const { error } = await supabase.from('notifications').insert({
        shop_id: currentShop.id,
        title,
        message
    });
    
    if (error) { showToast(error.message); return; }
    
    showToast('Broadcast sent to all customers!', 'success');
    document.getElementById('broadcastTitle').value = '';
    document.getElementById('broadcastMessage').value = '';
    updatePreview();
    loadBroadcasts();
}

async function loadBroadcasts() {
    const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('sent_at', { ascending: false })
        .limit(10);
    
    const container = document.getElementById('broadcastHistory');
    if (!data?.length) return;
    
    const list = data.map(n => `
        <div class="history-item">
            <strong>${n.title}</strong>
            <p style="color: var(--text-light); margin-top: 0.25rem;">${n.message}</p>
            <small style="color: var(--text-light);">
                ${new Date(n.sent_at).toLocaleString()}
            </small>
        </div>
    `).join('');
    
    container.innerHTML = '<h4>Recent Broadcasts</h4>' + list;
}

async function saveSettings() {
    const stamps = parseInt(document.getElementById('stampsRequired').value);
    const reward = document.getElementById('rewardName').value;
    
    const { error } = await supabase
        .from('shops')
        .update({ settings: { stamps_required: stamps, reward_type: reward } })
        .eq('id', currentShop.id);
    
    if (error) { showToast(error.message); return; }
    showToast('Settings saved!', 'success');
}

function toggleSidebar() { document.querySelector('.sidebar').classList.toggle('open'); }
