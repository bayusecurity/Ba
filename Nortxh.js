async checkScriptIntegrity() {
  try {
    console.log('🔍 Running script integrity check...');
    
    // Jika tidak ada file yang perlu di-check, return true
    if (!config.check_files || config.check_files.length === 0) {
      console.log('⚠️ No files to check, skipping integrity check');
      return true;
    }
    
    // Jika code_to_detect kosong, skip check
    if (!config.code_to_detect || config.code_to_detect.trim() === '') {
      console.log('⚠️ No code to detect, skipping integrity check');
      return true;
    }
    
    let foundValidFile = false;
    const errors = [];
    
    for (const filePath of config.check_files) {
      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          // Cek apakah kode ada di file
          if (fileContent.includes(config.code_to_detect)) {
            console.log(`✅ Integrity check PASSED for: ${filePath}`);
            console.log(`   Found: "${config.code_to_detect}"`);
            foundValidFile = true;
            break; // Cukup satu file yang valid
          } else {
            errors.push(`❌ "${config.code_to_detect}" not found in: ${filePath}`);
          }
        } else {
          errors.push(`❌ File not found: ${filePath}`);
        }
      } catch (fileError) {
        errors.push(`❌ Error reading ${filePath}: ${fileError.message}`);
      }
    }
    
    if (!foundValidFile) {
      console.error('❌ Script integrity check FAILED');
      console.error('Errors:', errors.join('\n'));
      
      // Kirim notifikasi ke admin
      try {
        await this.bot.sendMessage(config.approval.admin_id,
          `❌ *INTEGRITY CHECK FAILED*\n\n` +
          `Could not find code: "${config.code_to_detect}"\n\n` +
          `*Possible solutions:*\n` +
          `1. Add "${config.code_to_detect}" to main file\n` +
          `2. Change code_to_detect in config\n` +
          `3. Disable integrity check\n\n` +
          `*Errors:*\n${errors.join('\n').substring(0, 1000)}`,
          { parse_mode: 'Markdown' }
        );
      } catch (notifError) {
        console.error('Could not send notification:', notifError);
      }
      
      return false;
    }
    
    console.log('✅ All integrity checks passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Error in integrity check:', error);
    
    // Jangan blokir bot jika error check
    // Return true untuk memungkinkan bot tetap jalan
    console.log('⚠️ Allowing bot to continue despite integrity check error');
    return true;
  }
}
