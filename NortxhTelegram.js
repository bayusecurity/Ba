const fs = require('fs');
const path = require('path');
const config = require('./NortxhConfig');

class ApprovalSystem {
  constructor(bot) {
    this.bot = bot;
    this.approvalTimeout = null;
    this.pendingRequests = new Map();
    
    // Load existing data
    this.loadData();
  }

  loadData() {
    // Create data directory if not exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }

    // Load approval status
    if (fs.existsSync(config.approval_file)) {
      this.approvalData = JSON.parse(fs.readFileSync(config.approval_file, 'utf8'));
    } else {
      this.approvalData = { approved: false, approved_at: null, approved_by: null };
    }

    // Load pending requests
    if (fs.existsSync(config.pending_file)) {
      this.pendingData = JSON.parse(fs.readFileSync(config.pending_file, 'utf8'));
    } else {
      this.pendingData = { requests: [] };
    }
  }

  saveData() {
    fs.writeFileSync(config.approval_file, JSON.stringify(this.approvalData, null, 2));
    fs.writeFileSync(config.pending_file, JSON.stringify(this.pendingData, null, 2));
  }

  async checkApproval(chatId) {
    if (this.approvalData.approved) {
      return true;
    }

    // Send approval request to admin
    await this.sendApprovalRequest(chatId);
    
    // Inform user
    await this.bot.sendMessage(chatId, config.approval.waiting_message, {
      parse_mode: 'Markdown'
    });

    // Set timeout for approval
    this.approvalTimeout = setTimeout(() => {
      if (!this.approvalData.approved) {
        this.bot.sendMessage(chatId, 
          "⏰ *Waktu persetujuan habis*\n\nScript tidak dapat digunakan tanpa persetujuan creator.",
          { parse_mode: 'Markdown' }
        );
      }
    }, 300000); // 5 minutes timeout

    return false;
  }

  async sendApprovalRequest(userChatId) {
    const requestId = Date.now().toString();
    const user = await this.bot.getChat(userChatId);
    
    // Store pending request
    const request = {
      id: requestId,
      user_id: userChatId,
      username: user.username || 'Unknown',
      first_name: user.first_name || 'User',
      timestamp: new Date().toISOString()
    };

    this.pendingData.requests.push(request);
    this.saveData();

    // Create inline keyboard
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: config.approval.approve_text,
            callback_data: `approve_${requestId}_${userChatId}`
          },
          {
            text: config.approval.reject_text,
            callback_data: `reject_${requestId}_${userChatId}`
          }
        ]
      ]
    };

    // Send to admin
    const message = `🔐 *PERMINTAAN APPROVAL*\n\n` +
                   `👤 *User:* ${user.first_name || 'Unknown'}\n` +
                   `🆔 *ID:* ${userChatId}\n` +
                   `📛 *Username:* @${user.username || 'tidak ada'}\n` +
                   `⏰ *Waktu:* ${new Date().toLocaleString()}\n\n` +
                   `_Klik tombol di bawah untuk memberikan persetujuan:_`;

    await this.bot.sendMessage(config.approval.admin_id, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  async handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;
    const [action, requestId, userId] = data.split('_');
    const adminId = callbackQuery.from.id.toString();

    // Check if caller is admin
    if (adminId !== config.approval.admin_id) {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "Hanya creator yang dapat memberikan persetujuan!",
        show_alert: true
      });
      return;
    }

    // Find request
    const requestIndex = this.pendingData.requests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "Permintaan tidak ditemukan!",
        show_alert: true
      });
      return;
    }

    const request = this.pendingData.requests[requestIndex];

    if (action === 'approve') {
      // Approve the request
      this.approvalData = {
        approved: true,
        approved_at: new Date().toISOString(),
        approved_by: adminId,
        approved_for: userId
      };

      // Remove from pending
      this.pendingData.requests.splice(requestIndex, 1);
      this.saveData();

      // Update callback message
      await this.bot.editMessageText(
        `✅ *APPROVED*\n\n` +
        `Permintaan dari *${request.first_name}* telah disetujui.\n` +
        `🆔 User ID: ${userId}\n` +
        `⏰ Disetujui pada: ${new Date().toLocaleString()}`,
        {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Inform user
      await this.bot.sendMessage(userId, config.approval.approve_message, {
        parse_mode: 'Markdown'
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "Script telah disetujui!",
        show_alert: false
      });

    } else if (action === 'reject') {
      // Reject the request
      this.pendingData.requests.splice(requestIndex, 1);
      this.saveData();

      // Update callback message
      await this.bot.editMessageText(
        `❌ *REJECTED*\n\n` +
        `Permintaan dari *${request.first_name}* telah ditolak.\n` +
        `🆔 User ID: ${userId}\n` +
        `⏰ Ditolak pada: ${new Date().toLocaleString()}`,
        {
          chat_id: callbackQuery.message.chat.id,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        }
      );

      // Inform user
      await this.bot.sendMessage(userId, config.approval.reject_message, {
        parse_mode: 'Markdown'
      });

      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "Script telah ditolak!",
        show_alert: false
      });
    }
  }

  isApproved() {
    return this.approvalData.approved;
  }

  async validateApproval() {
    if (!this.approvalData.approved) {
      return false;
    }

    // Check if approval file exists and is valid
    if (!fs.existsSync(config.approval_file)) {
      this.approvalData.approved = false;
      this.saveData();
      return false;
    }

    return true;
  }

  async checkScriptIntegrity() {
    try {
      if (!fs.existsSync(config.check_file)) {
        throw new Error('File script utama tidak ditemukan');
      }

      const fileContent = fs.readFileSync(config.check_file, 'utf8');
      if (!fileContent.includes(config.code_to_detect)) {
        const errorMsg = "❌ *KESALAHAN INTEGRITAS SCRIPT*\n\n" +
                        "Kode approval tidak ditemukan dalam script utama.\n" +
                        "Silahkan hubungi creator untuk memperbaiki.";
        
        await this.bot.sendMessage(config.approval.admin_id, errorMsg, {
          parse_mode: 'Markdown'
        });
        
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking script integrity:', error);
      return false;
    }
  }

  getApprovalStatus() {
    return {
      approved: this.approvalData.approved,
      approved_at: this.approvalData.approved_at,
      pending_requests: this.pendingData.requests.length
    };
  }

  resetApproval() {
    this.approvalData = { approved: false, approved_at: null, approved_by: null };
    this.pendingData = { requests: [] };
    this.saveData();
    
    if (fs.existsSync(config.approval_file)) {
      fs.unlinkSync(config.approval_file);
    }
    if (fs.existsSync(config.pending_file)) {
      fs.unlinkSync(config.pending_file);
    }
  }
}

module.exports = ApprovalSystem;