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
  getDevicesByEmployee,
  deactivateDevice,
} from '../supabase.js';
import { navigate } from '../utils/router.js';
import { getCurrentPosition, getIPInfo, verifyLocation, verifyIP } from '../utils/location.js';
import { formatTime, formatHours, formatDate, calculateHours, getTodayRange, getCurrentMonthRange, getMonthRange, getVNDateString } from '../utils/time.js';
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
      </div>
    </div>
  `;
}

function renderCheckinPage(employee, activeAttendance, todayRecords) {
  const isPinkTheme = employee.pin === '0111';
  const nameInitial = (employee.name || '?').charAt(0).toUpperCase();
  const isCheckedIn = !!activeAttendance;

  // Emojis based on theme
  const checkinIcon = isPinkTheme ? '🌸' : '👋';
  const checkoutIcon = isPinkTheme ? '💖' : '🚪';
  const locationIcon = isPinkTheme ? '🌸' : '📍';
  const summaryIcon = isPinkTheme ? '💖' : '📊';
  const historyIcon = isPinkTheme ? '💖' : '📅';

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

  // Xác định nội dung Avatar hiển thị (ảnh tròn, emoji hoặc chữ cái đầu)
  const avatarContent = employee.avatar_url
    ? (employee.avatar_url.startsWith('data:') || employee.avatar_url.startsWith('http')
      ? `<img src="${employee.avatar_url}" class="avatar-image" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
      : `<span class="avatar-emoji">${employee.avatar_url}</span>`)
    : nameInitial;

  return `
    <div class="checkin-page">
      <div class="checkin-container">

        <!-- Một khung duy nhất chứa tất cả thông tin điểm danh -->
        <div class="card checkin-card">
          
          <!-- Phần 1: Nhân viên & Lời chào -->
          <div class="checkin-greeting">
            <div class="avatar-initial">${avatarContent}</div>
            <h1 class="checkin-name ${isPinkTheme ? 'pink-sparkle-name' : ''}">Xin chào, ${employee.name}!</h1>
            <p class="greeting-role">${employee.position || 'Nhân viên'}</p>
          </div>

          <!-- Phần 2: Thời gian hiện tại -->
          <div class="live-clock-section">
            <div class="checkin-time" id="live-clock">--:--:--</div>
            <div class="checkin-date" id="live-date">---</div>
          </div>

          <div class="checkin-divider"></div>

          <!-- Phần 3: Nút điểm danh & Định vị -->
          <div class="checkin-action" id="checkin-action">
            ${isCheckedIn ? `
              <div class="checked-in-info">
                <span class="checkin-time-label">Đã vào lúc</span>
                <span class="checkin-time-value">${checkinTime}</span>
              </div>
              <div class="elapsed-time" id="elapsed-time">Đang tính...</div>
              <button class="checkin-btn checkin-btn--out" id="action-btn" data-attendance-id="${activeAttendance.id}">
                <span class="checkin-btn-icon">${checkoutIcon}</span>
                <span class="checkin-btn-label">CHECK OUT</span>
              </button>
            ` : `
              <button class="checkin-btn checkin-btn--in" id="action-btn">
                <span class="checkin-btn-icon">${checkinIcon}</span>
                <span class="checkin-btn-label">CHECK IN</span>
              </button>
            `}
          </div>
          <div class="location-status" id="location-status" style="margin-top: 16px;">
            <span class="location-icon">${locationIcon}</span>
            <span class="location-text">Sẵn sàng xác minh vị trí</span>
          </div>

          <div class="checkin-divider"></div>

          <!-- Phần 4: Thống kê hôm nay -->
          <div class="today-summary" style="margin: 0; background: transparent; border: none; padding: 0;">
            <h3 class="summary-title" style="margin-top: 0;">${summaryIcon} Hôm nay</h3>
            <div class="summary-grid" style="margin-bottom: 16px;">
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
                ${todayRecords.map((r) => {
                  const raw = calculateHours(r.check_in, r.check_out);
                  const deduction = (r.deducted_minutes || 0) / 60;
                  const hours = Math.max(0, raw - deduction);
                  return `
                    <div class="history-row">
                      <span class="history-time">${formatTime(r.check_in)} → ${r.check_out ? formatTime(r.check_out) : '...'}</span>
                      <span class="history-hours">${r.check_out ? formatHours(hours) : 'Đang làm'}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <p class="summary-empty">Chưa có phiên làm việc nào hôm nay</p>
            `}
          </div>

        </div>

        <!-- Nút Xem lịch sử -->
        <div style="width: 100%; margin-top: 4px;">
          <button class="btn btn-outline btn-block" id="view-history-btn">
            ${historyIcon} Xem lịch sử tháng này
          </button>
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

    if (!device || !device.employees) {
      // Token invalid / deactivated or employee deleted
      localStorage.removeItem(DEVICE_TOKEN_KEY);
      toast.warning('Thiết bị đã bị hủy liên kết. Vui lòng đăng ký lại.');
      await showRegistration(container);
      return () => { destroyed = true; };
    }

    const employee = device.employees; // joined data
    const employeeId = employee.id;
    const isPinkTheme = employee.pin === '0111';

    // Bật/tắt theme hồng dựa trên mã PIN 0111
    if (isPinkTheme) {
      document.body.classList.add('theme-pink');
    } else {
      document.body.classList.remove('theme-pink');
    }

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
        showMonthHistoryModal(employee);
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
    document.body.classList.remove('theme-pink'); // Xóa lớp CSS khi thoát trang
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
    const employeeName = select.options[select.selectedIndex]?.text || 'Nhân viên';
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

      // Kiểm tra xem nhân viên đã có thiết bị nào đang hoạt động trước đó chưa
      const devices = await getDevicesByEmployee(employeeId);
      const activeDevices = (devices || []).filter((d) => d.is_active === true);
      const hadPreviousDevice = activeDevices.length > 0;

      // Nếu đã có thiết bị cũ -> Tự động hủy liên kết thiết bị cũ
      if (hadPreviousDevice) {
        for (const dev of activeDevices) {
          await deactivateDevice(dev.id);
        }
      }

      const deviceSummary = getDeviceSummary();

      // Generate token & register
      const token = crypto.randomUUID();
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'unknown',
        summary: deviceSummary,
        registeredAt: new Date().toISOString(),
      };

      await registerDevice(employeeId, token, deviceInfo);

      // Save to localStorage
      localStorage.setItem(DEVICE_TOKEN_KEY, token);

      if (hadPreviousDevice) {
        toast.success('Đã liên kết thiết bị mới thành công! (Thiết bị cũ đã được tự động gỡ)');
        // Gửi thông báo cảnh báo về nhóm Telegram của quản lý
        sendTelegramDeviceAlert(employeeName, deviceSummary);
      } else {
        toast.success('Đăng ký thiết bị thành công! 🎉');
      }

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

async function showMonthHistoryModal(target, nameFallback = '') {
  const employee = typeof target === 'object' && target !== null ? target : null;
  const employeeId = employee ? employee.id : target;
  const employeeName = employee ? employee.name : (nameFallback || 'Nhân viên');

  const now = new Date();
  const vnDateStr = getVNDateString(now);
  const [currentY, currentM] = vnDateStr.split('-').map(Number);

  let selectedMonth = currentM;
  let selectedYear = currentY;

  async function fetchAndRenderBody(containerEl, m, y) {
    containerEl.innerHTML = `
      <div class="text-center p-4">
        <div class="loading-spinner">⏳</div>
        <p class="text-secondary mt-2" style="font-size: 0.85rem;">Đang tải lịch sử Tháng ${m}/${y}...</p>
      </div>
    `;

    try {
      const { start, end } = getMonthRange(y, m);
      const records = (await getAttendanceByDate(start, end, employeeId)) || [];

      let totalHours = 0;
      let totalSessions = 0;
      const uniqueDays = new Set();

      records.forEach(r => {
        if (r.check_out) {
          const raw = calculateHours(r.check_in, r.check_out);
          const deductVal = (r.deducted_minutes || 0) / 60;
          const shiftHours = Math.max(0, raw - deductVal);
          totalHours += shiftHours;
          totalSessions++;
          if (r.check_in) {
            uniqueDays.add(getVNDateString(r.check_in));
          }
        }
      });

      let salaryText = '';
      if (employee && employee.salary_rate > 0) {
        let salary = 0;
        if (employee.salary_type === 'hourly') {
          salary = totalHours * employee.salary_rate;
        } else {
          salary = (employee.salary_rate / 26) * uniqueDays.size;
        }
        const formattedSalary = new Intl.NumberFormat('vi-VN').format(Math.round(salary)) + 'đ';
        salaryText = `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">💰 Lương tạm tính: <strong style="color: var(--success);">${formattedSalary}</strong></div>`;
      }

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
                  let shiftHours = 0;
                  if (r.check_out) {
                    const raw = calculateHours(r.check_in, r.check_out);
                    const deductVal = (r.deducted_minutes || 0) / 60;
                    shiftHours = Math.max(0, raw - deductVal);
                  }
                  const hoursText = r.check_out ? `${shiftHours.toFixed(2)}h` : 'Đang làm';
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
        : `<p class="text-center text-muted p-4" style="font-size: 0.9rem;">Chưa có bản ghi chấm công nào trong tháng ${m}/${y}.</p>`;

      containerEl.innerHTML = `
        <div style="margin-bottom: 12px;">
          <div class="flex flex-between align-center p-3" style="background: rgba(255,255,255,0.03); border-radius: var(--border-radius-lg); border: 1px solid var(--border-default);">
            <div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em;">Tổng giờ tháng ${m}/${y}</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--accent-start); margin-top: 2px;">${totalHours.toFixed(2)}h</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">${totalSessions} ca (${uniqueDays.size} ngày đi làm)</div>
              ${salaryText}
            </div>
            <div style="font-size: 1.8rem; opacity: 0.8;">⏱️</div>
          </div>
        </div>
        ${recordsHtml}
      `;
    } catch (err) {
      console.error('Lỗi lấy lịch sử chấm công:', err);
      containerEl.innerHTML = `<div class="p-3 text-center text-danger" style="font-size: 0.85rem;">❌ Không thể tải lịch sử: ${err.message || 'Lỗi kết nối'}. Vui lòng thử lại.</div>`;
    }
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
    .map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>Tháng ${m}</option>`)
    .join('');

  const yearOptions = [currentY - 1, currentY, currentY + 1]
    .map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>Năm ${y}</option>`)
    .join('');

  const modalEl = showModal({
    title: `📅 Lịch sử làm: ${employeeName}`,
    content: `
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <select id="modal-select-month" class="form-input form-select" style="padding: 6px 10px; font-size: 0.85rem; flex: 1;">
          ${monthOptions}
        </select>
        <select id="modal-select-year" class="form-input form-select" style="padding: 6px 10px; font-size: 0.85rem; width: 105px;">
          ${yearOptions}
        </select>
      </div>
      <div id="modal-history-content"></div>
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

  const contentContainer = modalEl.querySelector('#modal-history-content');
  const monthSelect = modalEl.querySelector('#modal-select-month');
  const yearSelect = modalEl.querySelector('#modal-select-year');

  if (contentContainer) {
    fetchAndRenderBody(contentContainer, selectedMonth, selectedYear);
  }

  const onMonthYearChange = () => {
    selectedMonth = Number(monthSelect.value);
    selectedYear = Number(yearSelect.value);
    if (contentContainer) {
      fetchAndRenderBody(contentContainer, selectedMonth, selectedYear);
    }
  };

  monthSelect?.addEventListener('change', onMonthYearChange);
  yearSelect?.addEventListener('change', onMonthYearChange);
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
      const hoursText = formatHours(hours);
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

// ============================================================
// Helper to detect human-readable device summary
// ============================================================
function getDeviceSummary() {
  const ua = navigator.userAgent || '';
  let os = 'Thiết bị';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh/i.test(ua)) os = 'Mac';

  let browser = 'Trình duyệt';
  if (/Zalo/i.test(ua)) browser = 'Zalo App';
  else if (/FBAN|FBAV/i.test(ua)) browser = 'Facebook App';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua)) browser = 'Safari';

  return `${os} (${browser})`;
}

// ============================================================
// Send Telegram alert when employee links a new/replacement device
// ============================================================
async function sendTelegramDeviceAlert(employeeName, deviceSummary) {
  try {
    const settings = await getSettings();
    const botToken = settings?.telegram_bot_token;
    const groupChatId = settings?.telegram_group_chat_id;

    if (!botToken || !groupChatId) return;

    const now = new Date();
    const nowStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const dateStr = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const text = `⚠️ <b>CẢNH BÁO ĐỔI THIẾT BỊ</b>\n` +
                 `👤 Nhân viên: <b>${employeeName}</b>\n` +
                 `📱 Thiết bị mới: <b>${deviceSummary}</b>\n` +
                 `⏰ Thời gian: <b>${nowStr} - ${dateStr}</b>\n` +
                 `ℹ️ <i>Thiết bị cũ đã được tự động gỡ liên kết.</i>`;

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
    console.error('Lỗi gửi cảnh báo đổi thiết bị qua Telegram:', err);
  }
}
