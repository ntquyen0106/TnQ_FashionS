import { useCallback, useEffect, useMemo, useState } from 'react';
import { chatbotApi } from '@/api';
import { toast } from '@/components/Toast';
import styles from './ChatbotPage.module.css';

const POLICY_TYPES = {
  shipping: '🚚 Vận chuyển',
  return: '↩️ Đổi trả',
  payment: '💳 Thanh toán',
  warranty: '🛡️ Bảo hành',
  faq: '❓ Câu hỏi thường gặp',
  about: 'ℹ️ Giới thiệu',
};

const SORT_OPTIONS = [
  { value: 'order', label: 'Thứ tự hiển thị' },
  { value: 'updatedAtDesc', label: 'Mới cập nhật' },
  { value: 'titleAsc', label: 'Tiêu đề A-Z' },
];

const getRelativeTime = (timestamp) => {
  if (!timestamp) return 'Chưa có cập nhật';
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'Vừa xong';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
};

export default function ChatbotPage() {
  const [policies, setPolicies] = useState({});
  const [selectedType, setSelectedType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('order');
  const [onlyActive, setOnlyActive] = useState(false);

  const loadPolicies = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await chatbotApi.getAllPolicies();
      if (res.success) {
        setPolicies(res.data.policies || {});
      }
    } catch (error) {
      console.error('❌ Lỗi tải dữ liệu:', error);
      toast.error('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối!');
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const allPolicies = useMemo(
    () =>
      Object.entries(policies).flatMap(([type, items]) =>
        (items || []).map((item) => ({ ...item, type })),
      ),
    [policies],
  );

  const totalCount = allPolicies.length;
  const activeCount = allPolicies.filter((item) => item.isActive).length;
  const inactiveCount = totalCount - activeCount;

  const filteredPolicies = useMemo(() => {
    let list =
      selectedType === 'all'
        ? allPolicies
        : allPolicies.filter((item) => item.type === selectedType);

    if (onlyActive) {
      list = list.filter((item) => item.isActive);
    }

    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(query) || item.content.toLowerCase().includes(query),
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'updatedAtDesc':
        sorted.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        break;
      case 'titleAsc':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
        break;
      default:
        sorted.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        break;
    }

    return sorted;
  }, [allPolicies, selectedType, onlyActive, searchTerm, sortBy]);

  const lastUpdatedTimestamp = useMemo(
    () =>
      allPolicies.reduce((latest, item) => {
        const time = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        return time > latest ? time : latest;
      }, 0),
    [allPolicies],
  );

  const lastUpdatedLabel = getRelativeTime(lastUpdatedTimestamp);
  const activePercentage = totalCount ? Math.round((activeCount / totalCount) * 100) : 0;

  // Mở form tạo mới
  const handleCreateNew = (type) => {
    setEditingPolicy({ type, title: '', content: '', order: 0, isActive: true });
    setShowModal(true);
  };

  // Mở form chỉnh sửa
  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setShowModal(true);
  };

  const handleSave = async (formData) => {
    try {
      if (editingPolicy?._id) {
        await chatbotApi.updatePolicy(editingPolicy._id, formData);
        toast.success('Cập nhật thành công!');
      } else {
        await chatbotApi.createPolicy(formData);
        toast.success('Thêm mới thành công!');
      }
      setShowModal(false);
      setEditingPolicy(null);
      await loadPolicies({ silent: true });
    } catch (error) {
      console.error('❌ Lỗi lưu:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu!');
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await chatbotApi.togglePolicyStatus(id);
      toast.success(currentStatus ? 'Đã tắt thành công!' : 'Đã bật thành công!');
      await loadPolicies({ silent: true });
    } catch (error) {
      console.error('❌ Lỗi toggle:', error);
      toast.error('Không thể thay đổi trạng thái!');
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`⚠️ Bạn chắc chắn muốn xóa "${title}"?\n\nHành động này không thể hoàn tác!`))
      return;
    try {
      await chatbotApi.deletePolicy(id);
      toast.success('🗑️ Đã xóa thành công!');
      await loadPolicies({ silent: true });
    } catch (error) {
      console.error('❌ Lỗi xóa:', error);
      toast.error('❌ Không thể xóa: ' + (error.response?.data?.message || error.message));
    }
  };

  if (loading && !isRefreshing) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <p>⏳ Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h2>🧠 Quản lý Training Data - Chatbot AI</h2>
            <p>
              Thêm và quản lý dữ liệu để chatbot học và trả lời khách hàng tốt hơn về các chính
              sách, quy định của shop
            </p>
          </div>
          <button
            className={styles.refreshBtn}
            onClick={() => loadPolicies({ silent: true })}
            disabled={isRefreshing}
            type="button"
          >
            {isRefreshing ? '🔄 Đang cập nhật...' : '↻ Làm mới'}
          </button>
        </div>
        <div className={styles.headerMeta}>
          <span>
            📦 Tổng: <strong>{totalCount}</strong>
          </span>
          <span>
            ✅ Hoạt động: <strong>{activeCount}</strong>
          </span>
          <span>
            🕒 Cập nhật: <strong>{lastUpdatedLabel}</strong>
          </span>
        </div>
      </div>

      <div className={styles.overviewGrid}>
        <div className={`${styles.overviewCard} ${styles.highlight}`}>
          <span className={styles.overviewLabel}>Tổng dữ liệu</span>
          <span className={styles.overviewValue}>{totalCount}</span>
          <span className={styles.overviewHint}>Tất cả chính sách đã tạo</span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Tỷ lệ hoạt động</span>
          <span className={styles.overviewValue}>{activePercentage}%</span>
          <div className={styles.overviewProgress}>
            <div style={{ width: `${activePercentage}%` }} />
          </div>
          <span className={styles.overviewHint}>
            {activeCount} bật • {inactiveCount} tắt
          </span>
        </div>
        <div className={styles.overviewCard}>
          <span className={styles.overviewLabel}>Đang xem</span>
          <span className={styles.overviewValue}>
            {selectedType === 'all' ? 'Tất cả' : POLICY_TYPES[selectedType]}
          </span>
          <span className={styles.overviewHint}>{filteredPolicies.length} mục</span>
        </div>
      </div>

      {/* BỘ LỌC THEO LOẠI */}
      <div>
        <h3>📂 Chọn loại dữ liệu muốn quản lý:</h3>
        <div className={styles.typeSelector}>
          {/* Nút "Tất cả" */}
          <button
            className={`${styles.typeButton} ${selectedType === 'all' ? styles.active : ''}`}
            onClick={() => setSelectedType('all')}
          >
            📚 Tất cả
            <span className={styles.count}>{totalCount}</span>
          </button>

          {/* Các nút loại dữ liệu */}
          {Object.entries(POLICY_TYPES).map(([type, label]) => (
            <button
              key={type}
              className={`${styles.typeButton} ${selectedType === type ? styles.active : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {label}
              <span className={styles.count}>{policies[type]?.length || 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.listHeader}>
        <div>
          <h3>📋 {selectedType === 'all' ? 'Tất cả dữ liệu' : POLICY_TYPES[selectedType]}</h3>
          <p className={styles.listSubtitle}>
            Hiển thị {filteredPolicies.length} mục
            {searchTerm && ` • Tìm kiếm: "${searchTerm}"`}
            {onlyActive && ' • Chỉ đang hoạt động'}
          </p>
        </div>
        <div className={styles.listActions}>
          <div className={styles.filtersBar}>
            <label className={styles.searchField}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="search"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <label className={styles.toggleActive}>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              <span>Chỉ đang hoạt động</span>
            </label>
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {selectedType !== 'all' && (
            <button
              className={styles.addButton}
              onClick={() => handleCreateNew(selectedType)}
              type="button"
            >
              ➕ Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className={styles.policiesList}>
        {filteredPolicies.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyEmoji}>📭</p>
            <p className={styles.emptyTitle}>
              {selectedType === 'all'
                ? 'Chưa có dữ liệu training nào'
                : `Chưa có ${POLICY_TYPES[selectedType]}`}
            </p>
            <p className={styles.emptyDescription}>
              {selectedType !== 'all' && 'Nhấn nút "Thêm mới" để bắt đầu'}
            </p>
          </div>
        ) : (
          filteredPolicies.map((policy) => (
            <div
              key={policy._id}
              className={`${styles.policyCard} ${!policy.isActive ? styles.inactive : ''}`}
            >
              <div className={styles.policyHeader}>
                <div>
                  <h4 className={styles.policyTitle}>{policy.title}</h4>
                  <div className={styles.policyTags}>
                    <span className={styles.policyBadge}>{POLICY_TYPES[policy.type]}</span>
                    <span
                      className={`${styles.statusPill} ${
                        policy.isActive ? styles.statusActive : styles.statusInactive
                      }`}
                    >
                      {policy.isActive ? 'Hoạt động' : 'Tắt'}
                    </span>
                  </div>
                </div>
                <div className={styles.policyOrder}>#{policy.order ?? 0}</div>
              </div>

              <div className={styles.policyContent}>{policy.content}</div>

              <div className={styles.policyMeta}>
                <span className={styles.metaChip}>📊 Thứ tự: {policy.order ?? 0}</span>
                {policy.updatedAt && (
                  <span className={styles.metaChip}>
                    🕒 {new Date(policy.updatedAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>

              <div className={styles.policyActions}>
                <button className={styles.editBtn} onClick={() => handleEdit(policy)} type="button">
                  ✏️ Sửa
                </button>
                <button
                  className={styles.toggleBtn}
                  onClick={() => handleToggle(policy._id, policy.isActive)}
                  type="button"
                >
                  {policy.isActive ? '⏸️ Tắt' : '▶️ Bật'}
                </button>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(policy._id, policy.title)}
                  type="button"
                >
                  🗑️ Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL FORM THÊM/SỬA */}
      {showModal && (
        <PolicyModal
          policy={editingPolicy}
          policyTypes={POLICY_TYPES}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingPolicy(null);
          }}
        />
      )}
    </div>
  );
}

function PolicyModal({ policy, policyTypes, onSave, onClose }) {
  const [formData, setFormData] = useState({
    type: policy?.type || 'faq',
    title: policy?.title || '',
    content: policy?.content || '',
    order: policy?.order || 0,
    isActive: policy?.isActive ?? true,
  });

  const contentLength = formData.content.trim().length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.warning('Vui lòng điền đầy đủ tiêu đề và nội dung!');
      return;
    }
    onSave(formData);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>{policy?._id ? '✏️ Chỉnh sửa dữ liệu' : '➕ Thêm dữ liệu mới'}</h3>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Chọn loại */}
          <div className={styles.formGroup}>
            <label>📂 Loại dữ liệu *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              disabled={!!policy?._id}
              required
            >
              {Object.entries(policyTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {policy?._id && <small>⚠️ Không thể thay đổi loại khi đang sửa</small>}
          </div>

          {/* Tiêu đề */}
          <div className={styles.formGroup}>
            <label>📝 Tiêu đề *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ví dụ: Chính sách giao hàng miễn phí toàn quốc"
              required
            />
            <small>Tên hiển thị ngắn gọn để dễ quản lý</small>
          </div>

          {/* Nội dung */}
          <div className={styles.formGroup}>
            <label>📄 Nội dung chi tiết *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Nhập nội dung chi tiết mà chatbot sẽ dùng để trả lời khách hàng&#10;&#10;Ví dụ:&#10;- Giao hàng toàn quốc trong 2-3 ngày&#10;- Miễn phí với đơn từ 500.000đ&#10;- Thu hộ COD an toàn"
              rows={10}
              required
            />
            <small>💡 Chatbot sẽ học và sử dụng nội dung này để trả lời khách hàng</small>
            <div className={styles.charCounter}>{contentLength} ký tự</div>
          </div>

          {/* Thứ tự */}
          <div className={styles.formGroup}>
            <label>🔢 Thứ tự hiển thị</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              min="0"
              placeholder="0"
            />
            <small>Số nhỏ hơn sẽ hiển thị trước (0, 1, 2, 3...)</small>
          </div>

          {/* Trạng thái */}
          <div className={styles.formGroupCheckbox}>
            <label>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span>✅ Kích hoạt ngay (chatbot có thể dùng để trả lời)</span>
            </label>
          </div>

          {/* Nút hành động */}
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              ❌ Hủy
            </button>
            <button type="submit" className={styles.submitBtn}>
              {policy?._id ? '💾 Cập nhật' : '➕ Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
