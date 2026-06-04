// ============================================
// GLOBAL FUNCTIONS
// ============================================
window.toggleSidebar = function() { document.querySelector('.sidebar')?.classList.toggle('open'); };
window.toggleDarkMode = function() { const c=document.documentElement.getAttribute('data-theme'),n=c==='dark'?'light':'dark'; document.documentElement.setAttribute('data-theme',n); localStorage.setItem('theme',n); };
window.logout = async function() { await supabase.auth.signOut(); window.location.href='login.html'; };
window.openAddCustomer = function() { document.getElementById('customerModal')?.classList.remove('hidden'); };
window.closeModal = function() { document.getElementById('customerModal')?.classList.add('hidden'); };
window.addCustomer = addCustomer;
window.deleteCustomer = deleteCustomer;
window.searchCustomers = searchCustomers;
window.showQR = showQR;
window.closeQrModal = closeQrModal;
window.downloadQR = downloadQR;
window.sendBroadcast = sendBroadcast;
window.saveSettings = saveSettings;

let currentShop = null, customers = [], visitsChart = null, currentQRData = null;

// Auth guard
supabase.auth.getSession().then(({ data: { session } }) => { if (!session) { window.location.href='login.html'; return; } initDashboard(); });

async function initDashboard() {
    currentShop = await window.getCurrentShop();
    if (!currentShop) { showToast('Could not load shop data','error'); return; }
    document.getElementById('shopNameDisplay').textContent = currentShop.shop_name || 'My Shop';
    document.getElementById('stampsRequired').value = currentShop.settings?.stamps_required || 6;
    document.getElementById('rewardName').value = currentShop.settings?.reward_type || 'Free Drink';
        // ⚠️ Show trial banner
    showTrialBanner();
    // ⚡ Load overview + customers in PARALLEL
    Promise.all([loadOverview(), loadCustomers(), loadBroadcasts()]);
    
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => { e.preventDefault(); showSection(item.dataset.section); document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); item.classList.add('active'); });
    });
    document.getElementById('broadcastMessage').addEventListener('input', updatePreview);
    document.getElementById('broadcastTitle').addEventListener('input', updatePreview);
}
function showTrialBanner() {
    const banner = document.getElementById('trialBanner');
    if (!banner || !currentShop) return;
    
    const trialEnd = currentShop.trial_ends_at ? new Date(currentShop.trial_ends_at) : null;
    if (!trialEnd || currentShop.payment_status === 'approved') return;
    
    const now = new Date();
    const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    
    banner.style.display = 'block';
  banner.classList.remove('hidden');
    if (daysLeft <= 0) {
        banner.style.background = '#FFEBEE';
        banner.style.border = '2px solid #f44336';
        banner.style.color = '#c62828';
        banner.innerHTML = `⚠️ <b>Trial Expired!</b> Please <a href="pricing.html" style="color:#c62828;font-weight:700;">upgrade now</a> to continue.`;
    } else if (daysLeft <= 3) {
        banner.style.background = '#FFF8E1';
        banner.style.border = '2px solid #FF9800';
        banner.style.color = '#E65100';
        banner.innerHTML = `⏳ <b>${daysLeft} day${daysLeft > 1 ? 's' : ''} left!</b> Your trial ends soon. <a href="pricing.html" style="color:#E65100;font-weight:700;">Upgrade now →</a>`;
    } else {
        banner.style.background = '#E8F5E9';
        banner.style.border = '2px solid #4CAF50';
        banner.style.color = '#2E7D32';
        banner.innerHTML = `✅ <b>${daysLeft} days left</b> in your free trial. <a href="pricing.html" style="color:#2E7D32;font-weight:700;">Choose a plan →</a>`;
    }
}
function showSection(id) { document.querySelectorAll('.section').forEach(s=>s.classList.remove('active')); const t=document.getElementById(id); if(t) t.classList.add('active'); document.getElementById('pageTitle').textContent=id.charAt(0).toUpperCase()+id.slice(1); }
function showToast(message, type='error') { const t=document.getElementById('toast'); if(!t) return; t.textContent=message; t.className=`toast ${type}`; setTimeout(()=>t.className='toast hidden',4000); }

