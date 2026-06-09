// ============================================================
// Check-In Page - Trang chấm công nhân viên
// ============================================================

import {
  getEmployees,
  getDeviceByToken,
  registerDevice,
  verifyEmployeePin,
  checkIn,
  checkOut,
  getActiveAttendance,
  getAttendanceByDate,
  getSettings,
} from '../supabase.js';
import { navigate } from '../utils/router.js';
import { getCurrentPosition, getIPInfo, verifyLocation, verifyIP } from '../utils/location.js';
import { formatTime, formatHours, formatDate, calculateHours, getTodayRange, getCurrentMonthRange } from '../utils/time.js';
import { toast } from '../components/toast.js';
import { showModal, closeModal } from '../components/modal.js';

const DEVICE_TOKEN_KEY = 'chamcong_device_token';

// ============================================================
// Render helpers
// ============================================================

function renderRegistrationPage() {
  return `
    <div class="checkin-page">
      <div class="checkin-container">
        <div class="checkin-brand">
          <div class="checkin-logo">⏰</div>
          <h1 class="checkin-title">Chấm Công</h1>
          <p class="checkin-subtitle">Đăng ký thiết bị để bắt đầu</p>
        </div>

        <div class="card register-card">
          <h2 class="register-heading">📱 Đăng ký thiết bị</h2>

          <form id="register-form">
            <div class="form-group">
              <label class="form-label" for="employee-select">Chọn nhân viên</label>
              <select id="employee-select" class="form-input form-select" required>
                <option value="">-- Chọn tên của bạn --</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="pin-input">Mã PIN (4-6 số)</label>
              <input
                type="password"
                id="pin-input"
                class="form-input pin-input"
                inputmode="numeric"
                pattern="[0-9]{4,6}"
                minlength="4"
                maxlength="6"
                placeholder="Nhập mã PIN"
                autocomplete="off"
                required
              />
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="register-btn">
              <span id="register-btn-text">Đăng ký thiết bị</span>
              <span id="register-btn-loading" class="hidden">⏳ Đang xử lý...</span>
            </button>
          </form>
        </div>

        <div class="checkin-footer">
          <a href="#/admin" class="admin-link">Quản lý →</a>
        </div>
      </div>
    </div>
  `;
}

