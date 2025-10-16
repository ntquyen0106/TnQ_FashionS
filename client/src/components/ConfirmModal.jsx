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
  hideCancel = false,
  contentClassName,
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

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevPadRight = document.body.style.paddingRight;
    // Compensate scrollbar to avoid layout shift
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadRight;
    };
  }, [open]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>{title}</div>
        <div className={`${styles.content} ${contentClassName || ''}`}>{message}</div>
        <div className={styles.actions}>
          {!hideCancel && (
            <button
              className={`${styles.btn} ${styles.ghost}`}
              onClick={onCancel}
              disabled={disabled}
            >
              {cancelText}
            </button>
          )}
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
