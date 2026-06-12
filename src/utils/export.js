// ============================================================
// Export Utility - Tiện ích xuất dữ liệu Excel/CSV
// ============================================================

/**
 * Xuất dữ liệu mảng hai chiều ra file CSV tương thích với Excel (hỗ trợ tiếng Việt UTF-8)
 * @param {string} filename - Tên file tải về (VD: "bang_luong.csv")
 * @param {Array<string>} headers - Tiêu đề các cột
 * @param {Array<Array<any>>} rows - Các dòng dữ liệu
 */
export function exportToCSV(filename, headers, rows) {
  // Hàm xử lý escape ký tự đặc biệt trong CSV
  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    
    // Nếu có chứa dấu nháy kép, cần nhân đôi dấu nháy
    str = str.replace(/"/g, '""');
    
    // Nếu chứa dấu phẩy, dấu nháy kép hoặc dấu xuống dòng, bọc trong cặp nháy kép
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = `"${str}"`;
    }
    return str;
  };

  // Tạo nội dung CSV
  const headerLine = headers.map(escapeCSV).join(',');
  const rowLines = rows.map(row => row.map(escapeCSV).join(','));
  const csvContent = [headerLine, ...rowLines].join('\r\n');

  // Thêm UTF-8 BOM (Byte Order Mark) để Excel mở trực tiếp không bị lỗi tiếng Việt
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

  // Tạo link ẩn và kích hoạt tải về
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
