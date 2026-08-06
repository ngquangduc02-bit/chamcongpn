// ============================================================
// Employees Page - Quản lý nhân viên (CRUD)
// ============================================================

import { renderNavbar, setupNavbar } from '../components/navbar.js';
import { 
  getEmployees, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee, 
  getDevicesByEmployee, 
  isAdminLoggedIn 
} from '../supabase.js';
import { navigate } from '../utils/router.js';
import { toast } from '../components/toast.js';
import { showModal, closeModal, showConfirm } from '../components/modal.js';
import { formatCurrency } from '../utils/salary-calc.js';
import { formatDateTime } from '../utils/time.js';

export default async function employeesPage(container) {
  // Check auth
  if (!isAdminLoggedIn()) {
    navigate('/admin');
    return;
  }

  // Initial loading layout
  container.innerHTML = renderNavbar() + `
    <main class="main-content">
      <div class="container">
        <div class="page-header flex flex-between">
          <div>
            <h1 class="page-title">Quản Lý Nhân Viên</h1>
            <p class="page-subtitle">Thêm, sửa, xóa và quản lý thông tin nhân viên</p>
          </div>
          <button class="btn btn-primary" id="add-employee-btn">➕ Thêm nhân viên</button>
        </div>
        <div class="empty-state">
          <div class="loading-spinner"></div>
          <p>Đang tải danh sách nhân viên...</p>
        </div>
      </div>
    </main>
  `;
  setupNavbar();

  async function loadEmployeesList() {
    try {
      const employees = await getEmployees(false); // get all, even inactive
      
      // Get device counts for all employees in parallel
      const employeesWithDevices = await Promise.all(employees.map(async (emp) => {
        const devices = await getDevicesByEmployee(emp.id).catch(() => []);
        const activeDevices = devices.filter(d => d.is_active);
        return { ...emp, activeDeviceCount: activeDevices.length };
      }));

      const mainContent = container.querySelector('.main-content .container');
      
      if (employeesWithDevices.length === 0) {
        mainContent.innerHTML = `
          <div class="page-header flex flex-between">
            <div>
              <h1 class="page-title">Quản Lý Nhân Viên</h1>
              <p class="page-subtitle">Thêm, sửa, xóa và quản lý thông tin nhân viên</p>
            </div>
            <button class="btn btn-primary" id="add-employee-btn">➕ Thêm nhân viên</button>
          </div>
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <h2>Chưa có nhân viên</h2>
            <p>Hệ thống hiện tại chưa có nhân viên nào. Bấm nút phía dưới để thêm mới.</p>
            <button class="btn btn-primary mt-2" id="empty-add-btn">Thêm nhân viên ngay</button>
          </div>
        `;
        setupAddListeners();
        return;
      }

      // Render employees grid
      mainContent.innerHTML = `
        <div class="page-header flex flex-between">
          <div>
            <h1 class="page-title">Quản Lý Nhân Viên</h1>
            <p class="page-subtitle">Quán hiện có ${employeesWithDevices.length} nhân viên</p>
          </div>
          <button class="btn btn-primary" id="add-employee-btn">➕ Thêm nhân viên</button>
        </div>

        <div class="grid-3 gap-3" id="employees-grid">
          ${employeesWithDevices.map(emp => {
            const isHourly = emp.salary_type === 'hourly';
            const salaryText = isHourly 
              ? `${formatCurrency(emp.salary_rate)} / giờ`
              : `${formatCurrency(emp.salary_rate)} / tháng`;
            const salaryBadgeClass = isHourly ? 'badge-primary' : 'badge-purple';
            const statusClass = emp.is_active ? 'status-active' : 'status-inactive';
            const initial = emp.name.charAt(0).toUpperCase();

            // Xác định Avatar hiển thị (ảnh tải lên, emoji hoặc ký tự đầu)
            const avatarContent = emp.avatar_url
              ? (emp.avatar_url.startsWith('data:') || emp.avatar_url.startsWith('http')
                ? `<img src="${emp.avatar_url}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-default);" />`
                : `<div class="avatar-initial" style="width: 50px; height: 50px; font-size: 1.4rem; background: var(--bg-elevated); border: 2px solid var(--border-default); display: flex; align-items: center; justify-content: center; border-radius: 50%;">${emp.avatar_url}</div>`)
              : `<div class="avatar-initial" style="width: 50px; height: 50px; font-size: 1.5rem; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; border-radius: 50%;">${initial}</div>`;

            return `
              <div class="card employee-card ${!emp.is_active ? 'inactive-card' : ''}" style="position: relative;">
                <div class="flex gap-3 align-center mb-3">
                  ${avatarContent}
                  <div>
                    <h3 class="employee-name ${emp.pin === '0111' ? 'pink-sparkle-name' : ''}" style="margin:0; font-size: 1.2rem; color: var(--text-h);">${emp.name}</h3>
                    <div class="flex gap-2 align-center mt-1">
                      <span class="status-badge ${statusClass}">
                        ${emp.is_active ? 'Đang làm việc' : 'Đã nghỉ việc'}
                      </span>
                      <span class="badge ${salaryBadgeClass}">${isHourly ? 'Theo giờ' : 'Cố định'}</span>
                    </div>
                  </div>
                </div>

                <div class="employee-details" style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 20px;">
                  <div>📞 <strong>Điện thoại:</strong> ${emp.phone || 'Chưa cập nhật'}</div>
                  <div>🔑 <strong>Mã PIN đăng ký:</strong> <code style="color: var(--accent); font-weight: bold;">${emp.pin}</code></div>
                  <div>💰 <strong>Mức lương:</strong> ${salaryText}</div>
                  <div>📱 <strong>Thiết bị đăng ký:</strong> ${emp.activeDeviceCount > 0 ? `${emp.activeDeviceCount} thiết bị` : '<span class="text-danger">Chưa liên kết</span>'}</div>
                </div>

                <div class="flex gap-2">
                  <button class="btn btn-outline flex-1 edit-employee-btn" data-id="${emp.id}">
                    ✏️ Sửa
                  </button>
                  <button class="btn btn-outline flex-1 delete-employee-btn" data-id="${emp.id}" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2)">
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      setupAddListeners();
      setupEditDeleteListeners(employeesWithDevices);

    } catch (err) {
      console.error('Error loading employees:', err);
      toast.error('Lỗi khi tải dữ liệu nhân viên');
    }
  }

  function setupAddListeners() {
    const addBtn = document.getElementById('add-employee-btn');
    const emptyBtn = document.getElementById('empty-add-btn');

    const handler = () => showEmployeeFormModal();
    addBtn?.addEventListener('click', handler);
    emptyBtn?.addEventListener('click', handler);
  }

  function setupEditDeleteListeners(employees) {
    // Edit
    document.querySelectorAll('.edit-employee-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const emp = employees.find(e => e.id === id);
        if (emp) showEmployeeFormModal(emp);
      });
    });

    // Delete
    document.querySelectorAll('.delete-employee-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const emp = employees.find(e => e.id === id);
        if (emp) {
          const confirmed = await showConfirm(
            `Bạn có chắc chắn muốn xóa nhân viên "${emp.name}"? Hành động này sẽ xóa toàn bộ dữ liệu chấm công và thiết bị đã liên kết của người này.`
          );
          if (confirmed) {
            try {
              await deleteEmployee(id);
              toast.success('Đã xóa nhân viên thành công!');
              loadEmployeesList();
            } catch (err) {
              toast.error('Lỗi khi xóa nhân viên: ' + err.message);
            }
          }
        }
      });
    });
  }

  function showEmployeeFormModal(employee = null) {
    const isEdit = !!employee;
    const title = isEdit ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới';
    
    const content = `
      <form id="employee-modal-form">
        <div class="form-group">
          <label class="form-label" for="modal-name">Tên nhân viên</label>
          <input type="text" id="modal-name" class="form-input" value="${employee?.name || ''}" required placeholder="VD: Nguyễn Văn A" />
        </div>
        <div class="grid-2 gap-2">
          <div class="form-group">
            <label class="form-label" for="modal-pin">Mã PIN (4-6 chữ số)</label>
            <input type="text" id="modal-pin" class="form-input" pattern="[0-9]{4,6}" value="${employee?.pin || ''}" required placeholder="VD: 1234" />
          </div>
          <div class="form-group">
            <label class="form-label" for="modal-phone">Số điện thoại</label>
            <input type="tel" id="modal-phone" class="form-input" value="${employee?.phone || ''}" placeholder="VD: 0912345678" />
          </div>
        </div>
        <div class="grid-2 gap-2">
          <div class="form-group">
            <label class="form-label" for="modal-salary-type">Hình thức tính lương</label>
            <select id="modal-salary-type" class="form-input form-select" required>
              <option value="hourly" ${employee?.salary_type === 'hourly' ? 'selected' : ''}>Theo giờ</option>
              <option value="monthly" ${employee?.salary_type === 'monthly' ? 'selected' : ''}>Lương cố định (tháng)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="modal-salary-rate" id="salary-rate-label">Mức lương (đ/giờ)</label>
            <input type="number" id="modal-salary-rate" class="form-input" value="${employee?.salary_rate || ''}" required placeholder="VD: 30000" />
          </div>
        </div>
        
        <!-- Bổ sung phần chọn/tải ảnh đại diện (Avatar) -->
        <div class="form-group mt-2">
          <label class="form-label">Ảnh đại diện (Avatar)</label>
          <div class="avatar-picker-container flex gap-3 align-center" style="margin-top:8px;">
            <div class="avatar-preview-box" id="avatar-preview-box" style="width:60px; height:60px; border-radius:50%; background:#1d1d36; border:1px dashed var(--border-default); display:flex; align-items:center; justify-content:center; font-size:1.8rem; overflow:hidden;">
              ${employee?.avatar_url 
                ? (employee.avatar_url.startsWith('data:') || employee.avatar_url.startsWith('http')
                  ? `<img src="${employee.avatar_url}" style="width:100%; height:100%; object-fit:cover;" />`
                  : employee.avatar_url) 
                : '👤'}
            </div>
            
            <div class="avatar-picker-controls flex-1">
              <div class="flex gap-2 mb-2">
                <button type="button" class="btn btn-outline btn-sm" id="btn-upload-avatar" style="font-size:0.8rem; padding:4px 10px;">
                  📤 Tải ảnh
                </button>
                <input type="file" id="avatar-file-input" accept="image/*" style="display:none;" />
                
                <button type="button" class="btn btn-outline btn-sm text-danger" id="btn-clear-avatar" style="font-size:0.8rem; padding:4px 10px; display:${employee?.avatar_url ? 'inline-block' : 'none'};">
                  🗑️ Xóa
                </button>
              </div>
              
              <div class="avatar-emoji-list flex gap-2" style="flex-wrap:wrap;">
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🧑‍🍳">🧑‍🍳</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="👩‍🍳">👩‍🍳</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🦊">🦊</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🐼">🐼</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🦁">🦁</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🐯">🐯</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🐰">🐰</span>
                <span class="emoji-opt" style="cursor:pointer; font-size:1.3rem; padding:2px;" data-emoji="🐨">🐨</span>
              </div>
            </div>
          </div>
          <input type="hidden" id="modal-avatar-url" value="${employee?.avatar_url || ''}" />
        </div>

        ${isEdit ? `
          <div class="form-group mt-2">
            <label class="form-label flex align-center gap-2">
              <input type="checkbox" id="modal-is-active" ${employee.is_active ? 'checked' : ''} style="width: auto; margin: 0;" />
              <span>Đang làm việc (Nếu bỏ tích, nhân viên sẽ tạm khóa và không thể chấm công)</span>
            </label>
          </div>
        ` : ''}
      </form>
    `;

    showModal({
      title,
      content,
      size: 'medium',
      actions: [
        {
          label: 'Hủy',
          className: 'btn-outline',
          onClick: () => closeModal()
        },
        {
          label: isEdit ? 'Cập nhật' : 'Thêm mới',
          className: 'btn-primary',
          onClick: async () => {
            const form = document.getElementById('employee-modal-form');
            if (!form.reportValidity()) return;

            const name = document.getElementById('modal-name').value.trim();
            const pin = document.getElementById('modal-pin').value.trim();
            const phone = document.getElementById('modal-phone').value.trim();
            const salary_type = document.getElementById('modal-salary-type').value;
            const salary_rate = parseFloat(document.getElementById('modal-salary-rate').value);
            const avatar_url = document.getElementById('modal-avatar-url').value;
            const is_active = isEdit ? document.getElementById('modal-is-active').checked : true;

            if (pin.length < 4 || pin.length > 6) {
              toast.warning('Mã PIN phải từ 4 đến 6 chữ số!');
              return;
            }

            const data = { name, pin, phone, salary_type, salary_rate, avatar_url, is_active };

            try {
              if (isEdit) {
                await updateEmployee(employee.id, data);
                toast.success('Đã cập nhật thông tin nhân viên!');
              } else {
                await createEmployee(data);
                toast.success('Đã thêm nhân viên thành công!');
              }
              closeModal();
              loadEmployeesList();
            } catch (err) {
              toast.error('Lỗi: ' + err.message);
            }
          }
        }
      ]
    });

    // Auto update salary label on select change
    const typeSelect = document.getElementById('modal-salary-type');
    const rateLabel = document.getElementById('salary-rate-label');
    const rateInput = document.getElementById('modal-salary-rate');

    const updateLabel = () => {
      if (typeSelect.value === 'hourly') {
        rateLabel.textContent = 'Mức lương (đ/giờ)';
        rateInput.placeholder = 'VD: 30000';
      } else {
        rateLabel.textContent = 'Lương cố định (đ/tháng)';
        rateInput.placeholder = 'VD: 6000000';
      }
    };

    typeSelect.addEventListener('change', updateLabel);
    updateLabel(); // run initial

    // Đăng ký các sự kiện cho bộ chọn ảnh đại diện (avatar picker)
    setTimeout(() => {
      const uploadBtn = document.getElementById('btn-upload-avatar');
      const fileInput = document.getElementById('avatar-file-input');
      const clearBtn = document.getElementById('btn-clear-avatar');
      const avatarUrlInput = document.getElementById('modal-avatar-url');
      const previewBox = document.getElementById('avatar-preview-box');

      uploadBtn?.addEventListener('click', () => fileInput?.click());

      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
          toast.warning('Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.');
          return;
        }

        const reader = new FileReader();
        reader.onload = function(evt) {
          const img = new Image();
          img.onload = function() {
            // Nén ảnh bằng Canvas xuống 128x128px
            const canvas = document.createElement('canvas');
            const size = 128;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // Cắt ảnh theo tỉ lệ vuông ở tâm
            const minSize = Math.min(img.width, img.height);
            const sx = (img.width - minSize) / 2;
            const sy = (img.height - minSize) / 2;
            ctx.drawImage(img, sx, sy, minSize, minSize, 0, 0, size, size);
            
            // Chuyển sang Data URL dạng JPEG với chất lượng 85%
            const base64 = canvas.toDataURL('image/jpeg', 0.85);
            
            previewBox.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover;" />`;
            avatarUrlInput.value = base64;
            if (clearBtn) clearBtn.style.display = 'inline-block';
          };
          img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
      });

      clearBtn?.addEventListener('click', () => {
        previewBox.innerHTML = '👤';
        avatarUrlInput.value = '';
        clearBtn.style.display = 'none';
        if (fileInput) fileInput.value = '';
      });

      document.querySelectorAll('.avatar-emoji-list .emoji-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          const emoji = opt.textContent.trim();
          previewBox.innerHTML = emoji;
          avatarUrlInput.value = emoji;
          if (clearBtn) clearBtn.style.display = 'inline-block';
        });
      });
    }, 50);
  }

  // Load first time
  await loadEmployeesList();

  // Scoped CSS for cards
  const style = document.createElement('style');
  style.id = 'employees-scoped-css';
  style.textContent = `
    .employee-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      border-radius: var(--radius-md);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .employee-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow);
    }
    .inactive-card {
      opacity: 0.65;
      background: rgba(255, 255, 255, 0.02) !important;
      border-color: rgba(255,255,255,0.05) !important;
    }
    .badge-purple {
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
    }
  `;
  document.head.appendChild(style);

  return () => {
    const s = document.getElementById('employees-scoped-css');
    if (s) s.remove();
  };
}
