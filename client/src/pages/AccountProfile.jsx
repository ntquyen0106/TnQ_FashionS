import { useEffect, useState } from 'react';
import authApi from '@/api/auth-api';
import { useAuth } from '@/auth/AuthProvider';
import toast from 'react-hot-toast';
import styles from './AccountProfile.module.css';

export default function AccountProfile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user]);

  const save = async () => {
    if (!name.trim()) return toast.error('Vui lòng nhập họ tên');
    if (!email.trim()) return toast.error('Vui lòng nhập email');
    const emailRe = /.+@.+\..+/;
    if (!emailRe.test(email.trim())) return toast.error('Email không hợp lệ');
    setSaving(true);
    try {
      const res = await authApi.updateProfile({ name: name.trim(), email: email.trim() });
      if (res?.user) setUser(res.user);
      toast.success('Cập nhật thành công');
      setIsEditing(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Lỗi cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const initial = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Thông tin cá nhân</h2>
          </div>
          <div className={styles.headerActions}>
            {!isEditing ? (
              <button className={styles.btnGhost} onClick={() => setIsEditing(true)}>
                Chỉnh sửa
              </button>
            ) : (
              <button
                className={styles.btnGhost}
                onClick={() => {
                  setName(user?.name || '');
                  setEmail(user?.email || '');
                  setIsEditing(false);
                }}
              >
                Hủy
              </button>
            )}
          </div>
        </div>

        {!isEditing ? (
          <div className={styles.info}>
            <div className={styles.infoRow}>
              <div className={styles.k}>Họ tên</div>
              <div className={styles.v}>{user?.name || '-'}</div>
            </div>
            <div className={styles.infoRow}>
              <div className={styles.k}>Email</div>
              <div className={styles.v}>{user?.email || '-'}</div>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Họ tên</label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ tên"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className={styles.actions}>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
