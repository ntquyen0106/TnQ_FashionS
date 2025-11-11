import { createRoot } from 'react-dom/client';
import styles from './Toast.module.css';

let toastContainer = null;
let toastRoot = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = styles.toastContainer;
    document.body.appendChild(toastContainer);
    toastRoot = createRoot(toastContainer);
  }
  return { container: toastContainer, root: toastRoot };
}

function Toast({ message, type, onClose }) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.icon}>{icons[type]}</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeBtn} onClick={onClose}>
        ×
      </button>
    </div>
  );
}

let toastId = 0;
const activeToasts = new Map();

export function showToast(message, type = 'info', duration = 3000) {
  const { container, root } = getToastContainer();
  const id = ++toastId;

  const removeToast = () => {
    activeToasts.delete(id);
    renderToasts();
  };

  activeToasts.set(id, {
    id,
    message,
    type,
    onClose: removeToast,
  });

  renderToasts();

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

function renderToasts() {
  const { root } = getToastContainer();
  const toasts = Array.from(activeToasts.values());

  root.render(
    <div className={styles.toastList}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>,
  );
}

// Convenience methods
export const toast = {
  success: (message, duration) => showToast(message, 'success', duration),
  error: (message, duration) => showToast(message, 'error', duration),
  warning: (message, duration) => showToast(message, 'warning', duration),
  info: (message, duration) => showToast(message, 'info', duration),
};
