// ============================================================
// Main Entry Point - Chấm Công App
// ============================================================

import './styles/index.css';
import { registerRoute, initRouter } from './utils/router.js';

// Import pages
import checkinPage from './pages/checkin.js';
import adminLoginPage from './pages/admin-login.js';
import dashboardPage from './pages/dashboard.js';
import employeesPage from './pages/employees.js';
import attendancePage from './pages/attendance.js';
import salaryPage from './pages/salary.js';
import settingsPage from './pages/settings.js';

// Register routes
registerRoute('/checkin', checkinPage);
registerRoute('/admin', adminLoginPage);
registerRoute('/dashboard', dashboardPage);
registerRoute('/employees', employeesPage);
registerRoute('/attendance', attendancePage);
registerRoute('/salary', salaryPage);
registerRoute('/settings', settingsPage);

// Hide loading screen and start router
function init() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('loading-fade');
    setTimeout(() => loadingScreen.remove(), 500);
  }

  // Default to checkin page
  if (!window.location.hash) {
    window.location.hash = '#/checkin';
  }

  initRouter('app');
}

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
