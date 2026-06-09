// ============================================================
// Attendance Page - Quản lý chấm công
// ============================================================

import {
  isAdminLoggedIn,
  getAttendanceByDate,
  getEmployees,
  updateAttendance,
  createManualAttendance,
  deleteAttendance,
} from '../supabase.js';
import { navigate } from '../utils/router.js';
import {
  formatDateTime,
  formatTime,
  formatDate,
  formatHours,
  calculateHours,
  getTodayRange,
  getCurrentWeekRange,
  getCurrentMonthRange,
  toInputDate,
  toInputDatetime,
} from '../utils/time.js';
import { toast } from '../components/toast.js';
import { showModal, closeModal, showConfirm } from '../components/modal.js';
import { renderNavbar, setupNavbar } from '../components/navbar.js';

export default async function attendancePage(container) {
  // ── Auth guard ──
  if (!isAdminLoggedIn()) {
    navigate('/admin');
    return;
  }

  // ── State ──
  let employees = [];
  let records = [];
  const { start, end } = getTodayRange();

  // ── Initial render ──
  container.innerHTML = renderNavbar() + `
    <main class="main-content">
      <div class="page-header">
        <h1>📋 Quản lý chấm công</h1>
        <p>Xem và chỉnh sửa bản ghi chấm công của nhân viên</p>
      </div>

      <!-- Filter Bar -->
      <div class="card mb-3">
        <div class="preset-filters flex gap-2 mb-3" style="flex-wrap: wrap; border-bottom: 1px solid var(--border-default); padding-bottom: 12px;">
          <span style="font-size: 0.9rem; color: var(--text-tertiary); display: flex; align-items: center; margin-right: 8px;">⏱️ Chọn nhanh:</span>
          <button class="btn btn-outline btn-sm" id="preset-today" style="padding: 4px 12px; font-size: 0.85rem;">Hôm nay</button>
          <button class="btn btn-outline btn-sm" id="preset-yesterday" style="padding: 4px 12px; font-size: 0.85rem;">Hôm qua</button>
          <button class="btn btn-outline btn-sm" id="preset-week" style="padding: 4px 12px; font-size: 0.85rem;">Tuần này</button>
          <button class="btn btn-outline btn-sm" id="preset-month" style="padding: 4px 12px; font-size: 0.85rem;">Tháng này</button>
        </div>
        <div class="filter-bar">
          <div class="form-group">
            <label class="form-label">Từ ngày</label>
            <input type="date" id="filter-start" class="form-input" value="${toInputDate(start)}">
          </div>
          <div class="form-group">
            <label class="form-label">Đến ngày</label>
            <input type="date" id="filter-end" class="form-input" value="${toInputDate(end)}">
          </div>
          <div class="form-group">
            <label class="form-label">Nhân viên</label>
            <select id="filter-employee" class="form-select">
              <option value="">Tất cả nhân viên</option>
            </select>
          </div>
          <div class="form-group filter-actions">
            <label class="form-label">&nbsp;</label>
            <div class="flex gap-1">
              <button class="btn btn-primary" id="btn-filter">🔍 Lọc</button>
              <button class="btn btn-success" id="btn-add-manual">➕ Thêm thủ công</button>
              <button class="btn btn-outline" id="btn-batch-deduct" style="color: var(--warning); border-color: rgba(202, 138, 4, 0.2)">⏱️ Trừ hàng loạt</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="table-container" id="attendance-table-wrapper">
          <p class="text-center mt-2">Đang tải dữ liệu...</p>
        </div>
      </div>

      <!-- Summary -->
      <div class="card mt-3" id="attendance-summary" style="display:none;">
        <div class="flex flex-between gap-2" style="flex-wrap:wrap;">
          <div class="stat-card">
            <div class="stat-value" id="summary-total-records">0</div>
            <div class="stat-label">Tổng bản ghi</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" id="summary-total-hours">0</div>
            <div class="stat-label">Tổng giờ làm</div>
          </div>
        </div>
      </div>
    </main>
  `;

  setupNavbar();

  // ── DOM refs ──
  const filterStart = document.getElementById('filter-start');
  const filterEnd = document.getElementById('filter-end');
  const filterEmployee = document.getElementById('filter-employee');
  const btnFilter = document.getElementById('btn-filter');
  const btnAddManual = document.getElementById('btn-add-manual');
  const btnBatchDeduct = document.getElementById('btn-batch-deduct');
  const tableWrapper = document.getElementById('attendance-table-wrapper');
  const summaryEl = document.getElementById('attendance-summary');

  // Preset button refs
  const presetToday = document.getElementById('preset-today');
  const presetYesterday = document.getElementById('preset-yesterday');
  const presetWeek = document.getElementById('preset-week');
  const presetMonth = document.getElementById('preset-month');

  // ── Load employees for filter dropdown ──
  async function loadEmployees() {
    try {
      employees = await getEmployees(false);
      filterEmployee.innerHTML =
        '<option value="">Tất cả nhân viên</option>' +
        employees
          .map((e) => `<option value="${e.id}">${e.name}</option>`)
          .join('');
    } catch (err) {
      console.error('Lỗi tải nhân viên:', err);
      toast.error('Không thể tải danh sách nhân viên');
    }
  }

  // ── Load attendance data ──
  async function loadAttendance() {
    const startDate = filterStart.value
      ? new Date(filterStart.value + 'T00:00:00').toISOString()
      : new Date(start).toISOString();
    const endDate = filterEnd.value
      ? new Date(filterEnd.value + 'T23:59:59').toISOString()
      : new Date(end).toISOString();
    const empId = filterEmployee.value || null;

    try {
      records = await getAttendanceByDate(startDate, endDate, empId);
      renderTable();
      renderSummary();
    } catch (err) {
      console.error('Lỗi tải chấm công:', err);
      toast.error('Không thể tải dữ liệu chấm công');
      tableWrapper.innerHTML =
        '<div class="empty-state"><p>❌ Lỗi khi tải dữ liệu</p></div>';
    }
  }

  // ── Render table ──
  function renderTable() {
    if (records.length === 0) {
      tableWrapper.innerHTML = `
        <div class="empty-state">
          <p>📭 Không có bản ghi chấm công nào trong khoảng thời gian đã chọn</p>
        </div>
      `;
      return;
    }

    tableWrapper.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Ngày</th>
            <th>Check-in</th>
            <th>Check-out</th>
            <th>Tổng giờ</th>
            <th>Ghi chú</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((r) => renderRow(r)).join('')}
        </tbody>
      </table>
    `;

    // Attach row action handlers
    tableWrapper.querySelectorAll('.btn-edit-record').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const record = records.find((r) => r.id === id);
        if (record) openEditModal(record);
      });
    });

    tableWrapper.querySelectorAll('.btn-delete-record').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        handleDelete(id);
      });
    });
  }

  function renderRow(r) {
    const empName = r.employees?.name || 'Không rõ';
    const hours = r.check_out ? (r.total_hours != null ? r.total_hours : calculateHours(r.check_in, r.check_out)) : null;
    const isWorking = !r.check_out;
    const statusBadge = isWorking
      ? '<span class="status-badge badge" style="background:var(--success-light,#dcfce7);color:var(--success,#16a34a);">Đang làm</span>'
      : r.is_edited
        ? '<span class="status-badge badge" style="background:var(--warning-light,#fef9c3);color:var(--warning,#ca8a04);">Đã sửa</span>'
        : '<span class="status-badge badge" style="background:var(--gray-100,#f3f4f6);color:var(--gray-600,#4b5563);">Hoàn thành</span>';

    const deductionLabel = r.deducted_minutes > 0 
      ? `<br><small class="text-danger">(-${r.deducted_minutes} phút ăn/nghỉ)</small>`
      : '';

    return `
      <tr>
        <td><strong>${empName}</strong></td>
        <td>${formatDate(r.check_in)}</td>
        <td>${formatTime(r.check_in)}</td>
        <td>${r.check_out ? formatTime(r.check_out) : '—'}</td>
        <td>${hours != null ? formatHours(hours) : '—'}${deductionLabel}</td>
        <td>${r.note || '—'}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-outline btn-sm btn-edit-record" data-id="${r.id}">✏️ Sửa</button>
            <button class="btn btn-danger btn-sm btn-delete-record" data-id="${r.id}">🗑️ Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }

  // ── Render summary ──
  function renderSummary() {
    if (records.length === 0) {
      summaryEl.style.display = 'none';
      return;
    }

    summaryEl.style.display = '';

    let totalHours = 0;
    records.forEach((r) => {
      if (r.check_out) {
        totalHours += r.total_hours != null ? r.total_hours : calculateHours(r.check_in, r.check_out);
      }
    });

    document.getElementById('summary-total-records').textContent = records.length;
    document.getElementById('summary-total-hours').textContent = formatHours(totalHours);
  }

  // ── Edit Modal ──
  function openEditModal(record) {
    const content = `
      <form id="edit-attendance-form">
        <div class="form-group">
          <label class="form-label">Check-in</label>
          <input type="datetime-local" class="form-input" id="edit-checkin"
                 value="${toInputDatetime(record.check_in)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Check-out</label>
          <input type="datetime-local" class="form-input" id="edit-checkout"
                 value="${record.check_out ? toInputDatetime(record.check_out) : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Số phút khấu trừ (VD: giờ ăn/nghỉ)</label>
          <input type="number" class="form-input" id="edit-deducted"
                 value="${record.deducted_minutes || 0}" min="0" placeholder="Số phút, ví dụ: 60">
        </div>
        <div class="form-group">
          <label class="form-label">Ghi chú</label>
          <input type="text" class="form-input" id="edit-note"
                 value="${record.note || ''}" placeholder="Nhập ghi chú...">
        </div>
      </form>
    `;

    showModal({
      title: '✏️ Sửa bản ghi chấm công',
      content,
      size: 'medium',
      actions: [
        {
          label: 'Hủy',
          className: 'btn-outline',
          onClick: () => closeModal(),
        },
        {
          label: '💾 Lưu',
          className: 'btn-primary',
          onClick: async () => {
            const checkIn = document.getElementById('edit-checkin').value;
            const checkOut = document.getElementById('edit-checkout').value;
            const deductedMinutes = parseInt(document.getElementById('edit-deducted').value, 10) || 0;
            const note = document.getElementById('edit-note').value.trim();

            if (!checkIn) {
              toast.warning('Vui lòng nhập thời gian check-in');
              return;
            }

            try {
              const updates = {
                check_in: new Date(checkIn).toISOString(),
                deducted_minutes: deductedMinutes,
                note: note || null,
              };

              if (checkOut) {
                updates.check_out = new Date(checkOut).toISOString();
              } else {
                updates.check_out = null;
              }

              await updateAttendance(record.id, updates);
              closeModal();
              toast.success('Đã cập nhật bản ghi chấm công');
              await loadAttendance();
            } catch (err) {
              console.error('Lỗi cập nhật:', err);
              toast.error('Không thể cập nhật bản ghi: ' + (err.message || ''));
            }
          },
        },
      ],
    });
  }

  // ── Add Manual Modal ──
  function openAddManualModal() {
    const employeeOptions = employees
      .filter((e) => e.is_active)
      .map((e) => `<option value="${e.id}">${e.name}</option>`)
      .join('');

    const content = `
      <form id="add-attendance-form">
        <div class="form-group">
          <label class="form-label">Nhân viên</label>
          <select class="form-select" id="add-employee" required>
            <option value="">-- Chọn nhân viên --</option>
            ${employeeOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Check-in</label>
          <input type="datetime-local" class="form-input" id="add-checkin" required>
        </div>
        <div class="form-group">
          <label class="form-label">Check-out</label>
          <input type="datetime-local" class="form-input" id="add-checkout">
        </div>
        <div class="form-group">
          <label class="form-label">Số phút khấu trừ (VD: giờ ăn/nghỉ)</label>
          <input type="number" class="form-input" id="add-deducted" value="0" min="0" placeholder="Số phút, ví dụ: 60">
        </div>
        <div class="form-group">
          <label class="form-label">Ghi chú</label>
          <input type="text" class="form-input" id="add-note"
                 value="Thêm thủ công bởi admin" placeholder="Nhập ghi chú...">
        </div>
      </form>
    `;

    showModal({
      title: '➕ Thêm chấm công thủ công',
      content,
      size: 'medium',
      actions: [
        {
          label: 'Hủy',
          className: 'btn-outline',
          onClick: () => closeModal(),
        },
        {
          label: '💾 Lưu',
          className: 'btn-primary',
          onClick: async () => {
            const employeeId = document.getElementById('add-employee').value;
            const checkIn = document.getElementById('add-checkin').value;
            const checkOut = document.getElementById('add-checkout').value;
            const deductedMinutes = parseInt(document.getElementById('add-deducted').value, 10) || 0;
            const note = document.getElementById('add-note').value.trim();

            if (!employeeId) {
              toast.warning('Vui lòng chọn nhân viên');
              return;
            }
            if (!checkIn) {
              toast.warning('Vui lòng nhập thời gian check-in');
              return;
            }
            if (checkOut && new Date(checkOut) <= new Date(checkIn)) {
              toast.warning('Thời gian check-out phải sau check-in');
              return;
            }

            try {
              const record = {
                employee_id: employeeId,
                check_in: new Date(checkIn).toISOString(),
                deducted_minutes: deductedMinutes,
                note: note || 'Thêm thủ công bởi admin',
              };

              if (checkOut) {
                record.check_out = new Date(checkOut).toISOString();
              }

              await createManualAttendance(record);
              closeModal();
              toast.success('Đã thêm bản ghi chấm công thủ công');
              await loadAttendance();
            } catch (err) {
              console.error('Lỗi thêm:', err);
              toast.error('Không thể thêm bản ghi: ' + (err.message || ''));
            }
          },
        },
      ],
    });
  }

  // ── Delete handler ──
  async function handleDelete(id) {
    const confirmed = await showConfirm(
      'Bạn có chắc muốn xóa bản ghi chấm công này? Hành động này không thể hoàn tác.',
      'Xóa bản ghi chấm công'
    );
    if (!confirmed) return;

    try {
      await deleteAttendance(id);
      toast.success('Đã xóa bản ghi chấm công');
      await loadAttendance();
    } catch (err) {
      console.error('Lỗi xóa:', err);
      toast.error('Không thể xóa bản ghi: ' + (err.message || ''));
    }
  }

  // ── Event listeners ──
  btnFilter.addEventListener('click', () => {
    console.log('Filter button clicked!');
    toast.info('Đang tải lại dữ liệu chấm công...');
    loadAttendance();
  });
  btnAddManual.addEventListener('click', () => {
    console.log('Add manual button clicked!');
    openAddManualModal();
  });
  btnBatchDeduct.addEventListener('click', () => {
    console.log('Batch deduct button clicked!');
    openBatchDeductModal();
  });

  // Preset range listeners
  presetToday.addEventListener('click', () => {
    const range = getTodayRange();
    filterStart.value = toInputDate(range.start);
    filterEnd.value = toInputDate(range.end);
    toast.info('Lọc nhanh: Hôm nay');
    loadAttendance();
  });

  presetYesterday.addEventListener('click', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = toInputDate(yesterday);
    filterStart.value = dateStr;
    filterEnd.value = dateStr;
    toast.info('Lọc nhanh: Hôm qua');
    loadAttendance();
  });

  presetWeek.addEventListener('click', () => {
    const range = getCurrentWeekRange();
    filterStart.value = toInputDate(range.start);
    filterEnd.value = toInputDate(range.end);
    toast.info('Lọc nhanh: Tuần này');
    loadAttendance();
  });

  presetMonth.addEventListener('click', () => {
    const range = getCurrentMonthRange();
    filterStart.value = toInputDate(range.start);
    filterEnd.value = toInputDate(range.end);
    toast.info('Lọc nhanh: Tháng này');
    loadAttendance();
  });

  // Allow Enter on filter fields to trigger filter
  [filterStart, filterEnd, filterEmployee].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        console.log('Enter key pressed on filter field!');
        loadAttendance();
      }
    });
  });

  // ── Batch Deduct Modal ──
  function openBatchDeductModal() {
    // Check if there are completed records to deduct
    const completedRecords = records.filter(r => r.check_out);
    if (completedRecords.length === 0) {
      toast.warning('Không có bản ghi chấm công hoàn tất nào để khấu trừ trong khoảng thời gian đã chọn!');
      return;
    }

    const content = `
      <form id="batch-deduct-form">
        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 15px;">
          Áp dụng khấu trừ số phút nghỉ/ăn cho tất cả <strong>${completedRecords.length}</strong> bản ghi chấm công đã hoàn thành đang hiển thị trong bảng dưới.
        </p>
        <div class="form-group">
          <label class="form-label">Số phút khấu trừ (VD: 60)</label>
          <input type="number" class="form-input" id="batch-deducted-input" value="60" min="0" required placeholder="Nhập số phút, VD: 60">
        </div>
      </form>
    `;

    showModal({
      title: '⏱️ Khấu trừ hàng loạt',
      content,
      size: 'medium',
      actions: [
        {
          label: 'Hủy',
          className: 'btn-outline',
          onClick: () => closeModal()
        },
        {
          label: '⚡ Áp dụng',
          className: 'btn-primary',
          onClick: async () => {
            const minutes = parseInt(document.getElementById('batch-deducted-input').value, 10);
            if (isNaN(minutes) || minutes < 0) {
              toast.warning('Vui lòng nhập số phút hợp lệ!');
              return;
            }

            closeModal();
            toast.info('Đang cập nhật hàng loạt...');

            try {
              // Batch update all matching records
              const promises = completedRecords.map(r => 
                updateAttendance(r.id, { ...r, deducted_minutes: minutes })
              );
              await Promise.all(promises);
              toast.success(`Đã khấu trừ ${minutes} phút cho ${completedRecords.length} bản ghi!`);
              await loadAttendance();
            } catch (err) {
              console.error('Lỗi khấu trừ hàng loạt:', err);
              toast.error('Có lỗi xảy ra khi cập nhật hàng loạt: ' + err.message);
            }
          }
        }
      ]
    });
  }

  // ── Initial load ──
  await loadEmployees();
  await loadAttendance();

  // ── Cleanup ──
  return () => {
    // Nothing specific to clean up
  };
}
