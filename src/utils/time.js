// ============================================================
// Time Utilities - Xử lý thời gian cho Việt Nam (UTC+7)
// ============================================================

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Format ngày giờ theo kiểu Việt Nam
 * @param {string|Date} date
 * @returns {string} VD: "09/06/2026 14:30"
 */
export function formatDateTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
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
  if (isNaN(d.getTime())) return '—';
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
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo đúng múi giờ Việt Nam
 * @param {string|Date} date
 * @returns {string} VD: "2026-09-02"
 */
export function getVNDateString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Format số giờ làm việc
 * @param {number} hours - Số giờ (VD: 8.5)
 * @returns {string} VD: "8.5 giờ"
 */
export function formatHours(hours) {
  if (hours == null || isNaN(hours)) return '—';
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded} giờ`;
}

/**
 * Format số giờ ngắn gọn (dạng số thập phân chuẩn 2 chữ số)
 * @param {number} hours
 * @returns {string} VD: "5.75h"
 */
export function formatHoursShort(hours) {
  if (hours == null || isNaN(hours)) return '—';
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded}h`;
}

/**
 * Tính số giờ giữa 2 thời điểm
 * @param {string|Date} start
 * @param {string|Date} end
 * @returns {number} Số giờ dạng thập phân chính xác (VD: 5.75)
 */
export function calculateHours(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  const rawHours = diff / (1000 * 60 * 60);
  return Math.round(rawHours * 100) / 100;
}

/**
 * Tính thời gian đã trôi qua từ lúc check-in đến hiện tại
 * @param {string|Date} checkInTime
 * @returns {string} VD: "3.5 giờ"
 */
export function getElapsedTime(checkInTime) {
  if (!checkInTime) return '—';
  const elapsed = (new Date() - new Date(checkInTime)) / (1000 * 60 * 60);
  return formatHours(elapsed);
}

/**
 * Chuyển ngày YYYY-MM-DD sang ISO string UTC tương ứng với 00:00:00 giờ Việt Nam (UTC+7).
 * Sử dụng hậu tố 'Z' để an toàn 100% khi truyền qua query string của Supabase / PostgREST (tránh dấu '+' bị decode thành khoảng trắng).
 * @param {string} dateStr - VD: "2026-09-24"
 * @returns {string} ISO UTC string (VD: "2026-09-23T17:00:00.000Z")
 */
export function dateStringToISOStart(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, -7, 0, 0, 0)).toISOString();
}

/**
 * Chuyển ngày YYYY-MM-DD sang ISO string UTC tương ứng với 23:59:59.999 giờ Việt Nam (UTC+7).
 * Sử dụng hậu tố 'Z' để an toàn 100% khi truyền qua query string của Supabase / PostgREST.
 * @param {string} dateStr - VD: "2026-09-24"
 * @returns {string} ISO UTC string (VD: "2026-09-24T16:59:59.999Z")
 */
export function dateStringToISOEnd(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 16, 59, 59, 999)).toISOString();
}

/**
 * Lấy khoảng thời gian của ngày hôm nay theo múi giờ Việt Nam (UTC+7)
 */
export function getTodayRange() {
  const vnDateStr = getVNDateString(new Date());
  return {
    start: dateStringToISOStart(vnDateStr),
    end: dateStringToISOEnd(vnDateStr),
  };
}

/**
 * Lấy khoảng thời gian của một tháng theo múi giờ Việt Nam (UTC+7)
 * @param {number} year 
 * @param {number} month (1 - 12)
 */
export function getMonthRange(year, month) {
  const y = Number(year);
  const m = Number(month);
  const lastDay = new Date(y, m, 0).getDate();
  const mStr = String(m).padStart(2, '0');
  const lastDayStr = String(lastDay).padStart(2, '0');
  return {
    start: dateStringToISOStart(`${y}-${mStr}-01`),
    end: dateStringToISOEnd(`${y}-${mStr}-${lastDayStr}`),
  };
}

/**
 * Lấy khoảng thời gian của tháng hiện tại theo múi giờ Việt Nam (UTC+7)
 */
export function getCurrentMonthRange() {
  const vnDateStr = getVNDateString(new Date());
  const [y, m] = vnDateStr.split('-').map(Number);
  return getMonthRange(y, m);
}

/**
 * Lấy ngày bắt đầu và kết thúc của tuần hiện tại (Thứ 2 - CN) theo múi giờ Việt Nam
 */
export function getCurrentWeekRange() {
  const vnDateStr = getVNDateString(new Date());
  const [y, m, d] = vnDateStr.split('-').map(Number);
  const vnDate = new Date(y, m - 1, d);
  const dayOfWeek = vnDate.getDay(); // 0 = CN
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(y, m - 1, d - diffToMonday);
  const sunday = new Date(y, m - 1, d - diffToMonday + 6);

  const monStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  const sunStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;

  return {
    start: dateStringToISOStart(monStr),
    end: dateStringToISOEnd(sunStr),
  };
}

/**
 * Format ngày cho input[type="date"] theo múi giờ Việt Nam
 */
export function toInputDate(date) {
  return getVNDateString(date);
}

/**
 * Format ngày giờ cho input[type="datetime-local"] theo múi giờ Việt Nam
 */
export function toInputDatetime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const p = {};
  parts.forEach(({ type, value }) => { p[type] = value; });
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

/**
 * Lấy tên thứ trong tuần theo múi giờ Việt Nam
 */
export function getDayName(date) {
  if (!date) return '';
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return days[dt.getDay()];
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const vnDay = new Intl.DateTimeFormat('en-US', { timeZone: VN_TIMEZONE, weekday: 'short' }).format(d);
  const map = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return days[map[vnDay] ?? d.getDay()];
}

/**
 * Lấy tên tháng
 */
export function getMonthName(monthIndex) {
  return `Tháng ${monthIndex + 1}`;
}
