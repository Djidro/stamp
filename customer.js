// ============================================
// GET CUSTOMER CODE FROM URL
// ============================================
const params = new URLSearchParams(window.location.search);
const customerCode = params.get('code');

// ============================================
// CHECK IF CODE EXISTS
// ============================================
if (!customerCode) {
    document.body.innerHTML = `
        <div style="text-align:center; padding: 2rem; color: #6F4E37; font-family: sans-serif;">
            <h2>☕ No Customer Code</h2>
            <p>Use the link provided by your coffee shop</p>
            <p style="font-size:0.9rem; color:#888;">Example: ?code=RB-001</p>
        </div>
    `;
} else {
    loadCustomerCard();
}

// ============================================
// LOAD CUSTOMER DATA
// ============================================
async function loadCustomerCard() {
    try {
        // Lookup customer by code (not ID)
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*, shops!inner(shop_name, settings)')
            .eq('customer_code', customerCode)
            .single();
        
        if (error || !customer) {
            document.body.innerHTML = `
                <div style="text-align:center; padding: 2rem; color: #6F4E37; font-family: sans-serif;">
                    <h2>❌ Customer Not Found</h2>
                    <p>Code: ${customerCode}</p>
                </div>
            `;
            return;
        }
        
        const shop = customer.shops;
        
        // Update UI
        document.getElementById('shopName').textContent = shop?.shop_name || 'Coffee Shop';
        document.getElementById('customerName').textContent = customer.name;
        document.getElementById('customerCode').textContent = customer.customer_code;
        
        // Generate QR Code
        const qrData = JSON.stringify({
            customer: customer.id,
            shop: customer.shop_id
        });
        
        const canvas = document.getElementById('customerQR');
        if (canvas && typeof QRCode !== 'undefined') {
            QRCode.toCanvas(canvas, qrData, {
                width: 200,
                margin: 1,
                color: { dark: '#6F4E37', light: '#FFFFFF' }
            });
        }
        
        // Display stamps
        const required = shop?.settings?.stamps_required || 6;
        document.getElementById('stampTarget').textContent = required;
        document.getElementById('stampCount').textContent = customer.stamps || 0;
        
        const grid = document.getElementById('stampsGrid');
        if (grid) {
            grid.innerHTML = Array.from({length: required}, (_, i) => 
                `<div style="font-size:1.5rem; opacity:${i < (customer.stamps || 0) ? '1' : '0.3'}">☕</div>`
            ).join('');
        }
        
        // Display rewards
        document.getElementById('rewardCount').textContent = customer.free_rewards || 0;
        
    } catch (err) {
        console.error('loadCustomerCard error:', err);
        document.body.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: #6F4E37;">
                <h2>Error Loading Card</h2>
                <p>Please try again later</p>
            </div>
        `;
    }
}
