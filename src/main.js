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
import reportPage from './pages/report.js';

// Register routes
registerRoute('/checkin', checkinPage);
registerRoute('/admin', adminLoginPage);
registerRoute('/dashboard', dashboardPage);
registerRoute('/employees', employeesPage);
registerRoute('/attendance', attendancePage);
registerRoute('/salary', salaryPage);
registerRoute('/settings', settingsPage);
registerRoute('/report', reportPage);

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

  // Đăng ký Service Worker cho PWA (Chỉ chạy ở môi trường production để tránh cache code khi phát triển)
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('PWA Service Worker registered:', reg.scope))
        .catch((err) => console.error('PWA Service Worker registration failed:', err));
    });
  }
}

// Global particle effect for pink sparkle names (PIN 0111 / Thảo)
document.addEventListener('mouseover', (e) => {
  const pinkElem = e.target.closest('.pink-sparkle-name');
  if (!pinkElem) return;

  if (pinkElem.dataset.lastHeart && Date.now() - Number(pinkElem.dataset.lastHeart) < 250) return;
  pinkElem.dataset.lastHeart = String(Date.now());

  const rect = pinkElem.getBoundingClientRect();
  const heart = document.createElement('span');
  heart.className = 'floating-heart-particle';
  const hearts = ['💖', '💕', '🌸', '✨', '💗', '💓'];
  heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
  
  const x = e.clientX || (rect.left + rect.width / 2);
  const y = e.clientY || rect.top;
  
  heart.style.left = `${x + (Math.random() * 24 - 12)}px`;
  heart.style.top = `${y - 10}px`;

  document.body.appendChild(heart);

  setTimeout(() => heart.remove(), 1200);
});

// Start app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
