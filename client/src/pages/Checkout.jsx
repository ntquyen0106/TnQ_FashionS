import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartProvider';
import authApi from '@/api/auth-api';
import ordersApi from '@/api/orders-api';
import styles from './Checkout.module.css';
import toast from 'react-hot-toast';
import VoucherPicker from '@/components/VoucherPicker';
import { computeShippingFee, computeShippingDetail } from '@/utils/shipping';

export default function Checkout() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { cart, refresh, total: getTotal, applyPromotion, clearPromotion } = useCart();
  const selectedIds = Array.isArray(state?.selectedIds) ? state.selectedIds : [];
  const selectedAddressId = state?.addressId;

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addressId, setAddressId] = useState('');
  const [voucher, setVoucher] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [totals, setTotals] = useState({ subtotal: 0, discount: 0, shippingFee: 0, grandTotal: 0 });
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const preserveVoucherRef = useRef(false);

  const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const buildImageUrl = (snap, w = 120) => {
    if (!snap) return '/no-image.png';
    if (typeof snap === 'string' && /^https?:\/\//i.test(snap)) return snap;
    const pid = encodeURIComponent(snap).replace(/%2F/g, '/');
    return `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto,dpr_auto,w_${w}/${pid}`;
  };

  const itemsRaw = useMemo(() => {
    if (!cart?.items) return [];
    return cart.items.map((raw) => ({
      _id: raw._id,
      productId: String(raw.productId?._id || raw.productId),
      variantSku: raw.variantSku,
      name: raw.name || raw.nameSnapshot || raw.product?.name || 'Sản phẩm',
      imageUrl: raw.imageUrl || buildImageUrl(raw.imageSnapshot),
      price: Number(raw.price ?? raw.priceSnapshot) || 0,
      qty: Number(raw.quantity ?? raw.qty) || 1,
      variantName: raw.variantName,
      color: raw.color,
      size: raw.size,
      variantOptions: raw.variantOptions || [],
    }));
  }, [cart]);

  const selectedSet = useMemo(
    () => new Set((selectedIds || []).map((x) => String(x))),
    [selectedIds],
  );

  const items = useMemo(() => {
    if (!itemsRaw.length) return [];
    if (!selectedIds.length) return itemsRaw;
    // Hỗ trợ nhiều kiểu selectedIds: cartItemId, productId, hoặc productId-variantSku
    return itemsRaw.filter((it) => {
      const cartItemId = String(it._id);
      const productId = String(it.productId);
      const composite = `${productId}-${it.variantSku}`;
      return (
        selectedSet.has(cartItemId) || selectedSet.has(productId) || selectedSet.has(composite)
      );
    });
  }, [itemsRaw, selectedIds, selectedSet]);

  const selectedItemsPayload = useMemo(() => {
    // When nothing is explicitly selected, treat as "all items" by omitting the field
    if (!selectedIds.length) return undefined;
    return items.map((it) => ({ productId: String(it.productId), variantSku: it.variantSku }));
  }, [items, selectedIds]);

  useEffect(() => {
    // load addresses
    (async () => {
      try {
        const list = await authApi.getAddresses();
        setAddresses(list || []);
        if (selectedAddressId) {
          setAddressId(selectedAddressId);
        } else {
          const def = (list || []).find((a) => a.isDefault) || (list || [])[0];
          if (def?._id) setAddressId(def._id);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [selectedAddressId]);

  // Phản chiếu promotion từ cart để duy trì voucher trong cùng phiên checkout
  // (ví dụ chuyển qua trang địa chỉ rồi quay lại). Không hiện nếu discount = 0.
  useEffect(() => {
    if (cart?.promotion?.code && Number(totals.discount) > 0) {
      setAppliedPromo(cart.promotion);
    }
  }, [cart?.promotion, totals.discount]);

  // Khi rời Checkout sang trang khác, sẽ gỡ voucher, TRỪ khi đi đến trang chọn địa chỉ
  useEffect(() => {
    preserveVoucherRef.current = false; // reset khi mount
    return () => {
      if (!preserveVoucherRef.current) {
        (async () => {
          try {
            await clearPromotion();
          } catch {}
        })();
        setAppliedPromo(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentAddress = useMemo(
    () => addresses.find((a) => a._id === addressId),
    [addresses, addressId],
  );
  useEffect(() => {
    let cancelled = false;

    const calc = async () => {
      // Fallback tạm tính từ items trên FE (luôn có ngay cả khi BE lỗi)
      const fallbackSubtotal = items.reduce(
        (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
        0,
      );

      try {
        // Gọi BE /cart/total: nếu không chọn gì thì tính cho toàn bộ
        const t = await getTotal(
          selectedItemsPayload && selectedItemsPayload.length
            ? { selectedItems: selectedItemsPayload }
            : {},
        );

        // Chuẩn hóa dữ liệu trả về; nếu BE trả 0 nhưng cart có subtotal > 0 thì fallback
        let subtotal = Number(t?.subtotal);
        let discount = Number(t?.discount);
        if (!subtotal && Number(cart?.subtotal) > 0) subtotal = Number(cart.subtotal);
        if (!discount && Number(cart?.discount) > 0) discount = Number(cart.discount);
        if (!subtotal && fallbackSubtotal > 0) subtotal = fallbackSubtotal;
        if (!discount) discount = 0;

        // ✅ Ship fee dựa vào địa chỉ hiện tại + subtotal
        const shippingFee =
          subtotal > 0
            ? computeShippingFee(currentAddress?.city, currentAddress?.district, subtotal)
            : 0;

        const grandTotal = Math.max(subtotal - discount, 0) + shippingFee;

        if (!cancelled) {
          setTotals({ subtotal, discount, shippingFee, grandTotal });
        }
      } catch (e) {
        // BE lỗi ⇒ dùng fallback FE + ship
        const shippingFee =
          fallbackSubtotal > 0
            ? computeShippingFee(currentAddress?.city, currentAddress?.district, fallbackSubtotal)
            : 0;
        const grandTotal = fallbackSubtotal + shippingFee;

        if (!cancelled) {
          setTotals({ subtotal: fallbackSubtotal, discount: 0, shippingFee, grandTotal });
        }
      }
    };

    calc();
    return () => {
      cancelled = true;
    };
    // ✅ Chỉ phụ thuộc những thứ thực sự ảnh hưởng kết quả
  }, [items, selectedItemsPayload, currentAddress, getTotal]);

  const handleApplyVoucher = async (code) => {
    if (!code) {
      toast('Nhập mã trước khi áp dụng');
      return;
    }
    try {
      const res = await applyPromotion({
        code,
        selectedItems:
          selectedItemsPayload && selectedItemsPayload.length ? selectedItemsPayload : undefined,
      });
      if (!res) return; // applyPromotion đã toast lỗi nếu có
      const subtotal = Number(res.subtotal) || 0;
      const discount = Number(res.discount) || 0;
      const shippingFee =
        subtotal > 0
          ? computeShippingFee(currentAddress?.city, currentAddress?.district, subtotal)
          : 0;
      const grandTotal = Math.max(subtotal - discount, 0) + shippingFee;
      setTotals({ subtotal, discount, shippingFee, grandTotal });
      if (res.promotion) setAppliedPromo(res.promotion);
      // Không cần hiện toast thành công khi áp dụng
    } catch (e) {
      // applyPromotion đã xử lý toast
    }
  };

  const placeOrder = async () => {
    if (!addressId) {
      toast.error('Vui lòng chọn địa chỉ nhận hàng');
      return;
    }
    if (!items.length) {
      toast.error('Không có sản phẩm để đặt');
      return;
    }
    setLoading(true);
    try {
      const body = {
        addressId,
        paymentMethod, // ordersApi.checkout sẽ tự map non-COD → BANK
        voucher: voucher || undefined,
        ...(selectedItemsPayload && selectedItemsPayload.length
          ? { selectedItems: selectedItemsPayload }
          : {}),
      };

      const res = await ordersApi.checkout(body);

      // dọn voucher & refresh cart
      try {
        await clearPromotion();
      } catch {}
      setAppliedPromo(null);
      setVoucher('');
      await refresh();

      const orderId = res?.order?._id || res?.orderId || res?._id || res?.data?.order?._id;
      const orderCode = res?.order?.code || res?.code || res?.data?.order?.code;

      // Non-COD (BANK/MOMO/ZALOPAY/VNPAY) → có paymentData.checkoutUrl
      if (paymentMethod !== 'COD' && res?.paymentData?.checkoutUrl) {
        window.location.href = res.paymentData.checkoutUrl; // sang trang PayOS
        return;
      }

      // COD → vào trang success luôn
      navigate('/order/success', { state: { orderId, orderCode, method: 'COD' } });
    } catch (e) {
      toast.error(e?.message || e?.response?.data?.message || 'Đặt hàng thất bại');
    } finally {
      setLoading(false);
    }
  };

  //   const currentAddress = addresses.find((a) => a._id === addressId);

  return (
    <div className={styles.wrapper}>
      <div className={styles.section} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          className={styles.linkBtn}
          onClick={async () => {
            preserveVoucherRef.current = false;
            try {
              await clearPromotion();
            } catch {}
            setAppliedPromo(null);
            navigate('/cart');
          }}
          aria-label="Quay lại giỏ hàng"
          title="Quay lại"
        >
          <svg
            width="20"
            height="20"
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
        <h2 style={{ margin: 0 }}>Thanh toán</h2>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Địa chỉ nhận hàng</h3>
          <button
            className={styles.linkBtn}
            onClick={() => {
              preserveVoucherRef.current = true;
              navigate('/addresses', { state: { back: '/checkout', selectedIds } });
            }}
          >
            Thay đổi
          </button>
        </div>
        {currentAddress ? (
          <div className={styles.addressCard}>
            <div>
              <strong>{currentAddress.fullName}</strong> · {currentAddress.phone}
            </div>
            <div className={styles.addrLine}>
              {currentAddress.line1 || currentAddress.street}, {currentAddress.ward},{' '}
              {currentAddress.district}, {currentAddress.city}
            </div>
          </div>
        ) : (
          <div>
            <em>Chưa có địa chỉ mặc định.</em>
            <button
              className={styles.linkBtn}
              onClick={() => navigate('/addresses', { state: { back: '/checkout' } })}
            >
              Thêm địa chỉ
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Vận chuyển</h3>
        </div>
        <div className={styles.shipInfo}>
          <div>
            Kho hàng: <strong>TP. Hồ Chí Minh</strong>
            <span className={styles.chip}>Shop</span>
          </div>
          <div className={styles.note}>
            {(() => {
              const det = computeShippingDetail(
                currentAddress?.city,
                currentAddress?.district,
                totals.subtotal,
              );
              const dest = currentAddress
                ? `${currentAddress.ward ? currentAddress.ward + ', ' : ''}${
                    currentAddress.district ? currentAddress.district + ', ' : ''
                  }${currentAddress.city || ''}`
                : 'Chưa chọn địa chỉ';

              const hasCity = Boolean(currentAddress?.city);
              // Fallback: suy luận ETA theo mức phí nếu thiếu etaDays (tránh "đang xác định")
              const inferEtaByFee = (fee) => {
                const f = Number(fee) || 0;
                if (f === 25000) return { min: 1, max: 2, regionName: 'Miền Nam' };
                if (f === 30000) return { min: 3, max: 4, regionName: 'Miền Trung' };
                if (f === 35000) return { min: 3, max: 4, regionName: 'Miền Bắc' };
                if (f === 45000) return { min: 3, max: 4, regionName: 'Miền Bắc/Trung' };
                return null;
              };
              const effectiveEta = det?.etaDays
                ? { ...det.etaDays, regionName: det.regionName }
                : inferEtaByFee(totals.shippingFee);
              const etaText =
                hasCity && effectiveEta
                  ? `Ước tính giao: ${effectiveEta.min}–${effectiveEta.max} ngày` +
                    (effectiveEta.regionName ? ` (${effectiveEta.regionName})` : '')
                  : hasCity
                  ? 'Ước tính giao: đang xác định'
                  : 'Chưa đủ thông tin ước tính';

              const feeText = `${(totals.shippingFee || 0).toLocaleString()}₫`;

              return (
                <>
                  {etaText}. Phí vận chuyển: <strong>{feeText}</strong>
                  {det.method === 'hcm-distance' && det.distanceKm != null ? (
                    <>
                      {' '}
                      · Khoảng cách ước tính: <strong>{det.distanceKm} km</strong>
                    </>
                  ) : null}
                  {dest ? (
                    <>
                      {' '}
                      · Đến: <strong>{dest}</strong>
                    </>
                  ) : null}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Phiếu giảm giá
          <button className={styles.linkBtn} onClick={() => setVoucherOpen(true)}>
            Chọn voucher
          </button>
        </h3>
        {appliedPromo?.code && totals.discount > 0 && (
          <div
            className={styles.note}
            style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span>
              Đang áp dụng mã: <strong>{appliedPromo.code}</strong>
              {appliedPromo?.eligible === false && (
                <>
                  {' '}
                  <span style={{ color: '#b91c1c' }}>
                    (Chưa đủ điều kiện. Đơn tối thiểu{' '}
                    {Number(appliedPromo.minOrder || 0).toLocaleString()}₫)
                  </span>
                </>
              )}
            </span>
            <button
              className={styles.linkBtn}
              onClick={async () => {
                await clearPromotion();
                setAppliedPromo(null);
                // Recompute totals after clearing
                const t = await getTotal(
                  selectedItemsPayload && selectedItemsPayload.length
                    ? { selectedItems: selectedItemsPayload }
                    : {},
                );
                const subtotal = Number(t?.subtotal) || 0;
                const discount = Number(t?.discount) || 0;
                const shippingFee =
                  subtotal > 0
                    ? computeShippingFee(currentAddress?.city, currentAddress?.district, subtotal)
                    : 0;
                const grandTotal = Math.max(subtotal - discount, 0) + shippingFee;
                setTotals({ subtotal, discount, shippingFee, grandTotal });
              }}
            >
              Bỏ voucher
            </button>
          </div>
        )}
        <div className={styles.voucherRow}>
          <input
            value={voucher}
            onChange={(e) => setVoucher(e.target.value)}
            placeholder="Nhập mã riêng"
          />
          <button className={styles.secondaryBtn} onClick={() => handleApplyVoucher(voucher)}>
            Áp dụng mã riêng
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Sản phẩm</h3>
        <div className={styles.items}>
          {items.map((it) => (
            <div key={it._id} className={styles.itemRow}>
              <img src={it.imageUrl} alt={it.name} />
              <div className={styles.itemInfo}>
                <div className={styles.itemName}>{it.name}</div>
                <div className={styles.itemMeta}>
                  {it.color ? `Màu: ${it.color}` : ''}
                  {it.color && it.size ? ' · ' : ''}
                  {it.size ? `Size: ${it.size}` : ''}
                </div>
              </div>
              <div className={styles.itemQty}>x{it.qty}</div>
              <div className={styles.itemPrice}>{(it.price * it.qty).toLocaleString()}₫</div>
            </div>
          ))}
          {!items.length && <div>Không có sản phẩm.</div>}
        </div>
      </div>

      <div className={styles.section}>
        <h3>Phương thức thanh toán</h3>

        {(() => {
          // Danh sách phương thức
          const OPTIONS = [
            {
              key: 'COD',
              label: 'Thanh toán khi nhận hàng (COD)',
              icon: (
                <img
                  src="https://img.icons8.com/fluency/48/in-transit.png"
                  alt="COD"
                  width="22"
                  height="22"
                />
              ),
              enabled: true, // ✅ Bật
            },
            {
              key: 'BANK',
              label: 'Chuyển khoản ngân hàng',
              icon: (
                <img
                  src="https://img.icons8.com/fluency/48/bank-card-back-side.png"
                  alt="BANK"
                  width="22"
                  height="22"
                />
              ),
              enabled: true, // ✅ Bật
            },
            {
              key: 'MOMO',
              label: 'MoMo',
              icon: (
                <img
                  src="https://res.cloudinary.com/dsgwucw8s/image/upload/v1760446718/Momo_vex8ub.png"
                  alt="MOMO"
                  width="22"
                  height="22"
                />
              ),
              enabled: false,
            },
            {
              key: 'ZALOPAY',
              label: 'ZaloPay',
              icon: (
                <img
                  src="https://res.cloudinary.com/dsgwucw8s/image/upload/v1760446744/zalopay_b0nohl.png"
                  alt="ZALOPAY"
                  width="22"
                  height="22"
                />
              ),
              enabled: false,
            },
            {
              key: 'VNPAY',
              label: 'VNPay',
              icon: (
                <img
                  src="https://res.cloudinary.com/dsgwucw8s/image/upload/v1760446730/npay_x8k1bi.png"
                  alt="VNPAY"
                  width="28"
                  height="22"
                  style={{ objectFit: 'contain' }}
                />
              ),
              enabled: false,
            },
          ];

          return (
            <div className={styles.payMethods}>
              {OPTIONS.map((opt) => {
                const disabled = !opt.enabled;
                return (
                  <label
                    key={opt.key}
                    className={styles.radio}
                    aria-disabled={disabled}
                    title={disabled ? 'Chưa hỗ trợ' : undefined}
                    style={{
                      opacity: disabled ? 0.5 : 1,
                      pointerEvents: disabled ? 'none' : 'auto',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="pm"
                      value={opt.key}
                      checked={paymentMethod === opt.key}
                      disabled={disabled}
                      onChange={() => {
                        if (!disabled) setPaymentMethod(opt.key);
                      }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {opt.icon}
                      {opt.label}
                      {disabled && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            padding: '2px 6px',
                            borderRadius: 6,
                            border: '1px solid #ddd',
                            lineHeight: 1.2,
                          }}
                        >
                          Sắp ra mắt
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div className={styles.section}>
        <div className={styles.totals}>
          <div className={styles.row}>
            <span>Tạm tính (sản phẩm)</span>
            <span>{totals.subtotal.toLocaleString()}₫</span>
          </div>
          <div className={styles.row}>
            <span>Giảm giá</span>
            <span>{totals.discount > 0 ? `-${totals.discount.toLocaleString()}₫` : '0₫'}</span>
          </div>
          <div className={styles.row}>
            <span>Phí vận chuyển (ước tính)</span>
            <span>{totals.shippingFee.toLocaleString()}₫</span>
          </div>
          <div className={styles.rowGrand}>
            <span>Chi tiết thanh toán</span>
            <span>{totals.grandTotal.toLocaleString()}₫</span>
          </div>
        </div>
        <button
          className={styles.placeBtn}
          disabled={loading || !items.length}
          onClick={placeOrder}
        >
          {loading ? 'Đang đặt hàng...' : 'Đặt hàng'}
        </button>
      </div>
      <VoucherPicker
        open={voucherOpen}
        subtotal={totals.subtotal}
        onClose={() => setVoucherOpen(false)}
        onPick={(p) => {
          setVoucherOpen(false);
          // Chọn voucher trong danh sách sẽ áp dụng ngay, không đổ vào ô 'mã riêng'
          handleApplyVoucher(p.code);
        }}
      />
    </div>
  );
}
