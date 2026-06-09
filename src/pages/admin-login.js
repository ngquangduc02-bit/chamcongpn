// ============================================================
// Admin Login Page
// ============================================================

import { isAdminLoggedIn, setAdminSession, verifyAdminPassword } from '../supabase.js';
import { navigate } from '../utils/router.js';
import { toast } from '../components/toast.js';

export default async function adminLoginPage(container) {
  // Already logged in? Go to dashboard
  if (isAdminLoggedIn()) {
    navigate('/dashboard');
    return;
  }

  container.innerHTML = `
    <div class="login-page">
      <div class="login-card card">
        <div class="login-header">
          <div class="login-icon">🔐</div>
          <h1 class="login-title">Quản Trị Viên</h1>
          <p class="login-subtitle">Đăng nhập để quản lý chấm công</p>
        </div>
        
        <form id="login-form" class="login-form">
          <div class="form-group">
            <label class="form-label" for="admin-password">Mật khẩu</label>
            <div class="password-input-wrapper">
              <input 
                type="password" 
                id="admin-password" 
                class="form-input" 
                placeholder="Nhập mật khẩu admin"
                autocomplete="current-password"
                required
              />
              <button type="button" class="password-toggle" id="toggle-password">
                👁️
              </button>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-block" id="login-btn">
            <span id="login-btn-text">Đăng nhập</span>
            <span id="login-btn-loading" class="hidden">⏳ Đang xử lý...</span>
          </button>
        </form>

        <div class="login-footer">
          <a href="#/checkin" class="login-back-link">← Về trang chấm công</a>
        </div>
      </div>
    </div>
  `;

  // Toggle password visibility
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('admin-password');
  
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    toggleBtn.textContent = isPassword ? '🙈' : '👁️';
  });

  // Login form
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = passwordInput.value.trim();
    if (!password) {
      toast.warning('Vui lòng nhập mật khẩu');
      return;
    }

    const btnText = document.getElementById('login-btn-text');
    const btnLoading = document.getElementById('login-btn-loading');
    const loginBtn = document.getElementById('login-btn');

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    loginBtn.disabled = true;

    try {
      const isValid = await verifyAdminPassword(password);
      
      if (isValid) {
        setAdminSession();
        toast.success('Đăng nhập thành công!');
        setTimeout(() => navigate('/dashboard'), 500);
      } else {
        toast.error('Mật khẩu không đúng!');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Lỗi kết nối. Vui lòng kiểm tra cấu hình Supabase.');
    } finally {
      btnText.classList.remove('hidden');
      btnLoading.classList.add('hidden');
      loginBtn.disabled = false;
    }
  });

  // Auto focus password
  passwordInput.focus();
}
