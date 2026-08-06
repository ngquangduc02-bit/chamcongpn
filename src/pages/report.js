// ============================================================
// Shareable Public Report Page - Trang Báo Cáo Tháng Công Khai
// ============================================================

import { getEmployees, getAttendanceByDate } from '../supabase.js';
import { getQueryParams, navigate } from '../utils/router.js';
import { calculateAllSalaries, formatCurrency } from '../utils/salary-calc.js';
import { formatHoursShort, formatDate, formatTime, getDayName, calculateHours } from '../utils/time.js';
import { toast } from '../components/toast.js';

export default async function reportPage(container) {
  const params = getQueryParams();
  const now = new Date();
  const selectedMonth = parseInt(params.get('month')) || (now.getMonth() + 1);
  const selectedYear = parseInt(params.get('year')) || now.getFullYear();

  // Render initial loading UI
  container.innerHTML = `
    <div class="checkin-page" style="min-height: 100vh; background: var(--bg-primary);">
      <div style="max-width: 1000px; margin: 0 auto; width: 100%; padding: var(--space-4);">
        <div class="card p-4 text-center">
          <div class="loading-spinner mb-2">⏳</div>
          <p style="color: var(--text-secondary);">Đang tải dữ liệu báo cáo Tháng ${selectedMonth}/${selectedYear}...</p>
        </div>
      </div>
    </div>
  `;

  try {
    const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

    const [employees, attendance] = await Promise.all([
      getEmployees(false), // Fetch all employees
      getAttendanceByDate(startDate, endDate)
    ]);

    const salaryData = calculateAllSalaries(employees, attendance);
    const totalSalary = salaryData.reduce((sum, d) => sum + (d.salary || 0), 0);
    const totalHoursAll = salaryData.reduce((sum, d) => sum + (d.totalHours || 0), 0);

    // Build HTML Options for Month Select
    const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
      .map(m => `<option value="${m}" ${m === selectedMonth ? 'selected' : ''}>Tháng ${m}</option>`)
      .join('');

    // Build HTML Options for Year Select
    const yearOptions = [2025, 2026, 2027]
      .map(y => `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>Năm ${y}</option>`)
      .join('');

    container.innerHTML = `
      <div style="min-height: 100vh; background: var(--bg-primary); padding: var(--space-4) var(--space-2); color: var(--text-primary);">
        <div style="max-width: 960px; margin: 0 auto; width: 100%;">
          
          <!-- CONTROL HEADER -->
          <div class="card mb-4 no-print" style="border-radius: 16px; padding: var(--space-4);">
            <div class="flex flex-between align-center" style="flex-wrap: wrap; gap: 1rem;">
              <div>
                <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">
                  📊 Báo Cáo Tháng ${selectedMonth}/${selectedYear}
                </h1>
                <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
                  Trang xem báo cáo công khai dành cho Quản lý & Nhân viên
                </p>
              </div>

              <div class="flex align-center gap-2" style="flex-wrap: wrap;">
                <select id="report-month" class="form-input form-select" style="width: auto; padding: 6px 12px;">
                  ${monthOptions}
                </select>
                <select id="report-year" class="form-input form-select" style="width: auto; padding: 6px 12px;">
                  ${yearOptions}
                </select>
                <button id="btn-filter-report" class="btn btn-primary btn-sm">
                  🔍 Xem
                </button>
              </div>
            </div>

            <div class="checkin-divider" style="margin: 12px 0;"></div>

            <!-- ACTION BUTTONS -->
            <div class="flex gap-2" style="flex-wrap: wrap;">
              <button id="btn-copy-report-url" class="btn btn-outline btn-sm">
                📋 Copy Link Báo Cáo
              </button>
              <button id="btn-print-report" class="btn btn-outline btn-sm">
                🖨️ In / Tải PDF
              </button>
              <a href="#/checkin" class="btn btn-outline btn-sm" style="margin-left: auto;">
                🏠 Trang Chấm Công
              </a>
            </div>
          </div>

          <!-- REPORT CONTENT FOR PRINT & SCREEN -->
          <div id="report-print-container">
            
            <!-- SUMMARY STAT CARDS -->
            <div class="grid grid-3 mb-4 no-print" style="gap: 12px;">
              <div class="card text-center p-3" style="border-radius: 14px;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">TỔNG QUY LƯƠNG</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--danger); margin-top: 4px;">
                  ${formatCurrency(totalSalary)}
                </div>
              </div>
              <div class="card text-center p-3" style="border-radius: 14px;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">TỔNG GIỜ LÀM</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary); margin-top: 4px;">
                  ${formatHoursShort(totalHoursAll)}
                </div>
              </div>
              <div class="card text-center p-3" style="border-radius: 14px;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">NHÂN VIÊN</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: var(--success); margin-top: 4px;">
                  ${salaryData.length} người
                </div>
              </div>
            </div>

            <!-- 1. BẢNG TỔNG HỢP (SUMMARY TABLE) -->
            <div class="card mb-4 p-4" style="border-radius: 16px; overflow-x: auto;">
              <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0 0 14px 0; text-align: center; color: var(--text-primary);">
                📋 BẢNG TỔNG HỢP LƯƠNG NHÂN VIÊN - THÁNG ${selectedMonth}/${selectedYear}
              </h2>

              <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                  <tr style="background: rgba(255, 255, 255, 0.04);">
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: center; width: 40px;">STT</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: left;">Họ và Tên</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: center;">Loại Lương</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: center;">Số Ngày</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: right;">Tổng Giờ</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: right;">Mức Lương</th>
                    <th style="padding: 10px; border: 1px solid var(--border-default); text-align: right;">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody>
                  ${salaryData.map((item, index) => {
                    const isPink = item.employee?.pin === '0111' || item.employee?.name?.includes('Thảo');
                    const nameHtml = isPink ? `<span class="pink-sparkle-name">${item.employee.name}</span>` : `<b>${item.employee.name}</b>`;
                    const days = item.type === 'monthly' ? item.actualDays : item.totalDays;
                    const rateVal = item.type === 'hourly' ? item.rate : item.monthlyRate;
                    const rateUnit = item.type === 'hourly' ? '/giờ' : '/tháng';

                    return `
                      <tr style="border-bottom: 1px solid var(--border-default);">
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: center;">${index + 1}</td>
                        <td style="padding: 8px; border: 1px solid var(--border-default);">${nameHtml}</td>
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: center;">
                          <span class="badge ${item.type === 'hourly' ? 'badge-hourly' : 'badge-monthly'}">${item.typeName}</span>
                        </td>
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: center;">${days} ngày</td>
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: right;"><b>${formatHoursShort(item.totalHours)}</b></td>
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: right;">${formatCurrency(rateVal)}${rateUnit}</td>
                        <td style="padding: 8px; border: 1px solid var(--border-default); text-align: right; font-weight: bold; color: var(--text-primary);">${formatCurrency(item.salary)}</td>
                      </tr>
                    `;
                  }).join('')}
                  <tr style="background: rgba(255, 255, 255, 0.05); font-weight: bold;">
                    <td colspan="4" style="padding: 10px; border: 1px solid var(--border-default); text-align: right;">TỔNG CỘNG TOÀN QUÁN:</td>
                    <td style="padding: 10px; border: 1px solid var(--border-default); text-align: right; color: var(--primary);"><b>${formatHoursShort(totalHoursAll)}</b></td>
                    <td style="padding: 10px; border: 1px solid var(--border-default); text-align: right;">-</td>
                    <td style="padding: 10px; border: 1px solid var(--border-default); text-align: right; font-size: 1rem; color: var(--danger);"><b>${formatCurrency(totalSalary)}</b></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 2. BẢNG CHI TIẾT THEO TỪNG NHÂN VIÊN -->
            ${salaryData.map((item) => {
              const empName = item.employee?.name || 'Chưa đặt tên';
              const isPink = item.employee?.pin === '0111' || empName.includes('Thảo');
              const nameHtml = isPink ? `<span class="pink-sparkle-name">${empName}</span>` : empName;

              const recordsByDay = {};
              if (item.records) {
                item.records.forEach((r) => {
                  if (r.check_in) {
                    const dayKey = new Date(r.check_in).toISOString().split('T')[0];
                    if (!recordsByDay[dayKey]) recordsByDay[dayKey] = [];
                    recordsByDay[dayKey].push(r);
                  }
                });
              }

              const sortedDays = Object.keys(recordsByDay).sort();
              let subIndex = 0;
              let empTotalHours = 0;

              return `
                <div class="card mb-4 p-4" style="border-radius: 16px; overflow-x: auto;">
                  <h3 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 12px 0; color: var(--accent);">
                    👤 CHI TIẾT CA LÀM: ${nameHtml}
                  </h3>

                  <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                    <thead>
                      <tr style="background: rgba(255, 255, 255, 0.03);">
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: center; width: 30px;">STT</th>
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: center;">Ngày Làm</th>
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: center;">Vào (In)</th>
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: center;">Ra (Out)</th>
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: center;">Trừ Nghỉ</th>
                        <th style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: right;">Thực Làm</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedDays.map((dayKey) => {
                        const recs = recordsByDay[dayKey];
                        return recs.map((r) => {
                          subIndex++;
                          const dateFormatted = formatDate(r.check_in);
                          const inTime = formatTime(r.check_in);
                          const outTime = r.check_out ? formatTime(r.check_out) : 'Chưa out';
                          const deduction = r.deducted_minutes > 0 ? `${r.deducted_minutes}p` : '0';

                          let shiftHours = 0;
                          if (r.check_out) {
                            const raw = calculateHours(r.check_in, r.check_out);
                            const deductVal = (r.deducted_minutes || 0) / 60;
                            shiftHours = Math.max(0, raw - deductVal);
                          }
                          empTotalHours += shiftHours;

                          return `
                            <tr style="border-bottom: 1px solid var(--border-default);">
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: center;">${subIndex}</td>
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: center;">${dateFormatted}</td>
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: center;">${inTime}</td>
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: center;">${outTime}</td>
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: center;">${deduction}</td>
                              <td style="padding: 6px 4px; border: 1px solid var(--border-default); text-align: right;"><b>${formatHoursShort(shiftHours)}</b></td>
                            </tr>
                          `;
                        }).join('');
                      }).join('')}
                      <tr style="background: rgba(255, 255, 255, 0.04); font-weight: bold;">
                        <td colspan="5" style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: right;">
                          TỔNG CỘNG CHO ${empName.toUpperCase()}:
                        </td>
                        <td style="padding: 8px 4px; border: 1px solid var(--border-default); text-align: right; color: var(--primary);">
                          <b>${formatHoursShort(empTotalHours)} (${formatCurrency(item.salary)})</b>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}

          </div>
        </div>
      </div>
    `;

    // Add Event Listeners
    document.getElementById('btn-filter-report').addEventListener('click', () => {
      const m = document.getElementById('report-month').value;
      const y = document.getElementById('report-year').value;
      navigate(`/report?month=${m}&year=${y}`);
    });

    document.getElementById('btn-copy-report-url').addEventListener('click', () => {
      const fullUrl = `${window.location.origin}/#/report?month=${selectedMonth}&year=${selectedYear}`;
      navigator.clipboard.writeText(fullUrl);
      toast.success('Đã copy đường dẫn Báo Cáo Tháng vào bộ nhớ tạm! 📋');
    });

    document.getElementById('btn-print-report').addEventListener('click', () => {
      window.print();
    });

  } catch (err) {
    console.error('Report page error:', err);
    container.innerHTML = `
      <div class="checkin-page" style="min-height: 100vh; background: var(--bg-primary);">
        <div style="max-width: 600px; margin: 0 auto; width: 100%; padding: var(--space-4);">
          <div class="card p-4 text-center">
            <div class="empty-state-icon">❌</div>
            <h2 class="mt-2">Lỗi tải báo cáo</h2>
            <p style="color: var(--text-secondary);">${err.message || 'Không thể lấy dữ liệu báo cáo.'}</p>
            <button class="btn btn-primary mt-3" onclick="location.reload()">Thử lại</button>
          </div>
        </div>
      </div>
    `;
  }
}
