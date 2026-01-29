module.exports = {
  'approval': {
    'admin_id': '7807425271', // ID Telegram admin/creator
    'approve_text': '✅ APPROVE',
    'reject_text': '❌ REJECT',
    'approve_message': "✅ *SCRIPT DISETUJUI*\n\nScript telah disetujui oleh creator. Silahkan restart bot atau jalankan ulang script.",
    'reject_message': "❌ *SCRIPT DITOLAK*\n\nScript tidak disetujui oleh creator.",
    'request_message': "🔐 *PERMINTAAN PERSETUJUAN SCRIPT*\n\nScript membutuhkan persetujuan dari creator sebelum dapat digunakan.",
    'waiting_message': "⏳ *MENUNGGU PERSETUJUAN*\n\nSilahkan tunggu persetujuan dari creator..."
  },
  'creator_id': '7807425271',
  'approval_file': './data/approval.json',
  'pending_file': './data/pending_approval.json',
  'check_file': './Nortxh.js',
  'code_to_detect': 'startBot();'
};