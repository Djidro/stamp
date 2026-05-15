const params = new URLSearchParams(window.location.search);
const customerId = params.get('customer');
const shopId = params.get('shop');

if (!customerId || !shopId) {
    document.body.innerHTML = `
        <div style="text-align:center; padding: 2rem; color: white;">
            <h2>Invalid Link</h2>
            <p>Please use the correct customer URL</p>
        </div>
    `;
}

async function loadCustomerCard() {
    try {
        const { data: shop } = await supabase
            .from('shops')
            .select('shop_name, settings')
            .eq('id', shopId)
            .single();
        
        const shopNameEl = document.getElementById('shopName');
        if (shopNameEl && shop) shopNameEl.textContent = shop.shop_name || 'Coffee Shop';
        
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .eq('shop_id', shopId)
            .single();
        
        if (error || !customer) {
            document.body.innerHTML = '<div style="text-align:center; padding: 2rem; color: white;"><h2>Customer Not Found</h2></div>';
            return;
        }
        
        const nameEl = document.getElementById('customerName');
        const codeEl = document.getElementById('customerCode');
        if (nameEl) nameEl.textContent = customer.name;
        if (codeEl) codeEl.textContent = customer.customer_code;
        
        // QR
        const qrData = JSON.stringify({ customer: customerId, shop: shopId });
        const canvas = document.getElementById('customerQR');
        if (canvas && typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, qrData, {
                width: 200,
                margin: 1,
                color: { dark: '#6F4E37', light: '#FFFFFF' }
            });
        }
        
        // Stamps
        const required = shop?.settings?.stamps_required || 6;
        const targetEl = document.getElementById('stampTarget');
        const countEl = document.getElementById('stampCount');
        if (targetEl) targetEl.textContent = required;
        if (countEl) countEl.textContent = customer.stamps;
        
        const grid = document.getElementById('stampsGrid');
        if (grid) {
            grid.innerHTML = Array.from({length: required}, (_, i) => 
                `<div class="stamp-slot ${i < customer.stamps ? 'filled' : ''}">☕</div>`
            ).join('');
        }
        
        // Rewards
        const rewardEl = document.getElementById('rewardCount');
        if (rewardEl) rewardEl.textContent = customer.free_rewards || 0;
        
    } catch (err) {
        console.error('loadCustomerCard error:', err);
    }
}

loadCustomerCard();
