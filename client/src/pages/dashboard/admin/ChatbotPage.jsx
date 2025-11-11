import { useEffect, useState } from 'react';
import { chatbotApi } from '@/api';
import { toast } from '@/components/Toast';
import styles from './ChatbotPage.module.css';

export default function ChatbotPage() {
  const [policies, setPolicies] = useState({});
  const [selectedType, setSelectedType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [loading, setLoading] = useState(true);

  // 6 loại dữ liệu training mà chatbot sẽ học
  const POLICY_TYPES = {
    shipping: '🚚 Vận chuyển',
    return: '↩️ Đổi trả',
    payment: '💳 Thanh toán',
    warranty: '🛡️ Bảo hành',
    faq: '❓ Câu hỏi thường gặp',
    about: 'ℹ️ Giới thiệu',
  };

  // Load dữ liệu khi component mount
  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await chatbotApi.getAllPolicies();
      if (res.success) {
        setPolicies(res.data.policies || {});
      }
    } catch (error) {
      console.error('❌ Lỗi tải dữ liệu:', error);
      toast.error('Không thể tải dữ liệu. Vui lòng kiểm tra kết nối!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

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

  // Lưu dữ liệu (tạo mới hoặc cập nhật)
  const handleSave = async (formData) => {
    try {
      if (editingPolicy._id) {
        // Cập nhật
        await chatbotApi.updatePolicy(editingPolicy._id, formData);
        toast.success('Cập nhật thành công!');
      } else {
        // Tạo mới
        await chatbotApi.createPolicy(formData);
        toast.success('Thêm mới thành công!');
      }
      setShowModal(false);
      setEditingPolicy(null);
      await loadPolicies();
    } catch (error) {
      console.error('❌ Lỗi lưu:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu!');
    }
  };

  // Bật/Tắt trạng thái
  const handleToggle = async (id, currentStatus) => {
    try {
      await chatbotApi.togglePolicyStatus(id);
      toast.success(currentStatus ? 'Đã tắt thành công!' : 'Đã bật thành công!');
      await loadPolicies();
    } catch (error) {
      console.error('❌ Lỗi toggle:', error);
      toast.error('Không thể thay đổi trạng thái!');
    }
  };

  // Xóa dữ liệu
  const handleDelete = async (id, title) => {
    if (!confirm(`⚠️ Bạn chắc chắn muốn xóa "${title}"?\n\nHành động này không thể hoàn tác!`))
      return;
    try {
      await chatbotApi.deletePolicy(id);
      alert('🗑️ Đã xóa thành công!');
      await loadPolicies();
    } catch (error) {
      console.error('❌ Lỗi xóa:', error);
      alert('❌ Không thể xóa: ' + (error.response?.data?.message || error.message));
    }
  };

  // Lọc dữ liệu theo loại đã chọn
  const getFilteredPolicies = () => {
    if (selectedType === 'all') {
      return Object.entries(policies).flatMap(([type, items]) =>
        items.map((item) => ({ ...item, type })),
      );
    }
    return (policies[selectedType] || []).map((item) => ({ ...item, type: selectedType }));
  };

  const filteredPolicies = getFilteredPolicies();
  const totalCount = Object.values(policies).reduce((acc, arr) => acc + arr.length, 0);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p>⏳ Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* HEADER - Tiêu đề và mô tả */}
      <div className={styles.header}>
        <h2>🧠 Quản lý Training Data - Chatbot AI</h2>
        <p>
          Thêm và quản lý dữ liệu để chatbot học và trả lời khách hàng tốt hơn về các chính sách,
          quy định của shop
        </p>
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

      {/* THANH TIÊU ĐỀ VÀ NÚT THÊM MỚI */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
        }}
      >
        <h3>
          {selectedType === 'all'
            ? `📋 Tất cả dữ liệu (${totalCount} mục)`
            : `${POLICY_TYPES[selectedType]} (${policies[selectedType]?.length || 0} mục)`}
        </h3>
        {selectedType !== 'all' && (
          <button className={styles.addButton} onClick={() => handleCreateNew(selectedType)}>
            ➕ Thêm {POLICY_TYPES[selectedType]}
          </button>
        )}
      </div>

      {/* DANH SÁCH DỮ LIỆU */}
      <div className={styles.policiesList}>
        {filteredPolicies.length === 0 ? (
          <div className={styles.emptyState}>
            <p style={{ fontSize: '48px', margin: '0 0 16px 0' }}>📭</p>
            <p style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
              {selectedType === 'all'
                ? 'Chưa có dữ liệu training nào'
                : `Chưa có dữ liệu ${POLICY_TYPES[selectedType]}`}
            </p>
            <p style={{ fontSize: '14px', color: '#9ca3af' }}>
              {selectedType !== 'all' && `Nhấn nút "Thêm ${POLICY_TYPES[selectedType]}" để bắt đầu`}
            </p>
          </div>
        ) : (
          filteredPolicies
            .sort((a, b) => a.order - b.order) // Sắp xếp theo order
            .map((policy) => (
              <div
                key={policy._id}
                className={`${styles.policyCard} ${!policy.isActive ? styles.inactive : ''}`}
              >
                {/* Header của card */}
                <div className={styles.policyHeader}>
                  <h4 className={styles.policyTitle}>{policy.title}</h4>
                  <span className={styles.policyBadge}>{POLICY_TYPES[policy.type]}</span>
                </div>

                {/* Nội dung */}
                <div className={styles.policyContent}>{policy.content}</div>

                {/* Thông tin meta */}
                <div className={styles.policyMeta}>
                  <span>📊 Thứ tự: {policy.order}</span>
                  <span>{policy.isActive ? '✅ Đang hoạt động' : '⏸️ Đã tắt'}</span>
                  {policy.updatedAt && (
                    <span>🕒 Cập nhật: {new Date(policy.updatedAt).toLocaleString('vi-VN')}</span>
                  )}
                </div>

                {/* Các nút hành động */}
                <div className={styles.policyActions}>
                  <button className={styles.editBtn} onClick={() => handleEdit(policy)}>
                    ✏️ Sửa
                  </button>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => handleToggle(policy._id, policy.isActive)}
                  >
                    {policy.isActive ? '⏸️ Tắt' : '▶️ Bật'}
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(policy._id, policy.title)}
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

// ============ MODAL COMPONENT ============
function PolicyModal({ policy, policyTypes, onSave, onClose }) {
  const [formData, setFormData] = useState({
    type: policy?.type || 'faq',
    title: policy?.title || '',
    content: policy?.content || '',
    order: policy?.order || 0,
    isActive: policy?.isActive ?? true,
  });

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
          <button className={styles.closeBtn} onClick={onClose}>
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
          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                style={{ width: 'auto', cursor: 'pointer' }}
              />
              ✅ Kích hoạt ngay (chatbot có thể dùng để trả lời)
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
