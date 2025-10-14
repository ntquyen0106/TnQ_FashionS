import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import authApi from '../api/auth-api.js';
import styles from './AddressBook.module.css';
import toast from 'react-hot-toast';
import { provinces } from '../constants/vnLocations.js';
import EmptyState from '@/components/EmptyState';

export default function AddressBook() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const back = state?.back || '/checkout';
  const selectedIds = Array.isArray(state?.selectedIds) ? state.selectedIds : undefined;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    city: '',
    district: '',
    ward: '',
    line1: '',
  });
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');

  const load = async () => {
    try {
      const res = await authApi.getAddresses();
      setList(Array.isArray(res) ? res : res?.addresses || res?.data?.addresses || []);
    } catch (err) {
      console.warn('load addresses error', err);
      toast.error('Không tải được danh sách địa chỉ');
    }
  };

  useEffect(() => {
    if (state?.addOnly || state?.mode === 'add-only') {
      onEdit(null);
      return; // skip initial load in add-only mode
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEdit = (addr) => {
    setEditing(addr?._id || 'new');
    const base = addr
      ? {
          fullName: addr.fullName || '',
          phone: addr.phone || '',
          city: addr.city || '',
          district: addr.district || '',
          ward: addr.ward || '',
          line1: addr.line1 || addr.street || '',
        }
      : { fullName: '', phone: '', city: '', district: '', ward: '', line1: '' };
    setForm(base);
    // Try to map to combo if possible
    const p = provinces.find((p) => p.name === base.city);
    if (p) {
      // setUseCombo(true); // Removed manual entry toggle
      setSelectedProvinceCode(p.code);
      const d = p.districts.find((d) => d.name === base.district);
      if (d) {
        setSelectedDistrictCode(d.code);
        const w = d.wards.find((w) => w.name === base.ward);
        if (w) setSelectedWardCode(w.code);
        else setSelectedWardCode('');
      } else {
        setSelectedDistrictCode('');
        setSelectedWardCode('');
      }
    } else {
      setSelectedProvinceCode('');
      setSelectedDistrictCode('');
      setSelectedWardCode('');
    }
  };

  const onSave = async () => {
    if (
      !form.fullName ||
      !form.phone ||
      !form.city ||
      !form.district ||
      !form.ward ||
      !form.line1
    ) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setLoading(true);
    try {
      if (editing === 'new') {
        const res = await authApi.addAddress(form);
        toast.success('Đã thêm địa chỉ');
        if (state?.addOnly || state?.mode === 'add-only') {
          // Try to grab new address id from response
          const addresses = res?.addresses || res?.data?.addresses;
          const newAddr = Array.isArray(addresses) ? addresses[addresses.length - 1] : null;
          navigate(back, { state: { addressId: newAddr?._id || undefined, selectedIds } });
          return;
        }
      } else {
        await authApi.updateAddress(editing, form);
        toast.success('Đã cập nhật địa chỉ');
      }
      setEditing(null);
      await load();
    } catch (err) {
      console.warn('save address error', err);
      toast.error(err?.response?.data?.message || 'Lỗi lưu địa chỉ');
    } finally {
      setLoading(false);
    }
  };

  const setDefault = async (id) => {
    try {
      await authApi.setDefaultAddress(id);
      await load();
    } catch (err) {
      console.warn('set default address error', err);
    }
  };
  const onDelete = async (id) => {
    try {
      await authApi.deleteAddress(id);
      toast.success('Đã xóa');
      await load();
    } catch {
      toast.error('Xóa thất bại');
    }
  };
  const clearAll = async () => {
    try {
      await authApi.clearAddresses();
      toast.success('Đã xóa tất cả');
      await load();
    } catch (err) {
      console.warn('clear addresses error', err);
    }
  };

  const defaultId = useMemo(() => list.find((a) => a.isDefault)?._id, [list]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate(back, { state: { selectedIds } })}
          aria-label="Quay lại"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
            <path d="M20 12H9" />
          </svg>
        </button>
        <h2 className={styles.title}>Sổ địa chỉ</h2>
        {!state?.addOnly && state?.mode !== 'add-only' && (
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => onEdit(null)}>
              + Thêm địa chỉ
            </button>
            {list.length > 0 && (
              <button className={styles.dangerBtn} onClick={clearAll}>
                Xóa tất cả
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className={styles.section}>
          <h3>{editing === 'new' ? 'Thêm địa chỉ' : 'Sửa địa chỉ'}</h3>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Họ và tên</label>
              <input
                placeholder="Ví dụ: Nguyễn Văn A"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Số điện thoại</label>
              <input
                placeholder="Ví dụ: 09xxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className={styles.selectRow}>
              <div className={styles.field}>
                <label className={styles.label}>Tỉnh/Thành phố</label>
                <select
                  className={styles.select}
                  value={selectedProvinceCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedProvinceCode(code);
                    setSelectedDistrictCode('');
                    setSelectedWardCode('');
                    const p = provinces.find((x) => x.code === code);
                    setForm({ ...form, city: p?.name || '', district: '', ward: '' });
                  }}
                >
                  <option value="">Chọn Tỉnh/Thành phố</option>
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Quận/Huyện</label>
                <select
                  className={styles.select}
                  value={selectedDistrictCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedDistrictCode(code);
                    setSelectedWardCode('');
                    const p = provinces.find((x) => x.code === selectedProvinceCode);
                    const d = p?.districts.find((x) => x.code === code);
                    setForm({ ...form, district: d?.name || '', ward: '' });
                  }}
                  disabled={!selectedProvinceCode}
                >
                  <option value="">Chọn Quận/Huyện</option>
                  {provinces
                    .find((p) => p.code === selectedProvinceCode)
                    ?.districts?.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phường/Xã</label>
                <select
                  className={styles.select}
                  value={selectedWardCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setSelectedWardCode(code);
                    const p = provinces.find((x) => x.code === selectedProvinceCode);
                    const d = p?.districts.find((x) => x.code === selectedDistrictCode);
                    const w = d?.wards.find((x) => x.code === code);
                    setForm({ ...form, ward: w?.name || '' });
                  }}
                  disabled={!selectedDistrictCode}
                >
                  <option value="">Chọn Phường/Xã</option>
                  {provinces
                    .find((p) => p.code === selectedProvinceCode)
                    ?.districts?.find((d) => d.code === selectedDistrictCode)
                    ?.wards?.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Địa chỉ chi tiết</label>
              <input
                placeholder="Số nhà, tên đường, toà nhà..."
                value={form.line1}
                onChange={(e) => setForm({ ...form, line1: e.target.value })}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.secondaryBtn}
              onClick={() => {
                if (state?.addOnly || state?.mode === 'add-only') {
                  navigate(back, { state: { selectedIds } });
                } else {
                  setEditing(null);
                }
              }}
            >
              Hủy
            </button>
            {/* Manual entry removed: enforce chọn theo danh mục only */}
            <button className={styles.primaryBtn} disabled={loading} onClick={onSave}>
              {loading ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </div>
      )}

      {!(state?.addOnly || state?.mode === 'add-only') && (
        <div className={styles.list}>
          {list.map((a) => (
            <div key={a._id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.addrName}>
                  <strong>{a.fullName}</strong> · {a.phone}
                </div>
                {a._id === defaultId && <span className={styles.badgeDefault}>Mặc định</span>}
              </div>
              <div className={styles.addrLine}>
                {a.line1 || a.street}, {a.ward}, {a.district}, {a.city}
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.linkBtn}
                  onClick={() => {
                    setDefault(a._id);
                  }}
                >
                  Đặt mặc định
                </button>
                <button className={styles.linkBtn} onClick={() => onEdit(a)}>
                  Sửa
                </button>
                <button className={styles.linkBtn} onClick={() => onDelete(a._id)}>
                  Xóa
                </button>
                <button
                  className={styles.primaryBtn}
                  onClick={() => navigate(back, { state: { addressId: a._id, selectedIds } })}
                >
                  Chọn
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <EmptyState
              title="Chưa có địa chỉ"
              desc="Hãy thêm địa chỉ để giao hàng nhanh chóng."
              action={
                <button className={styles.primaryBtn} onClick={() => onEdit(null)}>
                  + Thêm địa chỉ
                </button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