// ⚡ COMBINED Overview - ONE API call instead of 3
async function loadOverview() {
    try {
        const [custRes, visitRes, recentRes] = await Promise.all([
            supabase.from('customers').select('*', { count: 'exact', head: true }).eq('shop_id', currentShop.id),
            supabase.from('visits').select('action, created_at').eq('shop_id', currentShop.id),
            supabase.from('visits').select('*, customers(name)').eq('shop_id', currentShop.id).order('created_at', { ascending: false }).limit(10)
        ]);
        
        const customerCount = custRes.count || 0;
        const visitData = visitRes.data || [];
        const totalVisits = visitData.filter(v=>v.action==='stamp').length;
        const totalRedemptions = visitData.filter(v=>v.action==='redeem').length;
        const today = new Date().toISOString().split('T')[0];
        const todayVisits = visitData.filter(v=>v.created_at?.startsWith(today)).length;
        
        document.getElementById('totalCustomers').textContent = customerCount;
        document.getElementById('totalVisits').textContent = totalVisits;
        document.getElementById('totalRedemptions').textContent = totalRedemptions;
        document.getElementById('todayVisits').textContent = todayVisits;
        
        // Chart
        const last7Days = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split('T')[0]; });
        const visitCounts = last7Days.map(d=>visitData.filter(v=>v.created_at?.startsWith(d)).length);
        const ctx = document.getElementById('visitsChart');
        if (ctx) {
            if (visitsChart) visitsChart.destroy();
            visitsChart = new Chart(ctx, { type:'line', data:{ labels:last7Days.map(d=>d.slice(5)), datasets:[{ label:'Visits', data:visitCounts, borderColor:'#6F4E37', backgroundColor:'rgba(111,78,55,0.1)', fill:true, tension:0.4 }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } } });
        }
        
        // Recent activity
        const recent = recentRes.data || [];
        const list = document.getElementById('activityList');
        if (list) {
            if (!recent.length) { list.innerHTML='<p class="empty">No recent activity</p>'; return; }
            list.innerHTML = recent.map(v=>`<div class="activity-item"><span>${v.customers?.name||'Unknown'} - ${v.action==='stamp'?'☕ Stamp':'🎁 Redeem'}</span><span style="color:var(--text-light);font-size:0.85rem;">${new Date(v.created_at).toLocaleTimeString()}</span></div>`).join('');
        }
    } catch (err) { console.error('loadOverview error:', err); }
}

// Customers
async function loadCustomers() {
    try {
        const { data, error } = await supabase.from('customers').select('id,customer_code,name,phone,stamps,free_rewards,total_visits,created_at').eq('shop_id', currentShop.id).order('created_at', { ascending: false });
        if (error) throw error;
        customers = data || [];
        renderCustomers(customers);
    } catch (err) { showToast(err.message); }
}

function renderCustomers(list) {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    if (!list.length) { tbody.innerHTML='<tr><td colspan="8" class="empty">No customers yet</td></tr>'; return; }
    tbody.innerHTML = list.map(c=>`<tr><td><code>${c.customer_code}</code></td><td>${c.name}</td><td>${c.phone}</td><td><strong>${c.stamps}</strong></td><td>${c.free_rewards}</td><td>${c.total_visits}</td><td><button onclick="showQR('${c.id}','${c.name.replace(/'/g,"\\'")}')" class="btn btn-sm btn-outline">Show QR</button></td><td><button onclick="deleteCustomer('${c.id}')" class="btn btn-sm btn-danger">Delete</button></td></tr>`).join('');
}

function searchCustomers() { const q=(document.getElementById('customerSearch')?.value||'').toLowerCase(); renderCustomers(customers.filter(c=>c.name.toLowerCase().includes(q)||c.phone.includes(q)||c.customer_code.toLowerCase().includes(q))); }
async function addCustomer() {
    const name=document.getElementById('newCustomerName')?.value, phone=document.getElementById('newCustomerPhone')?.value;
    if(!name||!phone) { showToast('Please fill all fields'); return; }
    const prefix=(currentShop.shop_name||'SHP').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,3);
    const code=`${prefix}-${String(customers.length+1).padStart(3,'0')}`;
    try { await supabase.from('customers').insert({shop_id:currentShop.id,customer_code:code,name,phone}); showToast('Customer added!','success'); closeModal(); document.getElementById('newCustomerName').value=''; document.getElementById('newCustomerPhone').value=''; loadCustomers(); } catch(err) { showToast(err.message); }
}
async function deleteCustomer(id) { if(!confirm('Delete this customer?')) return; try { await supabase.from('customers').delete().eq('id',id); showToast('Customer deleted','success'); loadCustomers(); } catch(err) { showToast(err.message); } }

