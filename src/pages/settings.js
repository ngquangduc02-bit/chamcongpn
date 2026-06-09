// ============================================================
// Settings Page - Admin settings + QR Code generation + Device management
// ============================================================

import { renderNavbar, setupNavbar } from '../components/navbar.js';
import { 
  getSettings, 
  updateSettings, 
  getAllDevices, 
  deactivateDevice, 
  isAdminLoggedIn 
} from '../supabase.js';
import { navigate } from '../utils/router.js';
import { toast } from '../components/toast.js';
import { getCurrentPosition, getIPInfo } from '../utils/location.js';
import { formatDateTime } from '../utils/time.js';
import QRCode from 'qrcode';

export default async function settingsPage(container) {
  // Check admin auth
  if (!isAdminLoggedIn()) {
    navigate('/admin');
    return;
  }

  // Show loading state
  container.innerHTML = renderNavbar() + `
    <main class="main-content">
      <div class="container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Cài Đặt Hệ Thống</h1>
            <p class="page-subtitle">Cấu hình định vị, WiFi, mã QR và thiết bị nhân viên</p>
          </div>
        </div>
        <div class="empty-state">
          <div class="loading-spinner"></div>
          <p>Đang tải cấu hình...</p>
        </div>
      </div>
    </main>
  `;
  setupNavbar();

  try {
    const settings = await getSettings();
    const devices = await getAllDevices();
    
    // Generate check-in URL
    const checkinUrl = `${window.location.origin}${window.location.pathname}#/checkin`;

    container.innerHTML = renderNavbar() + `
      <main class="main-content animate-fade-in">
        <div class="container">
          <div class="page-header">
            <div>
              <h1 class="page-title">Cài Đặt Hệ Thống</h1>
              <p class="page-subtitle">Cấu hình định vị, WiFi, mã QR và quản lý thiết bị</p>
            </div>
          </div>

          <div class="grid-2 gap-4">
            <!-- Cài đặt định vị -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">📍 Định Vị & Bán Kính Chấm Công</h3>
              </div>
              <div class="card-body">
                <form id="settings-geo-form">
                  <div class="form-group">
                    <label class="form-label" for="shop_name">Tên cửa hàng/quán</label>
                    <input type="text" id="shop_name" class="form-input" value="${settings.shop_name || ''}" required />
                  </div>
                  <div class="grid-2 gap-2">
                    <div class="form-group">
                      <label class="form-label" for="shop_lat">Vĩ độ (Latitude)</label>
                      <input type="number" step="any" id="shop_lat" class="form-input" value="${settings.shop_lat || ''}" required />
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="shop_lng">Kinh độ (Longitude)</label>
                      <input type="number" step="any" id="shop_lng" class="form-input" value="${settings.shop_lng || ''}" required />
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="allowed_radius">Bán kính cho phép (mét)</label>
                    <input type="number" id="allowed_radius" class="form-input" value="${settings.allowed_radius || 200}" required />
                  </div>
                  
                  <div class="flex gap-2 mt-3">
                    <button type="button" class="btn btn-outline flex-1" id="get-current-gps-btn">
                      🎯 Lấy GPS hiện tại
                    </button>
                    <button type="submit" class="btn btn-primary flex-1">
                      Lưu định vị
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <!-- Cài đặt IP WiFi -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">🌐 Giới Hạn Theo Địa Chỉ IP (WiFi Quán)</h3>
              </div>
              <div class="card-body">
                <p class="text-secondary mb-3" style="font-size: 0.9rem;">
                  Nếu thêm IP, nhân viên bắt đầu chấm công bắt buộc phải kết nối WiFi của quán. Để trống nếu muốn bỏ qua check IP.
                </p>
                <div class="form-group">
                  <label class="form-label">Danh sách IP được phép</label>
                  <div id="ip-list-container" class="mb-2">
                    ${settings.allowed_ips && settings.allowed_ips.length > 0
                      ? settings.allowed_ips.map(ip => `
                          <div class="flex flex-between align-center p-2 mb-1" style="background: rgba(255,255,255,0.05); border-radius: var(--radius-sm);">
                            <code style="color: var(--accent);">${ip}</code>
                            <button type="button" class="btn btn-outline btn-sm delete-ip-btn" data-ip="${ip}" style="padding: 2px 8px; color: var(--danger); border-color: rgba(239, 68, 68, 0.2)">Xóa</button>
                          </div>
                        `).join('')
                      : '<p class="text-center text-muted p-2">Chưa cấu hình địa chỉ IP nào. Bất kỳ mạng nào cũng có thể chấm công.</p>'
                    }
                  </div>
                  <div class="flex gap-2">
                    <input type="text" id="new-ip-input" class="form-input" placeholder="Nhập địa chỉ IP (VD: 14.162.140.22)" />
                    <button type="button" class="btn btn-primary" id="add-ip-btn">Thêm IP</button>
                  </div>
                  <button type="button" class="btn btn-outline btn-block mt-2" id="add-current-ip-btn">
                    🖥️ Lấy IP mạng hiện tại
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Mã QR Chấm Công -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">🖼️ Mã QR Chấm Công Cố Định</h3>
            </div>
            <div class="card-body">
              <div class="flex flex-col flex-center text-center">
                <p class="text-secondary mb-3">
                  Hãy in mã QR này ra và dán cố định tại quán. Nhân viên quét mã này để truy cập trang chấm công.
                </p>
                
                <div class="qr-code-wrapper p-3 mb-3" style="background: white; border-radius: var(--radius-md); display: inline-block;">
                  <canvas id="qr-canvas"></canvas>
                </div>

                <div class="form-group" style="width: 100%; max-width: 500px;">
                  <input type="text" class="form-input text-center" value="${checkinUrl}" readonly id="checkin-url-input" />
                </div>
                
                <div class="flex gap-2">
                  <button type="button" class="btn btn-primary" id="download-qr-btn">
                    📥 Tải ảnh QR xuống
                  </button>
                  <button type="button" class="btn btn-outline" id="copy-url-btn">
                    📋 Copy đường dẫn
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Quản lý thiết bị (Device Binding) -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">📱 Quản Lý Liên Kết Thiết Bị Nhân Viên</h3>
            </div>
            <div class="card-body">
              <p class="text-secondary mb-3" style="font-size: 0.9rem;">
                Danh sách các điện thoại đã đăng ký để điểm danh. Mỗi thiết bị chỉ được gắn với 1 nhân viên. Nếu nhân viên đổi điện thoại, hãy bấm "Gỡ liên kết" dưới đây.
              </p>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Token thiết bị</th>
                      <th>Thông tin (User Agent)</th>
                      <th>Ngày đăng ký</th>
                      <th>Trạng thái</th>
                      <th class="text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${devices && devices.length > 0
                      ? devices.map(dev => `
                          <tr>
                            <td class="font-semibold">${dev.employees?.name || 'Đã xóa'}</td>
                            <td><code style="font-size:0.8rem; color: var(--text-secondary);">${dev.device_token.slice(0, 8)}...${dev.device_token.slice(-8)}</code></td>
                            <td style="max-width: 200px;" class="truncate" title="${dev.device_info || ''}">${dev.device_info || 'Không rõ'}</td>
                            <td>${formatDateTime(dev.registered_at)}</td>
                            <td>
                              <span class="status-badge ${dev.is_active ? 'status-active' : 'status-inactive'}">
                                ${dev.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                              </span>
                            </td>
                            <td class="text-center">
                              ${dev.is_active 
                                ? `<button class="btn btn-outline btn-sm deactivate-device-btn" data-id="${dev.id}" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2)">Gỡ liên kết</button>`
                                : `<span class="text-muted">—</span>`
                              }
                            </td>
                          </tr>
                        `).join('')
                      : '<tr><td colspan="6" class="text-center text-muted">Chưa có thiết bị nào được liên kết.</td></tr>'
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Cấu hình Telegram -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">🤖 Cấu Hình Tích Hợp Telegram Bot</h3>
            </div>
            <div class="card-body">
              <p class="text-secondary mb-3" style="font-size: 0.9rem; line-height: 1.5;">
                Cấu hình này dùng để tự động báo cáo chấm công vào nhóm Telegram của quán và chạy Bot tra cứu giờ làm cho nhân viên.
              </p>
              
              <form id="settings-telegram-form">
                <div class="form-group">
                  <label class="form-label" for="telegram_bot_token">Telegram Bot Token</label>
                  <input type="text" id="telegram_bot_token" class="form-input" value="${settings.telegram_bot_token || ''}" placeholder="VD: 1234567890:ABCdefGhIJKlmNoPQRsT..." />
                  <small class="text-muted">Lấy từ Chat với @BotFather để tạo bot mới.</small>
                </div>
                
                <div class="form-group">
                  <label class="form-label" for="telegram_group_chat_id">Telegram Group Chat ID (Gửi báo cáo ca làm)</label>
                  <input type="text" id="telegram_group_chat_id" class="form-input" value="${settings.telegram_group_chat_id || ''}" placeholder="VD: -100123456789" />
                  <small class="text-muted">Chat ID của nhóm (thường có dấu trừ ở trước). Thêm Bot của bạn vào nhóm làm Admin để gửi tin.</small>
                </div>

                <div class="form-group mt-2 mb-3 p-3" style="background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); border: 1px solid var(--border-default);">
                  <h4 style="margin: 0 0 8px 0; font-size: 0.9rem; color: var(--accent);">🔗 Hướng dẫn thiết lập Bot tra cứu (Webhook)</h4>
                  <p class="text-secondary" style="font-size: 0.8rem; line-height: 1.5; margin: 0;">
                    Sau khi deploy web lên Vercel, hãy mở trình duyệt và truy cập link sau (thay thế token bot của bạn) để Telegram kết nối tới Bot:<br>
                    <code style="word-break: break-all; color: var(--text-primary);">https://api.telegram.org/bot<b>[TOKEN_BOT]</b>/setWebhook?url=<b>[LINK_VERCEL_CỦA_BẠN]</b>/api/telegram-webhook</code>
                  </p>
                </div>

                <button type="submit" class="btn btn-primary">
                  Lưu cấu hình Telegram
                </button>
              </form>
            </div>
          </div>

          <!-- Đổi mật khẩu admin -->
          <div class="card mt-4">
            <div class="card-header">
              <h3 class="card-title">🔑 Đổi Mật Khẩu Admin</h3>
            </div>
            <div class="card-body">
              <form id="change-pwd-form" style="max-width: 450px;">
                <div class="form-group">
                  <label class="form-label" for="new_password">Mật khẩu mới</label>
                  <input type="password" id="new_password" class="form-input" required placeholder="Nhập mật khẩu mới" minlength="4" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="confirm_password">Xác nhận mật khẩu mới</label>
                  <input type="password" id="confirm_password" class="form-input" required placeholder="Xác nhận lại mật khẩu" minlength="4" />
                </div>
                <button type="submit" class="btn btn-primary">
                  Cập nhật mật khẩu
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
    `;
    setupNavbar();

    // Render QR Code to Canvas
    const canvas = document.getElementById('qr-canvas');
    if (canvas) {
      QRCode.toCanvas(canvas, checkinUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('QR code generation error:', err);
      });
    }

    // --- EVENT LISTENERS ---

    // 1. Get current GPS coordinates
    document.getElementById('get-current-gps-btn').addEventListener('click', async () => {
      const btn = document.getElementById('get-current-gps-btn');
      const oldText = btn.textContent;
      btn.textContent = '⏳ Đang định vị...';
      btn.disabled = true;

      try {
        const pos = await getCurrentPosition();
        document.getElementById('shop_lat').value = pos.lat;
        document.getElementById('shop_lng').value = pos.lng;
        toast.success(`Đã lấy vị trí thành công (Độ chính xác: +/- ${Math.round(pos.accuracy)}m)`);
      } catch (err) {
        toast.error(err.message || 'Lỗi định vị. Vui lòng bật GPS trên thiết bị.');
      } finally {
        btn.textContent = oldText;
        btn.disabled = false;
      }
    });

    // 2. Submit Geo settings
    document.getElementById('settings-geo-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const shop_name = document.getElementById('shop_name').value.trim();
      const shop_lat = parseFloat(document.getElementById('shop_lat').value);
      const shop_lng = parseFloat(document.getElementById('shop_lng').value);
      const allowed_radius = parseInt(document.getElementById('allowed_radius').value, 10);

      try {
        await updateSettings({ shop_name, shop_lat, shop_lng, allowed_radius });
        toast.success('Đã cập nhật cấu hình định vị thành công!');
      } catch (err) {
        toast.error('Lỗi khi lưu cài đặt: ' + err.message);
      }
    });

    // 3. Add Custom IP
    document.getElementById('add-ip-btn').addEventListener('click', async () => {
      const ipInput = document.getElementById('new-ip-input');
      const ipVal = ipInput.value.trim();
      
      // Simple IP regex validation
      const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipPattern.test(ipVal)) {
        toast.warning('Địa chỉ IP không đúng định dạng IPv4!');
        return;
      }

      if (settings.allowed_ips.includes(ipVal)) {
        toast.warning('IP này đã có trong danh sách!');
        return;
      }

      const updatedIps = [...(settings.allowed_ips || []), ipVal];

      try {
        await updateSettings({ allowed_ips: updatedIps });
        toast.success(`Đã thêm IP ${ipVal}`);
        settingsPage(container); // Reload page
      } catch (err) {
        toast.error('Lỗi thêm IP: ' + err.message);
      }
    });

    // 4. Add Current IP
    document.getElementById('add-current-ip-btn').addEventListener('click', async () => {
      const btn = document.getElementById('add-current-ip-btn');
      btn.disabled = true;
      btn.textContent = '⏳ Đang lấy IP...';

      try {
        const ipInfo = await getIPInfo();
        if (ipInfo.ip && ipInfo.ip !== 'unknown') {
          if (settings.allowed_ips.includes(ipInfo.ip)) {
            toast.warning(`IP hiện tại (${ipInfo.ip}) đã có trong danh sách.`);
          } else {
            const updatedIps = [...(settings.allowed_ips || []), ipInfo.ip];
            await updateSettings({ allowed_ips: updatedIps });
            toast.success(`Đã thêm IP hiện tại: ${ipInfo.ip}`);
            settingsPage(container); // Reload page
          }
        } else {
          toast.error('Không tìm thấy IP của bạn. Thử gõ thủ công.');
        }
      } catch (err) {
        toast.error('Lỗi lấy IP: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = '🖥️ Lấy IP mạng hiện tại';
      }
    });

    // 5. Delete IP
    document.querySelectorAll('.delete-ip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ipToDelete = btn.getAttribute('data-ip');
        const updatedIps = settings.allowed_ips.filter(ip => ip !== ipToDelete);

        try {
          await updateSettings({ allowed_ips: updatedIps });
          toast.success(`Đã xóa IP ${ipToDelete}`);
          settingsPage(container); // Reload page
        } catch (err) {
          toast.error('Lỗi xóa IP: ' + err.message);
        }
      });
    });

    // 6. Copy URL
    document.getElementById('copy-url-btn').addEventListener('click', () => {
      const copyText = document.getElementById('checkin-url-input');
      copyText.select();
      copyText.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(copyText.value);
      toast.success('Đã copy URL check-in vào clipboard!');
    });

    // 7. Download QR image
    document.getElementById('download-qr-btn').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = 'chamcong-qr-code.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Đang tải ảnh mã QR...');
    });

    // 8. Deactivate Device
    document.querySelectorAll('.deactivate-device-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const deviceId = btn.getAttribute('data-id');
        if (confirm('Bạn có chắc chắn muốn gỡ liên kết thiết bị này? Nhân viên sở hữu thiết bị này sẽ phải đăng ký lại trên điện thoại của họ.')) {
          try {
            await deactivateDevice(deviceId);
            toast.success('Đã gỡ liên kết thiết bị thành công!');
            settingsPage(container); // Reload
          } catch (err) {
            toast.error('Lỗi: ' + err.message);
          }
        }
      });
    });

    // 9. Change Password
    document.getElementById('change-pwd-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const new_password = document.getElementById('new_password').value;
      const confirm_password = document.getElementById('confirm_password').value;

      if (new_password !== confirm_password) {
        toast.warning('Mật khẩu xác nhận không trùng khớp!');
        return;
      }

      try {
        await updateSettings({ admin_password: new_password });
        toast.success('Thay đổi mật khẩu admin thành công!');
        document.getElementById('change-pwd-form').reset();
      } catch (err) {
        toast.error('Lỗi đổi mật khẩu: ' + err.message);
      }
    });

    // 10. Submit Telegram settings
    document.getElementById('settings-telegram-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const botToken = document.getElementById('telegram_bot_token').value.trim();
      const groupChatId = document.getElementById('telegram_group_chat_id').value.trim();

      try {
        await updateSettings({ 
          telegram_bot_token: botToken || null, 
          telegram_group_chat_id: groupChatId || null 
        });
        toast.success('Đã lưu cấu hình Telegram thành công!');
        
        if (botToken) {
          toast.info('Hãy thiết lập Webhook Telegram theo hướng dẫn để bắt đầu sử dụng Bot!');
        }
      } catch (err) {
        toast.error('Lỗi khi lưu cấu hình Telegram: ' + err.message);
      }
    });

  } catch (error) {
    console.error('Settings page error:', error);
    container.innerHTML = renderNavbar() + `
      <main class="main-content">
        <div class="container">
          <div class="card mt-4" style="border-color: var(--danger)">
            <div class="card-body text-center">
              <h2 class="text-danger mb-2">Lỗi tải dữ liệu cài đặt</h2>
              <p class="text-secondary mb-3">${error.message || 'Kiểm tra cấu hình Supabase của bạn.'}</p>
              <button class="btn btn-primary" onclick="location.reload()">Thử lại</button>
            </div>
          </div>
        </div>
      </main>
    `;
    setupNavbar();
  }
}
