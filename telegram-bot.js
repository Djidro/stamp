// ============================================
// TELEGRAM BOT CONFIG
// ============================================
const TELEGRAM_BOT_TOKEN = '8677502842:AAEzyIv9tkw_T6d-3K-kzVc_vCNBcMLpQG8';
const TELEGRAM_BOT_LINK = 'https://t.me/LoyaltySip_Bot';

// Send message to a Telegram user
async function sendTelegramMessage(chatId, text) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return await response.json();
    } catch (err) {
        console.error('Telegram send error:', err);
        return null;
    }
}
async function sendTelegramBroadcast(title, message, shopId) {
    try {
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, telegram_chat_id')
            .eq('shop_id', shopId)
            .not('telegram_chat_id', 'is', null);

        if (!customers?.length) {
            console.log('No Telegram subscribers');
            return { sent: 0 };
        }

        // 🔧 DEDUPLICATE by chat_id
        const unique = [];
        const seen = new Set();
        for (const c of customers) {
            if (!seen.has(c.telegram_chat_id)) {
                seen.add(c.telegram_chat_id);
                unique.push(c);
            }
        }

        const fullMessage = `📢 <b>${title}</b>\n\n${message}`;
        let sent = 0;

        // Send ONE at a time with delay to avoid rate limits
        for (const customer of unique) {
            const result = await sendTelegramMessage(customer.telegram_chat_id, fullMessage);
            if (result?.ok) sent++;
            await new Promise(r => setTimeout(r, 500)); // 0.5 second delay
        }

        console.log(`📊 Sent to ${sent}/${unique.length} customers`);
        return { sent, total: unique.length };
    } catch (err) {
        console.error('Telegram broadcast error:', err);
        return { sent: 0, error: err.message };
    }
}
