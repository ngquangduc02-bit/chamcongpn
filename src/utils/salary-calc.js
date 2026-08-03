// ============================================================
// Salary Calculator - Tính lương nhân viên
// ============================================================

/**
 * Tính lương cho 1 nhân viên trong khoảng thời gian
 * @param {Object} employee - Thông tin nhân viên
 * @param {Array} attendanceRecords - Danh sách bản ghi chấm công
 * @returns {Object} Kết quả tính lương
 */
export function calculateSalary(employee, attendanceRecords) {
  // Tính tổng giờ làm
  let totalHours = 0;
  let totalDays = 0;
  const dailyHours = {};

  for (const record of attendanceRecords) {
    if (record.check_in && record.check_out) {
      const rawHours = record.total_hours != null
        ? Number(record.total_hours)
        : (new Date(record.check_out) - new Date(record.check_in)) / (1000 * 60 * 60);
      
      // Nếu total_hours từ database chưa được khấu trừ (do chạy trigger cũ) hoặc được tính tay,
      // ta kiểm tra và chủ động trừ đi số phút khấu trừ nếu giá trị đó chưa được áp dụng vào total_hours.
      // Để an toàn và đồng bộ, ta tính toán lại giờ làm thực tế trực tiếp từ thời gian checkin/out và trừ đi số phút ăn nghỉ.
      const rawDuration = (new Date(record.check_out) - new Date(record.check_in)) / (1000 * 60 * 60);
      const deduction = (record.deducted_minutes || 0) / 60;
      const hours = Math.max(0, rawDuration - deduction);
      
      totalHours += hours;

      // Nhóm theo ngày
      const day = new Date(record.check_in).toISOString().split('T')[0];
      if (!dailyHours[day]) {
        dailyHours[day] = 0;
        totalDays++;
      }
      dailyHours[day] += hours;
    }
  }

  let salary = 0;
  let details = {};

  if (employee.salary_type === 'hourly') {
    // Lương theo giờ
    salary = totalHours * employee.salary_rate;
    details = {
      type: 'hourly',
      typeName: 'Theo giờ',
      rate: employee.salary_rate,
      totalHours: Math.round(totalHours * 100) / 100,
      totalDays,
      salary: Math.round(salary),
    };
  } else {
    // Lương cố định theo tháng
    // Tính dựa trên số ngày làm thực tế / 26 ngày công chuẩn
    const standardDays = 26;
    const dailyRate = employee.salary_rate / standardDays;
    salary = dailyRate * totalDays;
    details = {
      type: 'monthly',
      typeName: 'Cố định',
      monthlyRate: employee.salary_rate,
      standardDays,
      actualDays: totalDays,
      dailyRate: Math.round(dailyRate),
      totalHours: Math.round(totalHours * 100) / 100,
      salary: Math.round(salary),
    };
  }

  return {
    employee,
    records: attendanceRecords,
    dailyHours,
    ...details,
  };
}

/**
 * Tính lương cho tất cả nhân viên
 * @param {Array} employees
 * @param {Array} allAttendance
 * @returns {Array} Kết quả tính lương cho từng nhân viên
 */
export function calculateAllSalaries(employees, allAttendance) {
  return employees.map((emp) => {
    const empRecords = allAttendance.filter((a) => a.employee_id === emp.id);
    return calculateSalary(emp, empRecords);
  });
}

/**
 * Format tiền VNĐ
 * @param {number} amount
 * @returns {string} VD: "5.000.000đ"
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ';
}