function renderCheckinPage(employee, activeAttendance, todayRecords) {
  const nameInitial = (employee.name || '?').charAt(0).toUpperCase();
  const isCheckedIn = !!activeAttendance;

  // Today summary
  let todayTotalHours = 0;
  let todaySessionCount = 0;
  if (todayRecords && todayRecords.length > 0) {
    todayRecords.forEach((r) => {
      if (r.check_in && r.check_out) {
        todayTotalHours += calculateHours(r.check_in, r.check_out);
        todaySessionCount++;
      }
    });
  }

  const checkinTime = isCheckedIn ? formatTime(activeAttendance.check_in) : null;

  return `
    <div class="checkin-page">
      <div class="checkin-container">

        <!-- Header / Greeting -->
        <div class="checkin-greeting">
          <div class="avatar-initial">${nameInitial}</div>
          <h1 class="greeting-name">Xin chào, ${employee.name}!</h1>
          <p class="greeting-role">${employee.position || 'Nhân viên'}</p>
        </div>

        <!-- Live Clock -->
        <div class="live-clock-section">
          <div class="live-clock" id="live-clock">--:--:--</div>
          <div class="live-date" id="live-date">---</div>
        </div>

        <!-- Check-in / Check-out button -->
        <div class="checkin-action" id="checkin-action">
          ${isCheckedIn ? `
            <div class="checked-in-info">
              <span class="checkin-time-label">Đã vào lúc</span>
              <span class="checkin-time-value">${checkinTime}</span>
            </div>
            <div class="elapsed-time" id="elapsed-time">Đang tính...</div>
            <button class="checkin-btn checkin-btn-out" id="action-btn" data-attendance-id="${activeAttendance.id}">
              <span class="checkin-btn-icon">🚪</span>
              <span class="checkin-btn-label">CHECK OUT</span>
            </button>
          ` : `
            <button class="checkin-btn checkin-btn-in" id="action-btn">
              <span class="checkin-btn-icon">👋</span>
              <span class="checkin-btn-label">CHECK IN</span>
            </button>
          `}
        </div>

        <!-- Location status -->
        <div class="location-status" id="location-status">
          <span class="location-icon">📍</span>
          <span class="location-text">Sẵn sàng xác minh vị trí</span>
        </div>

        <!-- Today summary -->
        <div class="card today-summary">
          <h3 class="summary-title">📊 Hôm nay</h3>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-value" id="today-hours">${formatHours(todayTotalHours)}</span>
              <span class="summary-label">Tổng giờ làm</span>
            </div>
            <div class="summary-item">
              <span class="summary-value" id="today-sessions">${todaySessionCount}</span>
              <span class="summary-label">Phiên hoàn tất</span>
            </div>
          </div>

          ${todayRecords && todayRecords.length > 0 ? `
            <div class="summary-history">
              <h4 class="history-title">Lịch sử hôm nay</h4>
              ${todayRecords.map((r) => `
                <div class="history-row">
                  <span class="history-time">${formatTime(r.check_in)} → ${r.check_out ? formatTime(r.check_out) : '...'}</span>
                  <span class="history-hours">${r.check_out ? formatHours(calculateHours(r.check_in, r.check_out)) : 'Đang làm'}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="summary-empty">Chưa có phiên làm việc nào hôm nay</p>
          `}
        </div>

        </div>
        
        <!-- Xem lịch sử tháng này (Nhân viên tự xem) -->
        <div style="width: 100%; max-width: 320px; margin: 0 auto;">
          <button class="btn btn-outline btn-block mt-2" id="view-history-btn">
            📅 Xem lịch sử tháng này
          </button>
        </div>

        <!-- Footer -->
        <div class="checkin-footer">
          <button class="btn btn-sm btn-outline" id="unlink-device-btn">Hủy liên kết thiết bị</button>
          <a href="#/admin" class="admin-link">Quản lý →</a>
        </div>
      </div>
    </div>
  `;
}

function renderLoading() {
  return `
    <div class="checkin-page">
      <div class="checkin-container" style="justify-content:center;align-items:center;min-height:80vh;">
        <div class="loading-spinner">⏳</div>
        <p style="color:var(--text);margin-top:1rem;">Đang tải...</p>
      </div>
    </div>
  `;
}

// ============================================================
// Main page export
// ============================================================

export default async function checkinPage(container) {
  // Interval / timer handles for cleanup
  let clockInterval = null;
  let elapsedInterval = null;
  let destroyed = false;

  // Show loading first
  container.innerHTML = renderLoading();

  const deviceToken = localStorage.getItem(DEVICE_TOKEN_KEY);

  // ─── No token → registration flow ───────────────────────
  if (!deviceToken) {
    await showRegistration(container);
    return () => { destroyed = true; };
  }

  // ─── Has token → lookup device / employee ───────────────
  try {
    const device = await getDeviceByToken(deviceToken);

    if (!device) {
      // Token invalid / deactivated
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      toast.warning('Thiết bị đã bị hủy liên kết. Vui lòng đăng ký lại.');
      await showRegistration(container);
      return () => { destroyed = true; };
    }

    const employee = device.employees; // joined data
    const employeeId = employee.id;

    // Fetch active attendance + today records in parallel
    const { start, end } = getTodayRange();
    const [activeAttendance, todayRecords] = await Promise.all([
      getActiveAttendance(employeeId).catch(() => null),
      getAttendanceByDate(start, end, employeeId).catch(() => []),
    ]);

    if (destroyed) return;

    // Render main UI
    container.innerHTML = renderCheckinPage(employee, activeAttendance, todayRecords);

    // ─── Live clock ──────────────────────────────────────
    const clockEl = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');

    function updateClock() {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Ho_Chi_Minh',
        });
      }
      if (dateEl) {
        const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        dateEl.textContent = `${days[now.getDay()]}, ${now.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Ho_Chi_Minh',
        })}`;
      }
    }
    updateClock();
    clockInterval = setInterval(updateClock, 1000);

    // ─── Elapsed timer (if checked in) ───────────────────
    if (activeAttendance) {
      const elapsedEl = document.getElementById('elapsed-time');
      function updateElapsed() {
        if (!elapsedEl) return;
        const ms = Date.now() - new Date(activeAttendance.check_in).getTime();
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        elapsedEl.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }
      updateElapsed();
      elapsedInterval = setInterval(updateElapsed, 1000);
    }

    // ─── Check-in / Check-out handler ────────────────────
    const actionBtn = document.getElementById('action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', async () => {
        actionBtn.disabled = true;
        actionBtn.classList.add('checkin-btn-loading');

        const locationStatus = document.getElementById('location-status');

        try {
          // 1. Get GPS
          let lat = null;
          let lng = null;
          try {
            if (locationStatus) {
              locationStatus.innerHTML = '<span class="location-icon">📡</span><span class="location-text">Đang lấy vị trí GPS...</span>';
            }
            const pos = await getCurrentPosition();
            lat = pos.lat;
            lng = pos.lng;
          } catch (gpsErr) {
            console.warn('GPS error:', gpsErr.message);
            if (locationStatus) {
              locationStatus.innerHTML = '<span class="location-icon">⚠️</span><span class="location-text">Không lấy được GPS, tiếp tục...</span>';
            }
          }

          // 2. Get IP
          let ip = 'unknown';
          try {
            if (locationStatus) {
              const prevText = locationStatus.querySelector('.location-text');
              if (prevText) prevText.textContent = 'Đang kiểm tra IP...';
            }
            const ipInfo = await getIPInfo();
            ip = ipInfo.ip;
          } catch (ipErr) {
            console.warn('IP error:', ipErr.message);
          }

          // 3. Verify location + IP against settings
          const settings = await getSettings();

          // Location check
          if (settings.shop_lat && settings.shop_lng) {
            if (lat != null && lng != null) {
              const radius = settings.allowed_radius || 200;
              const locResult = verifyLocation(lat, lng, settings.shop_lat, settings.shop_lng, radius);
              if (!locResult.valid) {
                if (locationStatus) {
                  locationStatus.innerHTML = `<span class="location-icon">❌</span><span class="location-text">Ngoài phạm vi (${locResult.distance}m)</span>`;
                }
                throw new Error(`Bạn đang cách quán ${locResult.distance}m (giới hạn ${radius}m). Không thể chấm công!`);
              } else {
                if (locationStatus) {
                  locationStatus.innerHTML = `<span class="location-icon">✅</span><span class="location-text">Vị trí hợp lệ (${locResult.distance}m)</span>`;
                }
              }
            } else {
              if (locationStatus) {
                locationStatus.innerHTML = `<span class="location-icon">❌</span><span class="location-text">Không lấy được vị trí GPS</span>`;
              }
              throw new Error('Không thể lấy vị trí GPS của bạn. Vui lòng bật GPS trên điện thoại và cho phép trình duyệt truy cập vị trí!');
            }
          }

          // IP check
          if (settings.allowed_ips && settings.allowed_ips.length > 0) {
            const ipValid = verifyIP(ip, settings.allowed_ips);
            if (!ipValid) {
              throw new Error(`IP hiện tại (${ip}) không nằm trong danh sách WiFi được phép của quán!`);
            }
          }

          // 4. Perform check-in or check-out
          if (activeAttendance) {
            // CHECK OUT
            const record = await checkOut(activeAttendance.id, lat, lng, ip);
            toast.success('Check-out thành công! 🎉');
            sendTelegramNotification(employee.name, false, record.total_hours, record.deducted_minutes);
          } else {
            // CHECK IN
            await checkIn(employeeId, lat, lng, ip);
            toast.success('Check-in thành công! 💪');
            sendTelegramNotification(employee.name, true);
          }

          // 5. Reload the page to reflect new state
          if (!destroyed) {
            // Short delay for toast visibility
            setTimeout(() => {
              if (!destroyed) checkinPage(container);
            }, 600);
          }
        } catch (err) {
          console.error('Check-in/out error:', err);
          toast.error('Lỗi: ' + (err.message || 'Không thể chấm công. Vui lòng thử lại.'));
          actionBtn.disabled = false;
          actionBtn.classList.remove('checkin-btn-loading');
        }
      });
    }

    // ─── View month history button ────────────────────────
    const viewHistoryBtn = document.getElementById('view-history-btn');
    if (viewHistoryBtn) {
      viewHistoryBtn.addEventListener('click', () => {
        showMonthHistoryModal(employeeId, employee.name);
      });
    }

    // ─── Unlink device button ────────────────────────────
    const unlinkBtn = document.getElementById('unlink-device-btn');
    if (unlinkBtn) {
      unlinkBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn hủy liên kết thiết bị này? Bạn sẽ cần đăng ký lại.')) {
          localStorage.removeItem(DEVICE_TOKEN_KEY);
          toast.info('Đã hủy liên kết thiết bị.');
          checkinPage(container);
        }
      });
    }
  } catch (err) {
    console.error('Checkin page error:', err);
    container.innerHTML = `
      <div class="checkin-page">
        <div class="checkin-container" style="justify-content:center;align-items:center;min-height:80vh;">
          <div class="empty-state">
            <div class="empty-state-icon">❌</div>
            <h2>Lỗi kết nối</h2>
            <p>${err.message || 'Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng.'}</p>
            <button class="btn btn-primary" onclick="location.reload()">Thử lại</button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Cleanup ───────────────────────────────────────────
  return () => {
    destroyed = true;
    if (clockInterval) clearInterval(clockInterval);
    if (elapsedInterval) clearInterval(elapsedInterval);
  };
}

