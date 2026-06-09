// ============================================================
// Salary Page - Tính lương nhân viên
// ============================================================

import { isAdminLoggedIn, getEmployees, getAttendanceByDate } from '../supabase.js';
import { navigate } from '../utils/router.js';
import { calculateAllSalaries, formatCurrency } from '../utils/salary-calc.js';
import { formatHoursShort, formatDate, formatTime, getDayName } from '../utils/time.js';
import { renderNavbar, setupNavbar } from '../components/navbar.js';
import { toast } from '../components/toast.js';

export default async function salaryPage(container) {
  // Auth check
  if (!isAdminLoggedIn()) {
    navigate('/admin');
    return;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  container.innerHTML = renderNavbar() + `
    <main class="main-content">
      <div class="page-header">
        <h1>💰 Tính Lương</h1>
      </div>

      <div class="card mb-3">
        <div class="salary-filter">
          <div class="flex gap-2" style="align-items: flex-end; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Tháng</label>
              <select id="salary-month" class="form-select">
                ${Array.from({ length: 12 }, (_, i) =>
                  `<option value="${i + 1}" ${i + 1 === currentMonth ? 'selected' : ''}>Tháng ${i + 1}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Năm</label>
              <select id="salary-year" class="form-select">
                ${Array.from({ length: 5 }, (_, i) => {
                  const y = currentYear - 2 + i;
                  return `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
                }).join('')}
              </select>
            </div>
            <button class="btn btn-primary" id="btn-calculate">
              📊 Tính lương
            </button>
          </div>
        </div>
      </div>

      <div id="salary-result"></div>
    </main>
  `;

  setupNavbar();

  // State
  let salaryData = null;

  // Calculate salary
  const btnCalculate = document.getElementById('btn-calculate');
  btnCalculate.addEventListener('click', handleCalculate);

  async function handleCalculate() {
    const month = parseInt(document.getElementById('salary-month').value);
    const year = parseInt(document.getElementById('salary-year').value);

    btnCalculate.disabled = true;
    btnCalculate.innerHTML = '⏳ Đang tính...';

    try {
      // Get date range for selected month
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

      const [employees, attendance] = await Promise.all([
        getEmployees(),
        getAttendanceByDate(startDate, endDate),
      ]);

      salaryData = calculateAllSalaries(employees, attendance);
      renderSalaryTable(salaryData, month, year);
    } catch (error) {
      console.error('Salary calculation error:', error);
      toast.error('Lỗi khi tính lương: ' + error.message);
    } finally {
      btnCalculate.disabled = false;
      btnCalculate.innerHTML = '📊 Tính lương';
    }
  }

  function renderSalaryTable(data, month, year) {
    const resultEl = document.getElementById('salary-result');

    if (!data || data.length === 0) {
      resultEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h2>Không có dữ liệu</h2>
          <p>Không tìm thấy nhân viên nào để tính lương.</p>
        </div>
      `;
      return;
    }

    const totalSalary = data.reduce((sum, d) => sum + (d.salary || 0), 0);

    resultEl.innerHTML = `
      <div class="card mb-3">
        <div class="flex-between mb-2" style="flex-wrap: wrap; gap: 0.5rem;">
          <h2 style="margin: 0;">Bảng lương Tháng ${month}/${year}</h2>
          <button class="btn btn-outline" id="btn-print">
            🖨️ In báo cáo
          </button>
        </div>

        <div class="table-container">
          <table class="salary-table" id="salary-table">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Nhân viên</th>
                <th>Loại lương</th>
                <th style="text-align: center;">Số ngày làm</th>
                <th style="text-align: center;">Tổng giờ</th>
                <th style="text-align: right;">Đơn giá</th>
                <th style="text-align: right;">Thành tiền</th>
                <th style="width: 50px;" class="no-print"></th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr class="salary-row" data-index="${index}">
                  <td>${index + 1}</td>
                  <td><strong>${item.employee.name}</strong></td>
                  <td>
                    <span class="badge ${item.type === 'hourly' ? 'badge-info' : 'badge-success'}">
                      ${item.typeName}
                    </span>
                  </td>
                  <td style="text-align: center;">${item.type === 'monthly' ? item.actualDays : item.totalDays}</td>
                  <td style="text-align: center;">${formatHoursShort(item.totalHours)}</td>
                  <td style="text-align: right;">
                    ${item.type === 'hourly'
                      ? formatCurrency(item.rate) + '/giờ'
                      : formatCurrency(item.type === 'monthly' ? item.monthlyRate : item.rate) + '/tháng'}
                  </td>
                  <td style="text-align: right;"><strong>${formatCurrency(item.salary)}</strong></td>
                  <td class="no-print">
                    <button class="btn btn-sm btn-outline btn-expand" data-index="${index}" title="Xem chi tiết">
                      ▼
                    </button>
                  </td>
                </tr>
                <tr class="salary-detail-row hidden" id="detail-${index}">
                  <td colspan="8" style="padding: 0;">
                    ${renderDailyDetail(item)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="salary-total-row">
                <td colspan="6" style="text-align: right;"><strong>Tổng cộng:</strong></td>
                <td style="text-align: right;"><strong class="salary-total">${formatCurrency(totalSalary)}</strong></td>
                <td class="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div class="card mb-3">
        <div class="salary-summary">
          <div class="stat-card">
            <div class="stat-value">${data.length}</div>
            <div class="stat-label">Nhân viên</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(totalSalary)}</div>
            <div class="stat-label">Tổng chi lương</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatCurrency(data.length > 0 ? totalSalary / data.length : 0)}</div>
            <div class="stat-label">Trung bình / người</div>
          </div>
        </div>
      </div>
    `;

    // Expand/collapse handlers
    resultEl.querySelectorAll('.btn-expand').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = btn.getAttribute('data-index');
        const detailRow = document.getElementById(`detail-${idx}`);
        const isHidden = detailRow.classList.contains('hidden');
        detailRow.classList.toggle('hidden');
        btn.textContent = isHidden ? '▲' : '▼';
      });
    });

    // Click on row to expand
    resultEl.querySelectorAll('.salary-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const idx = row.getAttribute('data-index');
        const btn = row.querySelector('.btn-expand');
        const detailRow = document.getElementById(`detail-${idx}`);
        const isHidden = detailRow.classList.contains('hidden');
        detailRow.classList.toggle('hidden');
        btn.textContent = isHidden ? '▲' : '▼';
      });
    });

    // Print handler
    document.getElementById('btn-print').addEventListener('click', () => {
      handlePrint(month, year, data, totalSalary);
    });
  }

  function renderDailyDetail(item) {
    const days = Object.keys(item.dailyHours).sort();

    if (days.length === 0) {
      return `
        <div style="padding: 1rem; text-align: center; color: var(--text);">
          Không có dữ liệu chấm công
        </div>
      `;
    }

    // Group attendance records by day for check-in/out times
    const recordsByDay = {};
    if (item.records) {
      for (const r of item.records) {
        if (r.check_in) {
          const day = new Date(r.check_in).toISOString().split('T')[0];
          if (!recordsByDay[day]) recordsByDay[day] = [];
          recordsByDay[day].push(r);
        }
      }
    }

    return `
      <div class="daily-detail">
        <table class="daily-detail-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Thứ</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th style="text-align: right;">Số giờ</th>
            </tr>
          </thead>
          <tbody>
            ${days.map(day => {
              const dayRecords = recordsByDay[day] || [];
              if (dayRecords.length === 0) {
                return `
                  <tr>
                    <td>${formatDate(day)}</td>
                    <td>${getDayName(day)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td style="text-align: right;">${formatHoursShort(item.dailyHours[day])}</td>
                  </tr>
                `;
              }
              return dayRecords.map((r, i) => `
                <tr>
                  ${i === 0 ? `
                    <td rowspan="${dayRecords.length}">${formatDate(day)}</td>
                    <td rowspan="${dayRecords.length}">${getDayName(day)}</td>
                  ` : ''}
                  <td>${formatTime(r.check_in)}</td>
                  <td>${r.check_out ? formatTime(r.check_out) : '<span class="badge badge-warning">Chưa out</span>'}</td>
                  <td style="text-align: right;">
                    ${r.check_out
                      ? formatHoursShort((new Date(r.check_out) - new Date(r.check_in)) / (1000 * 60 * 60))
                      : '—'}
                  </td>
                </tr>
              `).join('');
            }).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align: right;"><strong>Tổng:</strong></td>
              <td style="text-align: right;"><strong>${formatHoursShort(item.totalHours)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  function handlePrint(month, year, data, totalSalary) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Trình duyệt chặn popup. Vui lòng cho phép popup để in báo cáo.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Bảng Lương Tháng ${month}/${year}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 20mm; font-size: 12pt; color: #333; }
          h1 { text-align: center; font-size: 18pt; margin-bottom: 4px; }
          .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 11pt; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11pt; }
          th { background: #f5f5f5; font-weight: 600; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .total-row { background: #f0f0f0; font-weight: bold; }
          .badge { padding: 2px 8px; border-radius: 10px; font-size: 9pt; }
          .badge-hourly { background: #e0f2fe; color: #0369a1; }
          .badge-monthly { background: #dcfce7; color: #15803d; }
          .detail-table { margin: 8px 0; }
          .detail-table th { background: #fafafa; font-size: 10pt; }
          .detail-table td { font-size: 10pt; padding: 4px 8px; }
          .footer { text-align: right; margin-top: 30px; font-style: italic; color: #666; font-size: 10pt; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        <h1>BẢNG LƯƠNG NHÂN VIÊN</h1>
        <p class="subtitle">Tháng ${month} năm ${year}</p>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Nhân viên</th>
              <th>Loại lương</th>
              <th class="text-center">Số ngày</th>
              <th class="text-center">Tổng giờ</th>
              <th class="text-right">Đơn giá</th>
              <th class="text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.employee.name}</td>
                <td>
                  <span class="badge ${item.type === 'hourly' ? 'badge-hourly' : 'badge-monthly'}">
                    ${item.typeName}
                  </span>
                </td>
                <td class="text-center">${item.type === 'monthly' ? item.actualDays : item.totalDays}</td>
                <td class="text-center">${formatHoursShort(item.totalHours)}</td>
                <td class="text-right">
                  ${item.type === 'hourly'
                    ? formatCurrency(item.rate) + '/giờ'
                    : formatCurrency(item.monthlyRate) + '/tháng'}
                </td>
                <td class="text-right"><strong>${formatCurrency(item.salary)}</strong></td>
              </tr>
              ${renderPrintDailyDetail(item)}
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="6" class="text-right">Tổng cộng:</td>
              <td class="text-right">${formatCurrency(totalSalary)}</td>
            </tr>
          </tfoot>
        </table>

        <p class="footer">Ngày in: ${new Date().toLocaleString('vi-VN')}</p>

        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  function renderPrintDailyDetail(item) {
    const days = Object.keys(item.dailyHours).sort();
    if (days.length === 0) return '';

    const recordsByDay = {};
    if (item.records) {
      for (const r of item.records) {
        if (r.check_in) {
          const day = new Date(r.check_in).toISOString().split('T')[0];
          if (!recordsByDay[day]) recordsByDay[day] = [];
          recordsByDay[day].push(r);
        }
      }
    }

    return `
      <tr>
        <td colspan="7" style="padding: 4px 20px;">
          <table class="detail-table" style="width: 100%;">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Thứ</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th class="text-right">Giờ</th>
              </tr>
            </thead>
            <tbody>
              ${days.map(day => {
                const recs = recordsByDay[day] || [];
                if (recs.length === 0) {
                  return `<tr>
                    <td>${formatDate(day)}</td>
                    <td>${getDayName(day)}</td>
                    <td>—</td><td>—</td>
                    <td class="text-right">${formatHoursShort(item.dailyHours[day])}</td>
                  </tr>`;
                }
                return recs.map((r, i) => `
                  <tr>
                    ${i === 0 ? `<td rowspan="${recs.length}">${formatDate(day)}</td><td rowspan="${recs.length}">${getDayName(day)}</td>` : ''}
                    <td>${formatTime(r.check_in)}</td>
                    <td>${r.check_out ? formatTime(r.check_out) : 'Chưa out'}</td>
                    <td class="text-right">${r.check_out ? formatHoursShort((new Date(r.check_out) - new Date(r.check_in)) / (1000 * 60 * 60)) : '—'}</td>
                  </tr>
                `).join('');
              }).join('')}
            </tbody>
          </table>
        </td>
      </tr>
    `;
  }

  // Auto-calculate on load
  await handleCalculate();
}
