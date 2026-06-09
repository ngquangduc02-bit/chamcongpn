// ============================================================
// Modal Component
// ============================================================

let activeModal = null;

/**
 * Hiển thị modal dialog
 * @param {Object} options
 * @param {string} options.title - Tiêu đề
 * @param {string} options.content - Nội dung HTML
 * @param {string} [options.size='medium'] - Kích thước: 'small', 'medium', 'large'
 * @param {Function} [options.onClose] - Callback khi đóng
 * @param {Array} [options.actions] - Các nút hành động [{label, className, onClick}]
 * @returns {HTMLElement} Modal element
 */
export function showModal(options) {
  closeModal(); // Đóng modal cũ nếu có

  const {
    title,
    content,
    size = 'medium',
    onClose,
    actions = [],
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';

  const actionsHtml = actions.length > 0
    ? `<div class="modal-actions">
        ${actions.map((a, i) => `<button class="btn ${a.className || 'btn-outline'}" data-action-index="${i}">${a.label}</button>`).join('')}
       </div>`
    : '';

  overlay.innerHTML = `
    <div class="modal modal-${size}">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">
        ${content}
      </div>
      ${actionsHtml}
    </div>
  `;

  document.body.appendChild(overlay);
  activeModal = overlay;

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Close handlers
  overlay.querySelector('#modal-close-btn').addEventListener('click', () => {
    closeModal();
    onClose?.();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
      onClose?.();
    }
  });

  // Action button handlers
  actions.forEach((action, i) => {
    const btn = overlay.querySelector(`[data-action-index="${i}"]`);
    if (btn && action.onClick) {
      btn.addEventListener('click', () => action.onClick(overlay));
    }
  });

  // ESC to close
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      onClose?.();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return overlay;
}

/**
 * Đóng modal hiện tại
 */
export function closeModal() {
  if (activeModal) {
    activeModal.classList.remove('active');
    activeModal.classList.add('modal-closing');
    setTimeout(() => {
      activeModal?.remove();
      activeModal = null;
    }, 200);
  }
}

/**
 * Hiện confirm dialog
 * @param {string} message
 * @param {string} [title='Xác nhận']
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = 'Xác nhận') {
  return new Promise((resolve) => {
    showModal({
      title,
      content: `<p style="font-size: 1rem; line-height: 1.6; color: var(--text-secondary);">${message}</p>`,
      size: 'small',
      onClose: () => resolve(false),
      actions: [
        {
          label: 'Hủy',
          className: 'btn-outline',
          onClick: (modal) => { closeModal(); resolve(false); },
        },
        {
          label: 'Xác nhận',
          className: 'btn-danger',
          onClick: (modal) => { closeModal(); resolve(true); },
        },
      ],
    });
  });
}

/**
 * Lấy modal body element để thao tác DOM
 */
export function getModalBody() {
  return activeModal?.querySelector('.modal-body');
}