// QR Code
function showQR(customerId, name) {
    currentQRData={id:customerId,name};
    document.getElementById('qrModal')?.classList.remove('hidden');
    const canvas=document.getElementById('qrCanvas');
    if(canvas&&typeof QRCode!=='undefined') QRCode.toCanvas(canvas,JSON.stringify({customer:customerId,shop:currentShop.id}),{width:250,margin:2,color:{dark:'#6F4E37',light:'#FFFFFF'}});
    const el=document.getElementById('qrCustomerName'); if(el) el.textContent=name;
}
function closeQrModal() { document.getElementById('qrModal')?.classList.add('hidden'); }
function downloadQR() { if(!currentQRData) return; const c=document.getElementById('qrCanvas'); if(!c) return; const a=document.createElement('a'); a.download=`qr-${currentQRData.name}.png`; a.href=c.toDataURL(); a.click(); }

// Broadcast
function updatePreview() { const t=document.getElementById('broadcastTitle')?.value||'', m=document.getElementById('broadcastMessage')?.value||'', b=document.getElementById('previewBox'); if(b) b.innerHTML=`<strong>${t||'No Title'}</strong><br>${m||'Your message will appear here...'}`; }
async function sendBroadcast() {
    const btn=document.getElementById('broadcastBtn'); if(btn.disabled) return;
    const title=document.getElementById('broadcastTitle')?.value?.trim(), message=document.getElementById('broadcastMessage')?.value?.trim();
    if(!title||!message) { showToast('Please fill title and message'); return; }
    btn.disabled=true; btn.textContent='Sending...';
    try {
        await supabase.from('notifications').insert({shop_id:currentShop.id,title,message,sent_at:new Date().toISOString()});
        await supabase.from('notifications').delete().lt('sent_at',new Date(Date.now()-3*24*60*60*1000).toISOString());
        const tg=await sendTelegramBroadcast(title,message,currentShop.id);
        showToast(tg?.sent?`✅ Sent to ${tg.sent} customers!`:'✅ Saved!','success');
        document.getElementById('broadcastTitle').value=''; document.getElementById('broadcastMessage').value=''; updatePreview(); loadBroadcasts();
    } catch(err) { showToast(err.message||'Failed'); }
    finally { setTimeout(()=>{btn.disabled=false;btn.textContent='Send to All Customers';},3000); }
}
async function loadBroadcasts() {
    try {
        const { data } = await supabase.from('notifications').select('title,message,sent_at').eq('shop_id',currentShop.id).order('sent_at',{ascending:false}).limit(10);
        const c=document.getElementById('broadcastHistory'); if(!c) return;
        if(!data?.length) { c.innerHTML='<h4>Recent Broadcasts</h4><p class="empty">No broadcasts yet</p>'; return; }
        let h='<h4>Recent Broadcasts</h4>'; data.forEach(n=>{ h+=`<div class="history-item"><strong>📢 ${n.title}</strong><p>${n.message}</p><small>${new Date(n.sent_at).toLocaleString()}</small></div>`; }); c.innerHTML=h;
    } catch(err) { console.error('loadBroadcasts error:',err); }
}

// Settings
async function saveSettings() {
    const stamps=parseInt(document.getElementById('stampsRequired')?.value), reward=document.getElementById('rewardName')?.value;
    if(!stamps||!reward) { showToast('Please fill all settings'); return; }
    try { await supabase.from('shops').update({settings:{stamps_required:stamps,reward_type:reward}}).eq('id',currentShop.id); showToast('Settings saved!','success'); } catch(err) { showToast(err.message); }
}
