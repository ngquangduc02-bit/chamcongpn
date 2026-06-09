// ============================================================
// Navbar Component - Admin Navigation
// ============================================================

import { isAdminLoggedIn, clearAdminSession } from '../supabase.js';
import { navigate } from '../utils/router.js';

/**
 * Render admin navbar
 */
export function renderNavbar() {
  const isAdmin = isAdminLoggedIn();

  if (!isAdmin) return '';

  return `
    <nav class="navbar" id="admin-navbar">
      <div class="navbar-brand">
        <span class="navbar-logo">⏱️</span>
        <span class="navbar-title">Chấm Công</span>
      </div>
      <div class="navbar-menu" id="navbar-menu">
        <a href="#/dashboard" class="navbar-link" data-page="/dashboard">
          <span class="navbar-link-icon">📊</span>
          <span>Dashboard</span>
        </a>
        <a href="#/employees" class="navbar-link" data-page="/employees">
          <span class="navbar-link-icon">👥</span>
          <span>Nhân viên</span>
        </a>
        <a href="#/attendance" class="navbar-link" data-page="/attendance">
          <span class="navbar-link-icon">📋</span>
          <span>Chấm công</span>
        </a>
        <a href="#/salary" class="navbar-link" data-page="/salary">
          <span class="navbar-link-icon">💰</span>
          <span>Lương</span>
        </a>
        <a href="#/settings" class="navbar-link" data-page="/settings">
          <span class="navbar-link-icon">⚙️</span>
          <span>Cài đặt</span>
        </a>
      </div>
      <div class="navbar-actions">
        <button class="btn btn-outline btn-sm" id="navbar-logout-btn">
          🚪 Đăng xuất
        </button>
      </div>
      <button class="navbar-toggle" id="navbar-toggle">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </nav>
  `;
}

/**
 * Setup navbar event handlers
 */
export function setupNavbar() {
  const logoutBtn = document.getElementById('navbar-logout-btn');
  const toggleBtn = document.getElementById('navbar-toggle');
  const menu = document.getElementById('navbar-menu');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAdminSession();
      navigate('/admin');
    });
  }

  if (toggleBtn && menu) {
    toggleBtn.addEventListener('click', () => {
      menu.classList.toggle('navbar-menu-open');
      toggleBtn.classList.toggle('active');
    });
  }

  // Highlight active link
  updateActiveLink();
}

function updateActiveLink() {
  const currentPath = window.location.hash.slice(1) || '/checkin';
  document.querySelectorAll('.navbar-link').forEach((link) => {
    const page = link.getAttribute('data-page');
    if (page === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}