// ============================================================
// Registration sub-flow
// ============================================================

async function showRegistration(container) {
  container.innerHTML = renderRegistrationPage();

  // Populate employee dropdown
  const select = document.getElementById('employee-select');
  try {
    const employees = await getEmployees(true);
    if (employees.length === 0) {
      toast.warning('Chưa có nhân viên nào trong hệ thống. Liên hệ quản lý để thêm nhân viên.');
    }
    employees.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Load employees error:', err);
    toast.error('Không thể tải danh sách nhân viên. Kiểm tra kết nối mạng.');
  }

  // Form submit
  const form = document.getElementById('register-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const employeeId = select.value;
    const pin = document.getElementById('pin-input').value.trim();

    if (!employeeId) {
      toast.warning('Vui lòng chọn nhân viên');
      return;
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      toast.warning('Mã PIN phải có 4-6 chữ số');
      return;
    }

    const btnText = document.getElementById('register-btn-text');
    const btnLoading = document.getElementById('register-btn-loading');
    const registerBtn = document.getElementById('register-btn');

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    registerBtn.disabled = true;

    try {
      // Verify PIN
      const pinValid = await verifyEmployeePin(employeeId, pin);
      if (!pinValid) {
        toast.error('Mã PIN không đúng!');
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-input').focus();
        return;
      }

      // Generate token & register
      const token = crypto.randomUUID();
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'unknown',
        registeredAt: new Date().toISOString(),
      };

      await registerDevice(employeeId, token, deviceInfo);

      // Save to localStorage
      localStorage.setItem(DEVICE_TOKEN_KEY, token);

      toast.success('Đăng ký thiết bị thành công! 🎉');

      // Reload into main checkin view
      setTimeout(() => {
        checkinPage(container);
      }, 800);
    } catch (err) {
      console.error('Registration error:', err);
      toast.error('Lỗi đăng ký: ' + (err.message || 'Vui lòng thử lại.'));
    } finally {
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
      registerBtn.disabled = false;
    }
  });
}

