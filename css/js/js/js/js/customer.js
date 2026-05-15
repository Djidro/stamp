const params = new URLSearchParams(window.location.search);
const customerId = params.get('customer');
const shopId = params.get('shop');

if (!customerId || !shopId) {
    document.body.innerHTML = `
        <div style="text-align:center; padding: 2rem;">
            <h2>Invalid Link</h2>
            <p>Please use the correct customer URL</p>
        </div>
    `;
}

async function loadCustomerCard() {
    const { data: shop } = await supabase
        .from('shops')
        .select('shop_name, settings')
        .eq('id', shopId)
        .single();
    
    if (shop) {
        document.getElementById('shopName').textContent = shop.shop_name;
    }
    
    const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .eq('shop_id', shopId)
        .single();
    
    if (!customer) {
        document.body.innerHTML = '<div style="text-align:center; padding: 2rem;"><h2>Customer Not Found</h2></div>';
        return;
    }
    
    document.getElementById('customerName').textContent = customer.name;
    document.getElementById('customerCode').textContent = customer.customer_code;
    
    const qrData = JSON.stringify({ customer: customerId, shop: shopId });
    
    QRCode.toCanvas(document.getElementById('customerQR'), qrData, {
        width: 200,
        margin: 1,
        color: { dark: '#6F4E37', light: '#FFFFFF' }
    });
    
    const required = shop?.settings?.stamps_required || 6;
    document.getElementById('stampTarget').textContent = required;
    document.getElementById('stampCount').textContent = customer.stamps;
    
    const grid = document.getElementById('stampsGrid');
    grid.innerHTML = Array.from({length: required}, (_, i) => 
        `<div class="stamp-slot ${i < customer.stamps ? 'filled' : ''}">☕</div>`
    ).join('');
    
    document.getElementById('rewardCount').textContent = customer.free_rewards;
}

loadCustomerCard();
