// ============================================================
// Time Utilities - Xử lý thời gian cho Việt Nam (UTC+7)
// ============================================================

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Format ngày giờ theo kiểu Việt Nam
 * @param {string|Date} date
 * @returns {string} VD: "09/06/2026 14:30"
 */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format chỉ giờ
 * @param {string|Date} date
 * @returns {string} VD: "14:30"
 */
export function formatTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format chỉ ngày
 * @param {string|Date} date
 * @returns {string} VD: "09/06/2026"
 */
export function formatDate(date) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format số giờ làm việc
 * @param {number} hours - Số giờ (VD: 8.5)
 * @returns {string} VD: "8 giờ 30 phút"
 */
export function formatHours(hours) {
  if (hours == null || isNaN(hours)) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0 && m === 0) return '0 phút';
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

/**
 * Format số giờ ngắn gọn
 * @param {number} hours
 * @returns {string} VD: "8.5h"
 */
export function formatHoursShort(hours) {
  if (hours == null || isNaN(hours)) return '—';
  return `${hours.toFixed(1)}h`;
}

/**
 * Tính số giờ giữa 2 thời điểm
 * @param {string|Date} start
 * @param {string|Date} end
 * @returns {number} Số giờ (VD: 8.5)
 */
export function calculateHours(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return diff / (1000 * 60 * 60);
}

/**
 * Tính thời gian đã trôi qua từ lúc check-in đến hiện tại
 * @param {string|Date} checkInTime
 * @returns {string} VD: "3 giờ 25 phút"
 */
export function getElapsedTime(checkInTime) {
  if (!checkInTime) return '—';
  const elapsed = (new Date() - new Date(checkInTime)) / (1000 * 60 * 60);
  return formatHours(elapsed);
}

/**
 * Lấy ngày bắt đầu và kết thúc của ngày hôm nay (UTC+7)
 */
export function getTodayRange() {
  const now = new Date();
  // Adjust for Vietnam timezone
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: VN_TIMEZONE }));
  const start = new Date(vnNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(vnNow);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Lấy ngày bắt đầu và kết thúc của tháng hiện tại
 */
export function getCurrentMonthRange() {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: VN_TIMEZONE }));
  const start = new Date(vnNow.getFullYear(), vnNow.getMonth(), 1);
  const end = new Date(vnNow.getFullYear(), vnNow.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Lấy ngày bắt đầu và kết thúc của tuần hiện tại (Thứ 2 - CN)
 */
export function getCurrentWeekRange() {
  const now = new Date();
  const vnNow = new Date(now.toLocaleString('en-US', { timeZone: VN_TIMEZONE }));
  const dayOfWeek = vnNow.getDay(); // 0 = CN
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(vnNow);
  start.setDate(vnNow.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Format ngày cho input[type="date"]
 */
export function toInputDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Format ngày cho input[type="datetime-local"]
 */
export function toInputDatetime(date) {
  if (!date) return '';
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Lấy tên thứ trong tuần
 */
export function getDayName(date) {
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return days[new Date(date).getDay()];
}

/**
 * Lấy tên tháng
 */
export function getMonthName(monthIndex) {
  return `Tháng ${monthIndex + 1}`;
}
