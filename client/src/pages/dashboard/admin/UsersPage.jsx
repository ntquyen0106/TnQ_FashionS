// src/pages/admin/UsersPage.jsx
import { useEffect, useState } from 'react';
import { usersApi } from '@/api/users-api';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Chip,
  Tooltip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SearchIcon from '@mui/icons-material/Search';
import SuccessModal from '@/components/SuccessModal';
import styles from './UsersPage.module.css';

const RoleChip = ({ role }) => {
  const map = { admin: 'Quản trị', staff: 'Nhân viên', user: 'Khách' };
  return (
    <Chip
      label={map[role] || role}
      size="small"
      color={role === 'admin' ? 'primary' : role === 'staff' ? 'secondary' : 'default'}
    />
  );
};
const StatusChip = ({ status }) => {
  const map = { active: 'Hoạt động', banned: 'Bị khoá' };
  return (
    <Chip
      label={map[status] || status}
      size="small"
      color={status === 'active' ? 'success' : 'warning'}
    />
  );
};

const emptyForm = {
  name: '',
  email: '',
  phoneNumber: '',
  role: 'staff',
  status: 'active',
  password: '',
};

export default function UsersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [successModal, setSuccessModal] = useState({ open: false, title: '', message: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, size: limit };
      if (q) params.search = q;
      if (role) params.role = role;
      if (status) params.status = status;
      const res = await usersApi.list(params);
      // Support multiple response shapes from the server:
      // - legacy: { items: [...], total: N }
      // - newer/admin service: { content: [...], totalElements: N }
      const items = res?.items ?? res?.content ?? (Array.isArray(res) ? res : []);
      const total = res?.total ?? res?.totalElements ?? 0;
      setRows(items || []);
      setTotal(typeof total === 'number' ? total : Number(total) || 0);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch users list', err);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [page, limit, q, role, status]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setValidationErrors({});
    setOpen(true);
  };
  const openEdit = async (id) => {
    const data = await usersApi.detail(id);
    setEditingId(id);
    setForm({
      name: data.name || '',
      email: data.email || '',
      phoneNumber: data.phoneNumber || '',
      role: data.role || 'staff',
      status: data.status || 'active',
      password: '',
    });
    setValidationErrors({});
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      if (editingId) await usersApi.update(editingId, body);
      else await usersApi.create(body);
      setOpen(false);
      await fetchList();
      setValidationErrors({});
    } catch (err) {
      // If server returned validation errors, show them in the form
      const errors = err?.response?.data?.errors || err?.response?.data || null;
      if (errors && typeof errors === 'object') {
        setValidationErrors(errors);
      }
      // eslint-disable-next-line no-console
      console.error('Save user error', err);
    } finally {
      setSaving(false);
    }
  };

  const remove = (id) => {
    // open confirmation modal
    setConfirmTarget(id);
    setConfirmOpen(true);
  };

  const confirmRemove = async () => {
    if (!confirmTarget) return;
    try {
      setActionLoadingId(confirmTarget);
      await usersApi.remove(confirmTarget);
      setConfirmOpen(false);
      setConfirmTarget(null);
      await fetchList();
    } catch (e) {
      console.error('Remove user error', e);
      setSuccessModal({
        open: true,
        title: 'Xoá thất bại',
        message: e?.response?.data?.message || 'Xoá người dùng thất bại',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'banned' : 'active';
    try {
      setActionLoadingId(id);
      await usersApi.patchStatus(id, newStatus);
      await fetchList();
    } catch (e) {
      console.error('Toggle status error', e);
      setSuccessModal({
        open: true,
        title: 'Thao tác thất bại',
        message: e?.response?.data?.message || 'Không thể thay đổi trạng thái',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Quản lý người dùng</h2>
        <Button variant="contained" onClick={openCreate}>
          + Thêm nhân sự
        </Button>
      </div>

      <div className={styles.filters}>
        <TextField
          size="small"
          placeholder="Tìm theo tên/email/phone"
          value={q}
          className={styles.searchBox}
          onChange={(e) => {
            setPage(0);
            setQ(e.target.value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          select
          label="Chức vụ"
          value={role}
          onChange={(e) => {
            setPage(0);
            setRole(e.target.value);
          }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="admin">Quản trị</MenuItem>
          <MenuItem value="staff">Nhân viên</MenuItem>
          <MenuItem value="user">Khách</MenuItem>
        </TextField>
        <TextField
          size="small"
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value);
          }}
        >
          <MenuItem value="">Tất cả</MenuItem>
          <MenuItem value="active">Hoạt động</MenuItem>
          <MenuItem value="banned">Bị khoá</MenuItem>
        </TextField>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loading}>
            <CircularProgress size={28} />
          </div>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>SĐT</TableCell>
                <TableCell>Chức vụ</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const id = r.id || r._id;
                return (
                  <TableRow key={id} hover>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.phoneNumber || '-'}</TableCell>
                    <TableCell>
                      <RoleChip role={r.role} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={r.status} />
                    </TableCell>
                    <TableCell align="right">
                      {r.role !== 'user' && (
                        <Tooltip title="Sửa">
                          <IconButton onClick={() => openEdit(id)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={r.status === 'active' ? 'Khoá' : 'Mở khoá'}>
                        <IconButton onClick={() => toggleStatus(id, r.status)}>
                          {actionLoadingId === id ? (
                            <CircularProgress size={18} />
                          ) : r.status === 'active' ? (
                            <LockIcon />
                          ) : (
                            <LockOpenIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xoá">
                        <IconButton onClick={() => remove(id)} color="error">
                          {actionLoadingId === id ? <CircularProgress size={18} /> : <DeleteIcon />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => {
          setLimit(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 20, 50]}
      />

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ className: styles.modal }}
        BackdropProps={{ className: styles.modalBackdrop }}
      >
        <DialogTitle className={styles.modalHeader}>
          <div className={styles.modalTitle}>{editingId ? 'Sửa người dùng' : 'Tạo người dùng'}</div>
        </DialogTitle>
        <DialogContent className={`${styles.modalBody} ${styles.form}`}>
          <TextField
            label="Tên"
            fullWidth
            size="small"
            margin="dense"
            required
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }));
              setValidationErrors((v) => ({ ...v, name: undefined }));
            }}
            error={Boolean(validationErrors.name)}
            helperText={validationErrors.name}
          />
          <TextField
            label="Email"
            fullWidth
            size="small"
            margin="dense"
            required
            value={form.email}
            onChange={(e) => {
              setForm((f) => ({ ...f, email: e.target.value }));
              setValidationErrors((v) => ({ ...v, email: undefined }));
            }}
            error={Boolean(validationErrors.email)}
            helperText={validationErrors.email}
          />
          <TextField
            label="Số điện thoại"
            fullWidth
            size="small"
            margin="dense"
            required
            type="tel"
            inputMode="tel"
            value={form.phoneNumber}
            onChange={(e) => {
              setForm((f) => ({ ...f, phoneNumber: e.target.value }));
              setValidationErrors((v) => ({ ...v, phoneNumber: undefined }));
            }}
            error={Boolean(validationErrors.phoneNumber)}
            helperText={validationErrors.phoneNumber}
          />
          <TextField
            select
            label="Chức vụ"
            fullWidth
            size="small"
            margin="dense"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <MenuItem value="admin">Quản trị</MenuItem>
            <MenuItem value="staff">Nhân viên</MenuItem>
            <MenuItem value="user">Khách</MenuItem>
          </TextField>
          <TextField
            select
            label="Trạng thái"
            fullWidth
            size="small"
            margin="dense"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
          >
            <MenuItem value="active">Hoạt động</MenuItem>
            <MenuItem value="banned">Bị khoá</MenuItem>
          </TextField>
          {editingId ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#333', marginBottom: 6 }}>
                  Gửi liên kết đặt mật khẩu
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Nhấn để gửi liên kết đặt mật khẩu đến email người dùng (an toàn hơn so với ghi
                  trực tiếp mật khẩu).
                </div>
              </div>
              <div style={{ width: 180 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={async () => {
                    try {
                      const res = await usersApi.sendSetPassword(editingId);
                      setSuccessModal({
                        open: true,
                        title: 'Gửi liên kết thành công',
                        message:
                          res?.message || 'Đã gửi liên kết đặt mật khẩu tới email người dùng',
                      });
                    } catch (e) {
                      console.error('Send set-password error', e);
                      setSuccessModal({
                        open: true,
                        title: 'Gửi thất bại',
                        message: e?.response?.data?.message || 'Gửi liên kết thất bại',
                      });
                    }
                  }}
                >
                  Gửi Link đặt lại mật khẩu
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>
              Sau khi tạo, hệ thống sẽ gửi mật khẩu tạm thời hoặc liên kết đặt mật khẩu tới đúng
              email của nhân sự và yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.
            </div>
          )}
        </DialogContent>
        <DialogActions className={styles.modalFooter}>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Xác nhận</DialogTitle>
        <DialogContent>
          Bạn có chắc muốn xoá người dùng này không? Hành động không thể hoàn tác.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Huỷ</Button>
          <Button color="error" onClick={confirmRemove} disabled={actionLoadingId !== null}>
            {actionLoadingId ? <CircularProgress size={18} /> : 'Xoá'}
          </Button>
        </DialogActions>
      </Dialog>
      <SuccessModal
        open={successModal.open}
        title={successModal.title}
        message={successModal.message}
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
