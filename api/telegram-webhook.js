import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

export default async function handler(req, res) {
  // Telegram calls webhook via POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message || !message.text) {
    return res.status(200).send('OK');
  }

  const chatId = message.chat.id.toString();
  const text = message.text.trim();
  const senderName = message.from.first_name || 'Nhân viên';

  try {
    // 1. Fetch settings to get Bot Token
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings || !settings.telegram_bot_token) {
      console.warn('Telegram Bot Token not configured in settings.');
      return res.status(200).send('OK');
    }

    const botToken = settings.telegram_bot_token;

    // Helper to send reply back to user
    const sendReply = async (replyText) => {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText,
            parse_mode: 'HTML',
          }),
        });
      } catch (err) {
        console.error('Failed to send Telegram message:', err);
      }
    };

    // Command: /start or /start [PIN]
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/);
      if (parts.length === 1) {
        await sendReply(
          `👋 Xin chào <b>${senderName}</b>! Tôi là Bot Chấm Công.\n\nĐể xem lịch sử làm việc trên đây, hãy liên kết tài khoản bằng cách nhập:\n👉 <code>/start [MÃ_PIN_CỦA_BẠN]</code>\n\nVí dụ: <code>/start 1234</code>`
        );
      } else {
        const pin = parts[1];
        // Search employee by PIN
        const { data: employees, error: empError } = await supabase
          .from('employees')
          .select('*')
          .eq('pin', pin)
          .eq('is_active', true)
          .limit(1);

        if (empError || !employees || employees.length === 0) {
          await sendReply(`❌ Không tìm thấy nhân viên nào có mã PIN là <b>${pin}</b> hoặc nhân viên đã bị khóa.`);
        } else {
          const employee = employees[0];
          
          // Update employee with Telegram chat ID
          const { error: updateError } = await supabase
            .from('employees')
            .update({ telegram_chat_id: chatId })
            .eq('id', employee.id);

          if (updateError) {
            await sendReply(`❌ Lỗi liên kết: ${updateError.message}`);
          } else {
            await sendReply(
              `✅ <b>Liên kết thành công!</b>\n\nXin chào <b>${employee.name}</b>. Bây giờ bạn có thể sử dụng các lệnh sau:\n📅 <code>/lichsu</code> - Xem tổng giờ làm và nhật ký tháng này.\n🟢 <code>/status</code> - Kiểm tra xem bạn có đang trong ca làm việc không.`
            );
          }
        }
      }
      return res.status(200).send('OK');
    }

    // Check if employee is linked for this chat ID
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('telegram_chat_id', chatId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (empError || !emp) {
      await sendReply(
        `❌ Thiết bị này chưa được liên kết. Vui lòng liên kết tài khoản trước bằng cách nhập:\n👉 <code>/start [MÃ_PIN]</code>`
      );
      return res.status(200).send('OK');
    }

    // Command: /lichsu (Monthly breakdown)
    if (text === '/lichsu') {
      const now = new Date();
      // Adjust to UTC+7 Range
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      const { data: records, error: recError } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('check_in', start)
        .lte('check_in', end)
        .order('check_in', { ascending: false });

      if (recError) {
        await sendReply(`❌ Lỗi truy vấn dữ liệu: ${recError.message}`);
        return res.status(200).send('OK');
      }

      let totalHours = 0;
      let logText = '';

      if (records && records.length > 0) {
        records.forEach((r, i) => {
          if (r.check_out) {
            const duration = (new Date(r.check_out) - new Date(r.check_in)) / (1000 * 60 * 60);
            const hours = r.total_hours != null ? Number(r.total_hours) : duration;
            totalHours += hours;

            const d = new Date(r.check_in);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            
            // Format check-in/out times in UTC+7
            const checkinTime = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            const checkoutTime = new Date(r.check_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            
            const deductionText = r.deducted_minutes > 0 ? ` (trừ ${r.deducted_minutes}p)` : '';
            logText += `${i + 1}. Ngày ${dateStr} (${checkinTime} - ${checkoutTime}): <b>${hours.toFixed(1)}h</b>${deductionText}\n`;
          }
        });
      }

      const msg = `📅 <b>Lịch sử chấm công: ${emp.name}</b>\nTháng ${now.getMonth() + 1}/${now.getFullYear()}\n\n⏱️ Tổng giờ làm: <b>${totalHours.toFixed(1)} giờ</b>\n\nChi tiết:\n${logText || 'Chưa có ca làm nào được hoàn thành.'}`;
      await sendReply(msg);
      return res.status(200).send('OK');
    }

    // Command: /status
    if (text === '/status') {
      const { data: activeShift } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1);

      if (activeShift && activeShift.length > 0) {
        const timeStr = new Date(activeShift[0].check_in).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        await sendReply(`🟢 Trạng thái: <b>Đang làm việc</b>\n- Check-in từ: <b>${timeStr}</b>`);
      } else {
        await sendReply(`🔴 Trạng thái: <b>Đang nghỉ ca</b>\n- Chưa thực hiện check-in.`);
      }
      return res.status(200).send('OK');
    }

    // Default help message
    await sendReply(
      `🤖 <b>Danh sách lệnh khả dụng:</b>\n\n📅 <code>/lichsu</code> - Xem tổng giờ làm tháng này\n🟢 <code>/status</code> - Xem ca làm hiện tại\n🔑 <code>/start [PIN]</code> - Kết nối lại tài khoản`
    );

  } catch (err) {
    console.error('Telegram Serverless Webhook Error:', err);
  }

  return res.status(200).send('OK');
}
