module.exports = {
  'approval': {
    'admin_id': '7807425271', // Ganti dengan ID Telegram admin
    'bot_username': '@Pepeqk_bot', // Ganti dengan username bot
    'admin_username': '@Rbcdepp', // Ganti dengan username admin
    'approve_text': '✅ APPROVE',
    'reject_text': '❌ REJECT',
    'approve_message': "✅ *SCRIPT DISETUJUI*\n\nScript telah disetujui oleh creator. Bot sekarang aktif dan siap digunakan!",
    'reject_message': "❌ *SCRIPT DITOLAK*\n\nScript tidak disetujui oleh creator. Hubungi admin untuk informasi lebih lanjut.",
    'request_message': "🔐 *PERMINTAAN PERSETUJUAN SCRIPT*\n\nBot membutuhkan persetujuan dari creator sebelum dapat digunakan.",
    'waiting_message': "⏳ *MENUNGGU PERSETUJUAN*\n\nPermintaan approval telah dikirim ke creator. Silahkan tunggu konfirmasi...",
    'timeout_message': "⏰ *WAKTU HABIS*\n\nPersetujuan tidak diterima dalam waktu yang ditentukan. Silahkan coba lagi nanti."
  },
  'creator_id': '7807425271', // Sama dengan admin_id
  'approval_file': './data/approval.json',
  'pending_file': './data/pending_approval.json',
  'check_files': ['./bot.js', './main.js', './index.js'], // File yang akan di-check
  'code_to_detect': 'startBot()' // Kode yang harus ada di file utama
};