// ============================================================
// Show month history modal for employee
// ============================================================

async function showMonthHistoryModal(employeeId, employeeName) {
  toast.info('Đang tải lịch sử...');
  try {
    const { start, end } = getCurrentMonthRange();
    const records = await getAttendanceByDate(start, end, employeeId);
    
    let totalHours = 0;
    records.forEach(r => {
      if (r.check_out) {
        totalHours += r.total_hours != null ? Number(r.total_hours) : calculateHours(r.check_in, r.check_out);
      }
    });

    const recordsHtml = records.length > 0
      ? `<div class="table-container" style="max-height: 280px; overflow-y: auto; margin-top: 10px; border-radius: var(--border-radius-lg);">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.02);">
                <th style="padding: var(--space-2) var(--space-3); text-align: left; font-size: 0.75rem; color: var(--text-tertiary);">Thời gian</th>
                <th style="padding: var(--space-2) var(--space-3); text-align: right; font-size: 0.75rem; color: var(--text-tertiary);">Số giờ</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(r => {
                const hours = r.check_out ? (r.total_hours != null ? Number(r.total_hours) : calculateHours(r.check_in, r.check_out)) : null;
                const hoursText = hours != null ? `${hours.toFixed(1)}h` : 'Đang làm';
                const deductionText = r.deducted_minutes > 0 ? `<br><small style="color:var(--danger); font-size: 0.7rem;">(trừ ${r.deducted_minutes}p)</small>` : '';
                return `
                  <tr style="border-bottom: 1px solid var(--border-default);">
                    <td style="padding: var(--space-2) var(--space-3); font-size: 0.8rem; line-height: 1.4;">
                      <strong>${formatDate(r.check_in)}</strong><br>
                      <span class="text-secondary">${formatTime(r.check_in)} - ${r.check_out ? formatTime(r.check_out) : '...'}</span>
                    </td>
                    <td style="padding: var(--space-2) var(--space-3); text-align: right; font-weight: bold; color: ${r.check_out ? 'var(--text-primary)' : 'var(--success)'}">
                      ${hoursText}${deductionText}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
         </div>`
      : '<p class="text-center text-muted p-4" style="font-size: 0.9rem;">Chưa có bản ghi chấm công nào trong tháng này.</p>';

    showModal({
      title: `📅 Lịch sử làm: ${employeeName}`,
      content: `
        <div style="margin-bottom: 15px;">
          <div class="flex flex-between align-center p-3" style="background: rgba(255,255,255,0.03); border-radius: var(--border-radius-lg); border: 1px solid var(--border-default);">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Tổng giờ tháng này</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-start); margin-top: 2px;">${totalHours.toFixed(1)} giờ</div>
            </div>
            <div style="font-size: 1.8rem; opacity: 0.8;">⏱️</div>
          </div>
        </div>
        ${recordsHtml}
      `,
      size: 'medium',
      actions: [
        {
          label: 'Đóng',
          className: 'btn-primary',
          onClick: () => closeModal()
        }
      ]
    });
  } catch (err) {
    console.error('Lỗi tải lịch sử nhân viên:', err);
    toast.error('Không thể tải lịch sử chấm công.');
  }
}

// ============================================================
// Send real-time Telegram notification to group
// ============================================================
async function sendTelegramNotification(employeeName, isCheckIn, totalHours = null, deductedMinutes = 0) {
  try {
    const settings = await getSettings();
    const botToken = settings?.telegram_bot_token;
    const groupChatId = settings?.telegram_group_chat_id;

    if (!botToken || !groupChatId) return; // Telegram group notification not configured

    const nowStr = new Date().toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZone: 'Asia/Ho_Chi_Minh' 
    });

    let text = '';
    if (isCheckIn) {
      text = `👋 <b>${employeeName}</b> vừa <b>CHECK-IN</b> lúc <b>${nowStr}</b> tại quán.`;
    } else {
      const hours = totalHours != null ? Number(totalHours) : 0;
      const hoursText = `${hours.toFixed(1)} giờ`;
      const deductionText = deductedMinutes > 0 ? ` (trừ ${deductedMinutes} phút nghỉ/ăn)` : '';
      text = `🚪 <b>${employeeName}</b> vừa <b>CHECK-OUT</b> lúc <b>${nowStr}</b>.\n⏱️ Tổng thời gian làm: <b>${hoursText}</b>${deductionText}`;
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupChatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.error('Lỗi gửi thông báo Telegram:', err);
  }
}
