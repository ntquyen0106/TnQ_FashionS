import { useEffect } from 'react';
import ReactDOM from 'react-dom';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal({
  open,
  title = 'Xác nhận',
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  confirmType = 'danger',
  onConfirm,
  onCancel,
  disabled,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>{title}</div>
        <div className={styles.content}>{message}</div>
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.ghost}`}
            onClick={onCancel}
            disabled={disabled}
          >
            {cancelText}
          </button>
          <button
            className={`${styles.btn} ${confirmType === 'danger' ? styles.danger : styles.primary}`}
            onClick={onConfirm}
            disabled={disabled}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
