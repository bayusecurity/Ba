const TelegramBot = require('node-telegram-bot-api');
const ApprovalSystem = require('./NortxhTelegram');
const config = require('./NortxhConfig');

// Token bot Telegram - GANTI DENGAN TOKEN ANDA
const token = '8576202582:AAE9-kwUUURhka5upa7G1yx3TOcwvdhDwqc';

// Buat instance bot dengan polling
const bot = new TelegramBot(token, { polling: true });

// Inisialisasi sistem approval
const approvalSystem = new ApprovalSystem(bot);

console.log('🤖 Bot Telegram sedang dimulai...');
console.log(`👑 Admin ID: ${config.approval.admin_id}`);
console.log(`🔍 Code to detect: "${config.code_to_detect}"`);

// ==================== HANDLER CALLBACK QUERIES ====================
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  
  // Handle approval/reject callbacks
  if (data.startsWith('approve_') || data.startsWith('reject_')) {
    await approvalSystem.handleCallbackQuery(callbackQuery);
  }
  
  // Handle view all requests
  if (data === 'view_all_requests') {
    const status = approvalSystem.getApprovalStatus();
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `📊 Total pending requests: ${status.pending_requests}`,
      show_alert: true
    });
  }
});

// ==================== COMMAND HANDLERS ====================
// Command: /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  console.log(`🚀 /start command from ${userId} (${msg.from.username || 'no username'})`);
  
  try {
    // Check script integrity terlebih dahulu
    const integrity = await approvalSystem.checkScriptIntegrity();
    if (!integrity) {
      await bot.sendMessage(chatId, 
        "❌ *SCRIPT TIDAK VALID!*\n\n" +
        "Terjadi masalah dengan integritas script.\n" +
        "Silahkan hubungi creator untuk support:\n" +
        `${config.approval.admin_username || config.approval.bot_username}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Check approval status
    const isApproved = await approvalSystem.validateApproval();
    
    if (!isApproved) {
      // Jika belum approved, minta approval
      const welcomeMsg = `👋 *Halo ${msg.from.first_name || 'User'}!*\n\n` +
                        `Selamat datang di *${config.approval.bot_username}*.\n\n` +
                        `Bot ini membutuhkan persetujuan dari creator sebelum dapat digunakan. ` +
                        `Apakah Anda sudah membeli script ini?`;
      
      await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });
      
      // Request approval
      const approved = await approvalSystem.checkApproval(chatId);
      if (!approved) {
        return;
      }
    }

    // Jika sudah approved, tampilkan menu
    const menuKeyboard = {
      reply_markup: {
        keyboard: [
          ['🎮 Fitur 1', '📊 Fitur 2'],
          ['⚙️ Pengaturan', '❓ Bantuan'],
          ['📈 Status Bot', '👑 Admin']
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };

    await bot.sendMessage(chatId,
      "✅ *BOT AKTIF & SIAP DIGUNAKAN!*\n\n" +
      "🤖 *Fitur yang tersedia:*\n" +
      "• 🎮 Fitur 1 - Game & Entertainment\n" +
      "• 📊 Fitur 2 - Tools & Utilities\n" +
      "• ⚙️ Pengaturan - Setting bot\n" +
      "• ❓ Bantuan - Panduan penggunaan\n\n" +
      "Pilih menu di bawah atau ketik command:\n" +
      "`/menu` - Tampilkan menu\n" +
      "`/help` - Bantuan\n" +
      "`/about` - Tentang bot",
      { 
        parse_mode: 'Markdown',
        ...menuKeyboard 
      }
    );
    
  } catch (error) {
    console.error('Error in /start command:', error);
    await bot.sendMessage(chatId, 
      "❌ Terjadi kesalahan saat memproses perintah. Silahkan coba lagi nanti.",
      { parse_mode: 'Markdown' }
    );
  }
});

// Command: /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  
  const isApproved = approvalSystem.isApproved();
  const status = approvalSystem.getApprovalStatus();
  
  let statusMessage = '';
  
  if (isApproved) {
    const approvedDate = status.approved_at ? new Date(status.approved_at).toLocaleString('id-ID') : 'Tidak diketahui';
    statusMessage = `✅ *STATUS: DISETUJUI*\n\n` +
                   `📅 *Disetujui pada:* ${approvedDate}\n` +
                   `👤 *User ID:* ${status.approved_by || 'Creator'}\n` +
                   `⚡ *Bot Status:* Aktif & Berjalan\n\n` +
                   `Bot siap digunakan!`;
  } else {
    statusMessage = `⏳ *STATUS: MENUNGGU PERSETUJUAN*\n\n` +
                   `📊 *Pending Requests:* ${status.pending_requests}\n` +
                   `🔒 *Akses:* Terbatas\n\n` +
                   `Gunakan /start untuk request approval dari creator.`;
  }
  
  await bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

// Command: /approval_status (admin only)
bot.onText(/\/approval_status/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from.id.toString();
  
  // Check if user is admin
  if (userId !== config.approval.admin_id) {
    await bot.sendMessage(chatId, 
      "❌ *AKSES DITOLAK!*\n\n" +
      "Perintah ini hanya untuk creator bot.",
      { parse_mode: 'Markdown' }
    );
    return;
  }
  
  const status = approvalSystem.getApprovalStatus();
  
  const message = `📊 *DETAIL STATUS APPROVAL*\n\n` +
                 `✅ *Approved:* ${status.approved ? 'YA' : 'TIDAK'}\n` +
                 `📅 *Tanggal Approval:* ${status.approved_at ? new Date(status.approved_at).toLocaleString('id-ID') : 'Belum ada'}\n` +
                 `👑 *Approved By:* ${status.approved_by || 'Belum ada'}\n` +
                 `⏳ *Pending Requests:* ${status.pending_requests}\n` +
                 `📈 *Total Approved:* ${status.total_approved}\n\n` +
                 `*Admin Commands:*\n` +
                 `/reset_approval - Reset semua approval\n` +
                 `/force_approve [user_id] - Force approve user\n` +
                 `/view_pending - Lihat semua pending requests`;
  
  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// Command: /reset_approval (admin only)
bot.onText(/\/reset_approval/, async (msg) => {
  const userId = msg.from.id.toString();
  
  if (userId !== config.approval.admin_id) {
    await bot.sendMessage(msg.chat.id, "❌ Hanya creator yang bisa menggunakan perintah ini!");
    return;
  }
  
  // Konfirmasi reset
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ YA, Reset Sekarang', callback_data: 'confirm_reset_all' },
        { text: '❌ BATALKAN', callback_data: 'cancel_reset' }
      ]
    ]
  };
  
  await bot.sendMessage(msg.chat.id,
    `⚠️ *KONFIRMASI RESET APPROVAL*\n\n` +
    `Anda akan mereset **SEMUA** data approval:\n` +
    `• Status approval saat ini\n` +
    `• Semua pending requests\n` +
    `• Data user yang sudah disetujui\n\n` +
    `*Tindakan ini tidak dapat dibatalkan!*\n` +
    `Apakah Anda yakin?`,
    {
      parse_mode: 'Markdown',
      reply_markup: confirmKeyboard
    }
  );
});

// Handle reset confirmation callback
bot.on('callback_query', async (callbackQuery) => {
  if (callbackQuery.data === 'confirm_reset_all') {
    if (callbackQuery.from.id.toString() === config.approval.admin_id) {
      approvalSystem.resetApproval();
      
      await bot.editMessageText(
        `🔄 *APPROVAL SYSTEM RESET*\n\n` +
        `Semua data approval telah direset ke kondisi awal.\n` +
        `User perlu request approval kembali untuk menggunakan bot.`,
        {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ Approval system berhasil direset!",
        show_alert: false
      });
    }
  } else if (callbackQuery.data === 'cancel_reset') {
    await bot.editMessageText(
      `❌ *RESET DIBATALKAN*\n\n` +
      `Tidak ada perubahan yang dilakukan pada sistem approval.`,
      {
        chat_id: callbackQuery.message.chat.id,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown'
      }
    );
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Reset dibatalkan",
      show_alert: false
    });
  }
});

// ==================== MIDDLEWARE UNTUK CHECK APPROVAL ====================
// Handler untuk semua pesan
bot.on('message', async (msg) => {
  // Skip jika bukan command text
  if (!msg.text || msg.text.startsWith('/start')) {
    return;
  }
  
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const text = msg.text;
  
  // Skip jika dari admin
  if (userId === config.approval.admin_id) {
    return;
  }
  
  // Check if approved
  if (!approvalSystem.isApproved()) {
    // Hanya izinkan command /start dan /status
    if (!text.startsWith('/status')) {
      await bot.sendMessage(chatId,
        `🔒 *AKSES DITOLAK!*\n\n` +
        `Bot belum disetujui oleh creator.\n` +
        `Silahkan gunakan /start untuk meminta persetujuan.\n\n` +
        `⏳ *Status:* Menunggu approval dari creator...\n` +
        `👑 *Hubungi:* ${config.approval.admin_username || 'Creator'}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  
  // Handler untuk menu keyboard
  if (text === '🎮 Fitur 1') {
    await bot.sendMessage(chatId, "🎮 *Fitur 1 Aktif*\n\nFitur game dan entertainment sedang dikembangkan...", { parse_mode: 'Markdown' });
  } else if (text === '📊 Fitur 2') {
    await bot.sendMessage(chatId, "📊 *Fitur 2 Aktif*\n\nFitur tools dan utilities sedang dikembangkan...", { parse_mode: 'Markdown' });
  } else if (text === '📈 Status Bot') {
    await bot.sendMessage(chatId, "📈 *Status Bot:*\n\n✅ Aktif\n⚡ Berjalan normal\n🔒 Terproteksi dengan sistem approval", { parse_mode: 'Markdown' });
  }
});

// ==================== START BOT FUNCTION ====================
async function startBot() {
  try {
    console.log('🚀 Starting Telegram Bot...');
    
    // Cek integritas script saat start
    console.log('🔍 Running initial script integrity check...');
    const integrity = await approvalSystem.checkScriptIntegrity();
    
    if (!integrity) {
      console.error('❌ Script integrity check failed! Bot cannot start.');
      
      // Notify admin via Telegram
      await bot.sendMessage(config.approval.admin_id,
        `❌ *BOT GAGAL START!*\n\n` +
        `Integritas script tidak valid:\n` +
        `Kode "${config.code_to_detect}" tidak ditemukan.\n\n` +
        `*Solusi:*\n` +
        `1. Pastikan kode "${config.code_to_detect}" ada di file utama\n` +
        `2. Cek konfigurasi di NortxhConfig.js\n` +
        `3. Verifikasi file yang akan di-check\n\n` +
        `*Waktu:* ${new Date().toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
      
      process.exit(1);
    }
    
    console.log('✅ Script integrity check passed!');
    
    // Get bot info
    const botInfo = await bot.getMe();
    console.log(`🤖 Bot Info:\n• Name: ${botInfo.first_name}\n• Username: @${botInfo.username}\n• ID: ${botInfo.id}`);
    
    // Send startup notification to admin
    const startupTime = new Date().toLocaleString('id-ID');
    await bot.sendMessage(config.approval.admin_id,
      `🚀 *BOT STARTED SUCCESSFULLY!*\n\n` +
      `🤖 *Bot Name:* ${botInfo.first_name}\n` +
      `📛 *Username:* @${botInfo.username}\n` +
      `🆔 *Bot ID:* ${botInfo.id}\n` +
      `⏰ *Startup Time:* ${startupTime}\n` +
      `✅ *Script Integrity:* Valid\n` +
      `🔐 *Approval Status:* ${approvalSystem.isApproved() ? 'Approved' : 'Pending'}\n\n` +
      `_Bot siap menerima perintah!_`,
      { parse_mode: 'Markdown' }
    );
    
    console.log('✅ Bot is now running and ready to receive commands!');
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// ==================== START THE BOT ====================
startBot();

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down bot gracefully...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Bot terminated by system...');
  bot.stopPolling();
  process.exit(0);
});

// Pastikan fungsi startBot() ada di file ini untuk integrity check!
module.exports = { bot, approvalSystem };