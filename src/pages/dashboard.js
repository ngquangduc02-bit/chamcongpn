// ============================================================
// Dashboard Page - Tổng quan quản trị
// ============================================================

import { isAdminLoggedIn, getTodayAttendance, getEmployees, getAttendanceByDate } from '../supabase.js';
import { navigate } from '../utils/router.js';
import { formatTime, formatHoursShort, calculateHours, getCurrentWeekRange, getDayName } from '../utils/time.js';
import { renderNavbar, setupNavbar } from '../components/navbar.js';
import { toast } from '../components/toast.js';

const REFRESH_INTERVAL = 30_000; // 30 giây

export default async function dashboard(container) {
  // ── Auth check ──
  if (!isAdminLoggedIn()) {
    navigate('/admin');
    return;
  }

  // ── Render shell ──
  container.innerHTML = renderNavbar() + `
    <main class="main-content">
      <div class="page-header">
        <h1>📊 Dashboard</h1>
        <p class="page-subtitle" id="dash-clock"></p>
      </div>

      <!-- Stat cards -->
      <div class="stat-cards-grid" id="stat-cards"></div>

      <!-- Today's activity -->
      <section class="card mt-3" id="today-section">
        <div class="card-header flex flex-between">
          <h2>🕐 Hoạt động hôm nay</h2>
          <span class="badge" id="today-count-badge">0</span>
        </div>
        <div id="today-table-wrap"></div>
      </section>

      <!-- Weekly summary chart -->
      <section class="card mt-3" id="week-section">
        <h2>📅 Tóm tắt tuần</h2>
        <div class="week-chart" id="week-chart"></div>
      </section>
    </main>
  `;

  setupNavbar();

  // ── State ──
  let intervalId = null;

  // ── Clock ──
  function updateClock() {
    const el = document.getElementById('dash-clock');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  updateClock();
  const clockId = setInterval(updateClock, 1000);

  // ── Render stat cards ──
  function renderStatCards(working, totalEmployees, totalHours, absent) {
    const cards = [
      { icon: '🟢', label: 'Đang làm việc', value: working, cls: 'stat-working' },
      { icon: '👥', label: 'Tổng nhân viên', value: totalEmployees, cls: 'stat-total' },
      { icon: '⏱️', label: 'Tổng giờ hôm nay', value: formatHoursShort(totalHours), cls: 'stat-hours' },
      { icon: '🔴', label: 'Chưa đến', value: absent, cls: 'stat-absent' },
    ];

    document.getElementById('stat-cards').innerHTML = cards.map(c => `
      <div class="stat-card ${c.cls}">
        <div class="stat-card-icon">${c.icon}</div>
        <div class="stat-card-body">
          <span class="stat-card-value">${c.value}</span>
          <span class="stat-card-label">${c.label}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Render today table ──
  function renderTodayTable(records) {
    const badge = document.getElementById('today-count-badge');
    if (badge) badge.textContent = records.length;

    const wrap = document.getElementById('today-table-wrap');
    if (!records.length) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <p>Chưa có hoạt động nào hôm nay</p>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Số giờ</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => {
              const hours = r.check_out
                ? calculateHours(r.check_in, r.check_out)
                : calculateHours(r.check_in, new Date().toISOString());
              const name = r.employees?.name || 'Không rõ';
              return `
                <tr>
                  <td><strong>${name}</strong></td>
                  <td>${formatTime(r.check_in)}</td>
                  <td>${r.check_out
                    ? formatTime(r.check_out)
                    : '<span class="status-badge status-active">Đang làm</span>'
                  }</td>
                  <td>${formatHoursShort(hours)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ── Render week chart ──
  function renderWeekChart(weekData) {
    const chartEl = document.getElementById('week-chart');
    const maxHours = Math.max(...weekData.map(d => d.hours), 1);

    chartEl.innerHTML = `
      <div class="bar-chart">
        ${weekData.map(d => {
          const pct = Math.round((d.hours / maxHours) * 100);
          const isToday = d.isToday;
          return `
            <div class="bar-col ${isToday ? 'bar-today' : ''}">
              <span class="bar-value">${formatHoursShort(d.hours)}</span>
              <div class="bar-track">
                <div class="bar-fill" style="height:${pct}%"></div>
              </div>
              <span class="bar-label">${d.dayShort}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── Load data ──
  async function loadDashboard() {
    try {
      const [todayRecords, employees, weekRecords] = await Promise.all([
        getTodayAttendance(),
        getEmployees(),
        getAttendanceByDate(...Object.values(getCurrentWeekRange())),
      ]);

      // --- Stat cards ---
      const working = todayRecords.filter(r => !r.check_out).length;
      const totalEmployees = employees.length;

      let totalHours = 0;
      todayRecords.forEach(r => {
        totalHours += r.check_out
          ? calculateHours(r.check_in, r.check_out)
          : calculateHours(r.check_in, new Date().toISOString());
      });

      const checkedInIds = new Set(todayRecords.map(r => r.employee_id));
      const absent = employees.filter(e => !checkedInIds.has(e.id)).length;

      renderStatCards(working, totalEmployees, totalHours, absent);

      // --- Today table (sorted by check-in descending – already sorted by API) ---
      renderTodayTable(todayRecords);

      // --- Week chart ---
      const { start } = getCurrentWeekRange();
      const monday = new Date(start);
      const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

      const weekData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // Sum hours for this day
        const dayRecords = weekRecords.filter(r => {
          const rDate = new Date(r.check_in).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
          return rDate === dateStr;
        });

        let hours = 0;
        dayRecords.forEach(r => {
          hours += r.check_out
            ? calculateHours(r.check_in, r.check_out)
            : calculateHours(r.check_in, new Date().toISOString());
        });

        return {
          dayShort: dayNames[i],
          dayFull: getDayName(d),
          hours: Math.round(hours * 10) / 10,
          isToday: dateStr === todayStr,
        };
      });

      renderWeekChart(weekData);
    } catch (err) {
      console.error('Dashboard load error:', err);
      toast.error('Không thể tải dữ liệu dashboard');
    }
  }

  // ── Initial load ──
  await loadDashboard();

  // ── Auto-refresh ──
  intervalId = setInterval(loadDashboard, REFRESH_INTERVAL);

  // ── Inject scoped styles ──
  const style = document.createElement('style');
  style.id = 'dashboard-styles';
  style.textContent = `
    /* ── Stat cards grid ── */
    .stat-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 8px;
    }
    @media (max-width: 900px) {
      .stat-cards-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 480px) {
      .stat-cards-grid { grid-template-columns: 1fr; }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      border-radius: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      transition: box-shadow .2s, transform .2s;
    }
    .stat-card:hover {
      box-shadow: var(--shadow);
      transform: translateY(-2px);
    }
    .stat-card-icon { font-size: 28px; }
    .stat-card-body { display: flex; flex-direction: column; }
    .stat-card-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-h);
      line-height: 1.1;
    }
    .stat-card-label {
      font-size: 13px;
      color: var(--text);
      margin-top: 2px;
    }

    /* Accent tints */
    .stat-working { border-left: 4px solid #22c55e; }
    .stat-total   { border-left: 4px solid var(--accent); }
    .stat-hours   { border-left: 4px solid #3b82f6; }
    .stat-absent  { border-left: 4px solid #ef4444; }

    /* ── Page subtitle / clock ── */
    .page-subtitle {
      font-size: 14px;
      color: var(--text);
      margin-top: 4px;
    }

    /* ── Card header ── */
    .card-header {
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .card-header h2 { margin: 0; }

    /* ── Status badge ── */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-active {
      background: rgba(34,197,94,.15);
      color: #16a34a;
    }

    /* ── Table ── */
    .table-container { overflow-x: auto; }
    .table-container table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .table-container th,
    .table-container td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .table-container th {
      font-weight: 600;
      color: var(--text);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .5px;
    }
    .table-container tbody tr:hover { background: var(--accent-bg); }

    /* ── Bar chart ── */
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 220px;
      padding: 16px 0 0;
      gap: 8px;
    }
    .bar-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      max-width: 72px;
    }
    .bar-value {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }
    .bar-track {
      width: 100%;
      height: 150px;
      background: var(--code-bg);
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: flex-end;
      overflow: hidden;
    }
    .bar-fill {
      width: 100%;
      background: var(--accent);
      border-radius: 6px 6px 0 0;
      transition: height .5s ease;
      min-height: 2px;
    }
    .bar-today .bar-fill {
      background: #22c55e;
    }
    .bar-today .bar-value {
      color: #22c55e;
      font-weight: 700;
    }
    .bar-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
    }
    .bar-today .bar-label {
      color: #22c55e;
    }

    /* ── Badge in header ── */
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 700;
      background: var(--accent);
      color: #fff;
    }

    /* ── Card ── */
    .card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }

    /* ── Page header ── */
    .page-header {
      margin-bottom: 24px;
    }
    .page-header h1 {
      font-size: 28px;
      margin: 0;
    }

    /* ── Main content ── */
    .main-content {
      max-width: 1100px;
      margin: 0 auto;
      padding: calc(var(--navbar-height) + 24px) 20px 48px;
    }

    /* ── Empty state ── */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text);
    }
    .empty-state-icon { font-size: 48px; margin-bottom: 12px; }

    /* ── Utility ── */
    .flex { display: flex; }
    .flex-between { justify-content: space-between; align-items: center; }
    .mt-3 { margin-top: 24px; }
  `;
  document.head.appendChild(style);

  // ── Cleanup ──
  return () => {
    clearInterval(intervalId);
    clearInterval(clockId);
    const s = document.getElementById('dashboard-styles');
    if (s) s.remove();
  };
}
