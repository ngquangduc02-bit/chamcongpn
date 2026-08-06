// ============================================================
// Export Utility - Tiện ích xuất dữ liệu Excel/CSV
// ============================================================

import { formatDate, formatTime, getDayName, calculateHours } from './time.js';

/**
 * Xuất dữ liệu mảng hai chiều ra file CSV tương thích với Excel (hỗ trợ tiếng Việt UTF-8)
 * @param {string} filename - Tên file tải về (VD: "bang_luong.csv")
 * @param {Array<string>} headers - Tiêu đề các cột
 * @param {Array<Array<any>>} rows - Các dòng dữ liệu
 */
export function exportToCSV(filename, headers, rows) {
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    str = str.replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCSV).join(',');
  const rowLines = rows.map(row => row.map(escapeCSV).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Xuất file Excel (.xls) có định dạng bảng tổng và các bảng chi tiết riêng từng người,
 * được đóng khung viền (border) đẹp đẽ, chuẩn chỉnh theo tiêu chuẩn của Microsoft Excel.
 */
export function exportToFormattedExcel(filename, month, year, data) {
  const fmtNum = (val) => (val != null && !isNaN(val) ? Math.round(val).toLocaleString('vi-VN') : '0');
  const fmtHours = (val) => (val != null && !isNaN(val) ? Number(val).toFixed(2) : '0.00');

  const totalSalary = data.reduce((sum, d) => sum + (d.salary || 0), 0);
  const totalHoursAll = data.reduce((sum, d) => sum + (d.totalHours || 0), 0);

  // Khởi tạo HTML Excel
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Bảng Lương Tháng ${month}-${year}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; width: 100%; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #475569; padding: 8px; }
        td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
        .title-cell { font-size: 16pt; font-weight: bold; color: #0f172a; text-align: center; padding: 14px; background-color: #e2e8f0; border: 1px solid #94a3b8; }
        .section-header { font-size: 12pt; font-weight: bold; color: #1e3a8a; background-color: #dbeafe; padding: 10px; border: 1px solid #93c5fd; text-align: left; }
        .sub-th { background-color: #334155; color: #ffffff; font-weight: bold; text-align: center; border: 1px solid #64748b; padding: 6px; }
        .total-row td { background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; }
        .emp-summary-row td { background-color: #eff6ff; font-weight: bold; border-top: 1.5px solid #3b82f6; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
      </style>
    </head>
    <body>
      <table>
        <!-- 1. BẢNG TỔNG HỢP (SUMMARY TABLE) -->
        <tr>
          <td colspan="7" class="title-cell">BẢNG TỔNG HỢP LƯƠNG NHÂN VIÊN - THÁNG ${month}/${year}</td>
        </tr>
        <tr><td colspan="7" style="border:none; height: 10px;"></td></tr>

        <tr>
          <th style="width: 50px;">STT</th>
          <th style="width: 220px;">Họ và Tên Nhân Viên</th>
          <th style="width: 130px;">Loại Lương</th>
          <th style="width: 110px;">Số Ngày Làm</th>
          <th style="width: 130px;">Tổng Giờ Làm</th>
          <th style="width: 160px;">Mức Lương / Đơn Giá</th>
          <th style="width: 180px;">Thành Tiền (VNĐ)</th>
        </tr>
  `;

  // Các dòng tổng hợp nhân viên
  data.forEach((item, index) => {
    const stt = index + 1;
    const empName = item.employee?.name || 'Không rõ';
    const typeName = item.typeName;
    const days = item.type === 'monthly' ? item.actualDays : item.totalDays;
    const hours = fmtHours(item.totalHours);
    const rateVal = item.type === 'hourly' ? item.rate : item.monthlyRate;
    const rateUnit = item.type === 'hourly' ? 'đ/giờ' : 'đ/tháng';
    const rateStr = `${fmtNum(rateVal)} ${rateUnit}`;
    const salaryStr = fmtNum(item.salary);

    html += `
      <tr>
        <td class="text-center">${stt}</td>
        <td class="text-left"><b>${empName}</b></td>
        <td class="text-center">${typeName}</td>
        <td class="text-center">${days} ngày</td>
        <td class="text-right">${hours} giờ</td>
        <td class="text-right">${rateStr}</td>
        <td class="text-right"><b>${salaryStr} đ</b></td>
      </tr>
    `;
  });

  // Dòng tổng cộng toàn quán
  html += `
    <tr class="total-row">
      <td colspan="3" class="text-right"><b>TỔNG CỘNG TOÀN QUÁN:</b></td>
      <td class="text-center">-</td>
      <td class="text-right"><b>${fmtHours(totalHoursAll)} giờ</b></td>
      <td class="text-right">-</td>
      <td class="text-right" style="color: #b91c1c; font-size: 12pt;"><b>${fmtNum(totalSalary)} đ</b></td>
    </tr>
  `;

  // 2. BẢNG CHI TIẾT TỪNG NGƯỜI (INDIVIDUAL TABLES)
  data.forEach((item) => {
    const empName = item.employee?.name || 'Chưa đặt tên';

    // Nhóm bản ghi theo ngày
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

    // Thêm khoảng trống ngăn cách giữa các bảng
    html += `
      <tr><td colspan="7" style="border:none; height: 25px;"></td></tr>
      <tr>
        <td colspan="7" class="section-header">👤 BẢNG KÊ CHI TIẾT CA LÀM: ${empName.toUpperCase()}</td>
      </tr>
      <tr>
        <th class="sub-th" style="width: 50px;">STT</th>
        <th class="sub-th">Ngày Làm</th>
        <th class="sub-th">Giờ Vào (Check-in)</th>
        <th class="sub-th">Giờ Ra (Check-out)</th>
        <th class="sub-th">Trừ Ăn/Nghỉ</th>
        <th class="sub-th" colspan="2">Số Giờ Thực Làm</th>
      </tr>
    `;

    let subIndex = 0;
    let empTotalHours = 0;

    sortedDays.forEach((dayKey) => {
      const recs = recordsByDay[dayKey];
      recs.forEach((r) => {
        subIndex++;
        const dateFormatted = formatDate(r.check_in);
        const inTime = formatTime(r.check_in);
        const outTime = r.check_out ? formatTime(r.check_out) : 'Chưa check-out';
        const deduction = r.deducted_minutes > 0 ? `${r.deducted_minutes} phút` : '0';

        let shiftHours = 0;
        if (r.check_out) {
          const raw = calculateHours(r.check_in, r.check_out);
          const deductVal = (r.deducted_minutes || 0) / 60;
          shiftHours = Math.max(0, raw - deductVal);
        }
        empTotalHours += shiftHours;

        html += `
          <tr>
            <td class="text-center">${subIndex}</td>
            <td class="text-center">${dateFormatted}</td>
            <td class="text-center">${inTime}</td>
            <td class="text-center">${outTime}</td>
            <td class="text-center">${deduction}</td>
            <td class="text-right" colspan="2">${fmtHours(shiftHours)} giờ</td>
          </tr>
        `;
      });
    });

    // Dòng tổng kết cho nhân viên này
    html += `
      <tr class="emp-summary-row">
        <td colspan="5" class="text-right"><b>TỔNG CỘNG TÍNH LƯƠNG CHO ${empName.toUpperCase()}:</b></td>
        <td class="text-right" colspan="2" style="color: #1d4ed8;"><b>${fmtHours(empTotalHours)} giờ (${fmtNum(item.salary)} đ)</b></td>
      </tr>
    `;
  });

  html += `
      </table>
    </body>
    </html>
  `;

  // Tải file .xls tương thích hoàn hảo Microsoft Excel với đầy đủ viền (border) và màu sắc
  const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.replace(/\.csv$/, '.xls'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
