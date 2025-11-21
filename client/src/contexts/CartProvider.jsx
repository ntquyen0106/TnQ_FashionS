// src/contexts/CartProvider.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { cartApi } from '@/api/cart-api';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/auth/AuthProvider';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export default function CartProvider({ children }) {
  const [cart, setCart] = useState({
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    promotion: null,
    staleInfo: { hasStale: false, items: [], thresholds: { warn: 24, urgent: 72 } },
  });
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const data = await cartApi.get(); // GET /cart (normalized)
      if (Array.isArray(data?.items)) setCart(data);
    } catch (e) {
      console.warn('GET /cart error:', e);
    }
  }, []);

  const add = async ({ productId, variantSku, qty }) => {
    try {
      await cartApi.add({ productId, variantSku, qty }); // POST /cart/add
      await refresh(); // đảm bảo có variantOptions/slug/...
      toast.success('Đã thêm vào giỏ hàng');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Không thêm được vào giỏ');
    }
  };

  // Thêm lại nhiều sản phẩm từ một đơn hàng (mua lại)
  // items: [{ productId, variantSku, qty }]
  const addMany = async (items = []) => {
    const payload = (items || [])
      .filter((it) => it && it.productId && it.variantSku && it.qty > 0)
      .map((it) => ({
        productId: it.productId,
        variantSku: it.variantSku,
        qty: it.qty,
      }));

    if (!payload.length) {
      toast.error('Không có sản phẩm hợp lệ để mua lại');
      return;
    }

    try {
      // Nếu BE chưa có API bulk, gọi tuần tự add từng item
      for (const it of payload) {
        // eslint-disable-next-line no-await-in-loop
        await cartApi.add({ productId: it.productId, variantSku: it.variantSku, qty: it.qty });
      }
      await refresh();
      toast.success('Đã thêm lại sản phẩm từ đơn hàng vào giỏ');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Không thể mua lại đơn hàng');
    }
  };

  // TÍNH TỔNG: không gửi selectedItems nếu rỗng/undefined, và luôn trả số
  const total = useCallback(async ({ selectedItems } = {}) => {
    try {
      const body = Array.isArray(selectedItems) && selectedItems.length ? { selectedItems } : {};
      const data = await cartApi.total(body); // { subtotal, discount, total, promotion }
      return {
        subtotal: Number(data?.subtotal) || 0,
        discount: Number(data?.discount) || 0,
        total: Number(data?.total) || 0,
        promotion: data?.promotion || null,
      };
    } catch (e) {
      console.warn('cart.total error:', e);
      return { subtotal: 0, discount: 0, total: 0, promotion: null };
    }
  }, []);

  // ÁP VOUCHER: BE trả về getCartTotal; refresh để đồng bộ promotion trong giỏ
  const applyPromotion = async ({ code, selectedItems }) => {
    try {
      const body =
        Array.isArray(selectedItems) && selectedItems.length ? { code, selectedItems } : { code };
      const data = await cartApi.applyPromotion(body);
      await refresh();
      return {
        subtotal: Number(data?.subtotal) || 0,
        discount: Number(data?.discount) || 0,
        total: Number(data?.total) || 0,
        promotion: data?.promotion || null,
      };
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Không thể áp dụng mã giảm giá');
      return null;
    }
  };

  const mergeGuest = async () => {
    try {
      await cartApi.mergeGuest();
      await refresh();
    } catch (err) {
      console.error('Không thể merge giỏ hàng:', err);
    }
  };

  const updateQty = async (itemId, qty) => {
    try {
      const data = await cartApi.updateQty(itemId, qty); // BE trả normalized
      setCart(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Cập nhật số lượng thất bại');
    }
  };

  // Với updateVariant, bạn có thể truyền thêm { color, size } ở BE (nếu API hỗ trợ),
  // nhưng hiện tại đang map theo SKU là đủ.
  const updateVariant = async (itemId, variantSku) => {
    try {
      const data = await cartApi.updateVariant(itemId, variantSku);
      setCart(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Đổi phân loại thất bại');
    }
  };

  const remove = async (itemId) => {
    try {
      const data = await cartApi.remove(itemId);
      setCart(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Xóa sản phẩm thất bại');
    }
  };

  const removeMany = async (ids = []) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return;
      // nếu BE trả cart mới thì setCart(data); nếu chỉ trả {ok:true} thì gọi refresh()
      const data = await cartApi.removeMany(ids);
      if (data?.items) setCart(data);
      else await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Xóa nhiều sản phẩm thất bại');
    }
  };

  const clearPromotion = async () => {
    try {
      const data = await cartApi.clearPromotion();
      setCart(data);
      // im lặng để tránh gây ồn trong luồng checkout
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Không thể bỏ mã');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        if (user) {
          await cartApi.mergeGuest(); // POST /cart/merge-guest (có cookie)
        }
      } catch {}
      await refresh(); // sau đó mới GET /cart
    })();
  }, [user, refresh]);

  // Refresh cart every 30 seconds to check for stale items in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <CartCtx.Provider
      value={{
        cart,
        add,
        total,
        applyPromotion,
        mergeGuest,
        refresh,
        updateQty,
        updateVariant,
        remove,
        removeMany,
        clearPromotion,
        addMany,
      }}
    >
      {children}
    </CartCtx.Provider>
  );
}
