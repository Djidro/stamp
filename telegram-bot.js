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

// Send broadcast to ALL customers via Telegram
async function sendTelegramBroadcast(title, message, shopId) {
    try {
        // Get all customers of this shop who have Telegram
        const { data: customers } = await supabase
            .from('customers')
            .select('id, name, telegram_chat_id')
            .eq('shop_id', shopId)
            .not('telegram_chat_id', 'is', null);

        if (!customers?.length) {
            console.log('No Telegram subscribers for this shop');
            return { sent: 0 };
        }

        const fullMessage = `📢 <b>${title}</b>\n\n${message}\n\n🏪 From: LoyaltySip`;
        let sent = 0;

        for (const customer of customers) {
            const result = await sendTelegramMessage(customer.telegram_chat_id, fullMessage);
            if (result?.ok) sent++;
        }

        return { sent, total: customers.length };
    } catch (err) {
        console.error('Telegram broadcast error:', err);
        return { sent: 0, error: err.message };
    }
}
