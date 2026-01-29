const TelegramBot = require('node-telegram-bot-api');
const ApprovalSystem = require('./NortxhTelegram');
const config = require('./NortxhConfig');

// Token bot Telegram
const token = '8576202582:AAE9-kwUUURhka5upa7G1yx3TOcwvdhDwqc';
const bot = new TelegramBot(token, { polling: true });

// Inisialisasi sistem approval
const approvalSystem = new ApprovalSystem(bot);

// Handler untuk callback queries (button clicks)
bot.on('callback_query', async (callbackQuery) => {
  if (callbackQuery.data.startsWith('approve_') || callbackQuery.data.startsWith('reject_')) {
    await approvalSystem.handleCallbackQuery(callbackQuery);
  }
});

// Command start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check approval status
  const isApproved = await approvalSystem.validateApproval();
  
  if (!isApproved) {
    // Check script integrity
    const integrity = await approvalSystem.checkScriptIntegrity();
    if (!integrity) {
      await bot.sendMessage(chatId, 
        "❌ *Script tidak valid!*\n\nSilahkan hubungi creator untuk support.",
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Request approval
    const approved = await approvalSystem.checkApproval(chatId);
    if (!approved) {
      return;
    }
  }

  // Jika sudah approved, tampilkan menu utama
  await bot.sendMessage(chatId,
    "✅ *BOT AKTIF*\n\n" +
    "Script telah disetujui dan siap digunakan!\n\n" +
    "🤖 *Fitur yang tersedia:*\n" +
    "• Fitur 1\n" +
    "• Fitur 2\n" +
    "• Fitur 3\n\n" +
    "Gunakan /menu untuk melihat menu lengkap.",
    { parse_mode: 'Markdown' }
  );
});

// Command untuk admin: cek status approval
bot.onText(/\/approval_status/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Hanya admin yang bisa menggunakan
  if (chatId.toString() !== config.approval.admin_id) {
    await bot.sendMessage(chatId, "Perintah ini hanya untuk creator!");
    return;
  }

  const status = approvalSystem.getApprovalStatus();
  
  let message = "📊 *STATUS APPROVAL*\n\n";
  message += `✅ *Approved:* ${status.approved ? 'Ya' : 'Tidak'}\n`;
  if (status.approved) {
    message += `📅 *Tanggal:* ${new Date(status.approved_at).toLocaleString()}\n`;
  }
  message += `⏳ *Pending Requests:* ${status.pending_requests}\n\n`;
  message += "_Gunakan /reset_approval untuk reset status approval_";

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command untuk admin: reset approval
bot.onText(/\/reset_approval/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Hanya admin yang bisa menggunakan
  if (chatId.toString() !== config.approval.admin_id) {
    await bot.sendMessage(chatId, "Perintah ini hanya untuk creator!");
    return;
  }

  approvalSystem.resetApproval();
  await bot.sendMessage(chatId, 
    "🔄 *Approval telah direset*\n\n" +
    "Semua status approval dan pending requests telah dihapus.",
    { parse_mode: 'Markdown' }
  );
});

// Middleware untuk mengecek approval di setiap command
bot.on('message', async (msg) => {
  // Skip jika bukan command atau jika pesan dari admin
  if (!msg.text || !msg.text.startsWith('/') || msg.text === '/start') {
    return;
  }

  const chatId = msg.chat.id;
  
  // Jika bukan admin, cek approval
  if (chatId.toString() !== config.approval.admin_id) {
    if (!approvalSystem.isApproved()) {
      await bot.sendMessage(chatId,
        "🔒 *SCRIPT BELUM DISETUJUI*\n\n" +
        "Gunakan /start untuk meminta persetujuan dari creator.",
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
});

// Fungsi untuk memulai bot
async function startBot() {
  console.log('🤖 Bot Telegram sedang berjalan...');
  
  // Cek integritas script saat start
  await approvalSystem.checkScriptIntegrity();
  
  // Kirim notifikasi ke admin
  await bot.sendMessage(config.approval.admin_id,
    "🤖 *BOT DIMULAI*\n\n" +
    `Bot telah dijalankan pada: ${new Date().toLocaleString()}\n` +
    `Status Approval: ${approvalSystem.isApproved() ? '✅ Disetujui' : '❌ Belum disetujui'}`,
    { parse_mode: 'Markdown' }
  );
}

// Jalankan bot
startBot().catch(console.error);

module.exports = { bot, approvalSystem };