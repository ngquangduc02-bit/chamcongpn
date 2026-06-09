// ============================================================
// Hash-based SPA Router
// ============================================================

const routes = {};
let currentCleanup = null;
let appContainer = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/checkin';
}

export function initRouter(containerId = 'app') {
  appContainer = document.getElementById(containerId);

  async function handleRoute() {
    const path = getCurrentRoute();

    // Run cleanup for previous page
    if (currentCleanup && typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }

    // Add page transition
    appContainer.classList.add('page-exit');

    await new Promise((r) => setTimeout(r, 150));

    const handler = routes[path] || routes['/404'] || (() => {
      appContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h2>Không tìm thấy trang</h2>
          <p>Trang bạn tìm kiếm không tồn tại.</p>
          <button class="btn btn-primary" onclick="location.hash='#/checkin'">Về trang chủ</button>
        </div>
      `;
    });

    const cleanup = await handler(appContainer);
    if (cleanup) currentCleanup = cleanup;

    appContainer.classList.remove('page-exit');
    appContainer.classList.add('page-enter');

    await new Promise((r) => setTimeout(r, 300));
    appContainer.classList.remove('page-enter');
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}
