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
    
    // Auto-check integrity every 6 hours
    setInterval(() => this.checkScriptIntegrity(), 6 * 60 * 60 * 1000);
  }

  loadData() {
    // Create data directory if not exists
    const dataDir = path.dirname(config.approval_file);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load approval status
    try {
      if (fs.existsSync(config.approval_file)) {
        this.approvalData = JSON.parse(fs.readFileSync(config.approval_file, 'utf8'));
        console.log('✅ Approval data loaded');
      } else {
        this.approvalData = { 
          approved: false, 
          approved_at: null, 
          approved_by: null,
          user_id: null 
        };
      }
    } catch (error) {
      console.error('Error loading approval data:', error);
      this.approvalData = { 
        approved: false, 
        approved_at: null, 
        approved_by: null,
        user_id: null 
      };
    }

    // Load pending requests
    try {
      if (fs.existsSync(config.pending_file)) {
        this.pendingData = JSON.parse(fs.readFileSync(config.pending_file, 'utf8'));
        console.log(`📋 Pending requests: ${this.pendingData.requests?.length || 0}`);
      } else {
        this.pendingData = { requests: [] };
      }
    } catch (error) {
      console.error('Error loading pending data:', error);
      this.pendingData = { requests: [] };
    }
  }

  saveData() {
    try {
      fs.writeFileSync(config.approval_file, JSON.stringify(this.approvalData, null, 2));
      fs.writeFileSync(config.pending_file, JSON.stringify(this.pendingData, null, 2));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  async checkApproval(chatId) {
    console.log(`🔍 Checking approval for chat ID: ${chatId}`);
    
    if (this.approvalData.approved) {
      console.log('✅ Script already approved');
      return true;
    }

    // Kirim pesan ke user
    await this.bot.sendMessage(chatId, config.approval.request_message, {
      parse_mode: 'Markdown'
    });

    // Kirim approval request ke admin
    const requestSent = await this.sendApprovalRequest(chatId);
    
    if (requestSent) {
      await this.bot.sendMessage(chatId, config.approval.waiting_message, {
        parse_mode: 'Markdown'
      });

      // Set timeout for approval (10 menit)
      this.approvalTimeout = setTimeout(async () => {
        if (!this.approvalData.approved) {
          console.log(`⏰ Approval timeout for chat ID: ${chatId}`);
          await this.bot.sendMessage(chatId, config.approval.timeout_message, {
            parse_mode: 'Markdown'
          });
        }
      }, 10 * 60 * 1000);
    }

    return false;
  }

  async sendApprovalRequest(userChatId) {
    try {
      const requestId = Date.now().toString();
      let userInfo = {};
      
      try {
        userInfo = await this.bot.getChat(userChatId);
      } catch (error) {
        console.warn(`Could not get user info for ${userChatId}:`, error.message);
        userInfo = {
          id: userChatId,
          first_name: 'User',
          username: 'unknown'
        };
      }

      // Store pending request
      const request = {
        id: requestId,
        user_id: userChatId,
        username: userInfo.username || 'tidak_ada',
        first_name: userInfo.first_name || 'User',
        last_name: userInfo.last_name || '',
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
          ],
          [
            {
              text: '📋 Lihat Semua Request',
              callback_data: 'view_all_requests'
            }
          ]
        ]
      };

      // Send to admin
      const message = `🔐 *PERMINTAAN APPROVAL BOT*\n\n` +
                     `👤 *User:* ${userInfo.first_name || 'Unknown'}\n` +
                     `🆔 *ID:* ${userChatId}\n` +
                     `📛 *Username:* @${userInfo.username || 'tidak_ada'}\n` +
                     `📅 *Waktu:* ${new Date().toLocaleString('id-ID')}\n` +
                     `⏳ *Status:* Menunggu persetujuan\n\n` +
                     `_Klik tombol di bawah untuk memberikan persetujuan:_`;

      await this.bot.sendMessage(config.approval.admin_id, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      console.log(`📤 Approval request sent to admin for user ${userChatId}`);
      return true;
    } catch (error) {
      console.error('Error sending approval request:', error);
      return false;
    }
  }

  async handleCallbackQuery(callbackQuery) {
    try {
      const data = callbackQuery.data;
      const [action, requestId, userId] = data.split('_');
      const adminId = callbackQuery.from.id.toString();

      console.log(`🔄 Handling callback: ${action} for request ${requestId}`);

      // Check if caller is admin
      if (adminId !== config.approval.admin_id) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ Hanya creator yang dapat memberikan persetujuan!",
          show_alert: true
        });
        return;
      }

      // Find request
      const requestIndex = this.pendingData.requests.findIndex(r => r.id === requestId);
      if (requestIndex === -1) {
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: "❌ Permintaan tidak ditemukan atau sudah diproses!",
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
          user_id: userId,
          user_info: {
            username: request.username,
            first_name: request.first_name
          }
        };

        // Remove from pending
        this.pendingData.requests.splice(requestIndex, 1);
        this.saveData();

        // Update callback message
        const approveTime = new Date().toLocaleString('id-ID');
        await this.bot.editMessageText(
          `✅ *APPROVED - REQUEST #${requestId}*\n\n` +
          `👤 *User:* ${request.first_name}\n` +
          `🆔 *ID:* ${userId}\n` +
          `📛 *Username:* @${request.username}\n` +
          `⏰ *Disetujui pada:* ${approveTime}\n` +
          `📊 *Sisa request:* ${this.pendingData.requests.length}`,
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
          text: "✅ Script telah disetujui!",
          show_alert: false
        });

        // Clear timeout jika ada
        if (this.approvalTimeout) {
          clearTimeout(this.approvalTimeout);
          this.approvalTimeout = null;
        }

        console.log(`✅ Request ${requestId} approved by admin`);

      } else if (action === 'reject') {
        // Reject the request
        this.pendingData.requests.splice(requestIndex, 1);
        this.saveData();

        // Update callback message
        const rejectTime = new Date().toLocaleString('id-ID');
        await this.bot.editMessageText(
          `❌ *REJECTED - REQUEST #${requestId}*\n\n` +
          `👤 *User:* ${request.first_name}\n` +
          `🆔 *ID:* ${userId}\n` +
          `📛 *Username:* @${request.username}\n` +
          `⏰ *Ditolak pada:* ${rejectTime}\n` +
          `📊 *Sisa request:* ${this.pendingData.requests.length}`,
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
          text: "❌ Script telah ditolak!",
          show_alert: false
        });

        console.log(`❌ Request ${requestId} rejected by admin`);
      }

    } catch (error) {
      console.error('Error handling callback query:', error);
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: "❌ Terjadi kesalahan saat memproses!",
        show_alert: true
      });
    }
  }

  isApproved() {
    return this.approvalData.approved === true;
  }

  async validateApproval() {
    // Cek file approval masih ada
    if (!fs.existsSync(config.approval_file)) {
      this.approvalData.approved = false;
      this.saveData();
      return false;
    }

    // Cek data approval valid
    if (!this.approvalData || typeof this.approvalData.approved !== 'boolean') {
      return false;
    }

    return this.approvalData.approved;
  }

  async checkScriptIntegrity() {
    try {
      console.log('🔍 Checking script integrity...');
      
      let found = false;
      let errorMessage = '';
      
      // Cek setiap file yang ditentukan
      for (const filePath of config.check_files) {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          if (fileContent.includes(config.code_to_detect)) {
            console.log(`✅ Integrity check passed for: ${filePath}`);
            found = true;
            
            // Juga cek apakah file utama memiliki kode penting lainnya
            const requiredCodes = [
              'const bot =',
              'bot.onText',
              'bot.on',
              'TelegramBot'
            ];
            
            for (const code of requiredCodes) {
              if (fileContent.includes(code)) {
                console.log(`✅ Found required code: ${code}`);
              }
            }
          } else {
            errorMessage += `❌ Kode "${config.code_to_detect}" tidak ditemukan di: ${filePath}\n`;
          }
        } else {
          errorMessage += `❌ File tidak ditemukan: ${filePath}\n`;
        }
      }
      
      if (!found && errorMessage) {
        console.error('❌ Script integrity check failed');
        
        // Kirim notifikasi ke admin
        await this.bot.sendMessage(config.approval.admin_id, 
          `❌ *KESALAHAN INTEGRITAS SCRIPT*\n\n` +
          `Integritas script tidak valid!\n\n` +
          `*Detail:*\n${errorMessage}\n` +
          `*Waktu:* ${new Date().toLocaleString('id-ID')}`,
          { parse_mode: 'Markdown' }
        );
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in script integrity check:', error);
      
      // Kirim error ke admin
      await this.bot.sendMessage(config.approval.admin_id,
        `⚠️ *ERROR CHECKING SCRIPT INTEGRITY*\n\n` +
        `Terjadi kesalahan saat mengecek integritas script:\n` +
        `\`${error.message}\`\n\n` +
        `*Waktu:* ${new Date().toLocaleString('id-ID')}`,
        { parse_mode: 'Markdown' }
      );
      
      return false;
    }
  }

  getApprovalStatus() {
    return {
      approved: this.approvalData.approved,
      approved_at: this.approvalData.approved_at,
      approved_by: this.approvalData.approved_by,
      pending_requests: this.pendingData.requests.length,
      total_approved: this.approvalData.approved ? 1 : 0
    };
  }

  resetApproval() {
    this.approvalData = { 
      approved: false, 
      approved_at: null, 
      approved_by: null,
      user_id: null 
    };
    this.pendingData = { requests: [] };
    this.saveData();
    
    // Hapus file jika ada
    if (fs.existsSync(config.approval_file)) {
      fs.unlinkSync(config.approval_file);
    }
    if (fs.existsSync(config.pending_file)) {
      fs.unlinkSync(config.pending_file);
    }
    
    console.log('🔄 Approval system reset');
  }
}

module.exports = ApprovalSystem;