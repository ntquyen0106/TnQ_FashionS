import { useState, useEffect } from 'react';
import { productsApi } from '@/api/products-api';
import { promotionsApi } from '@/api/promotions-api';
import { getCategories } from '@/api/category';
import styles from './ProductPickerModal.module.css';

export default function ProductPickerModal({ isOpen, onClose, onSelectProduct }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [promosByProduct, setPromosByProduct] = useState({}); // { [productId]: [promo, ...] }
  const [expanded, setExpanded] = useState(new Set()); // expanded category ids for tree

  // Load categories
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadProducts();
    }
  }, [isOpen]);

  const loadCategories = async () => {
    try {
      const res = await getCategories({ status: 'active' });
      const flat = Array.isArray(res) ? res : res?.data || [];
      setCategories(flat);
      // default expand top-level categories
      const roots = flat.filter((c) => !c.parentId || c.depth === 1).map((c) => String(c._id));
      setExpanded(new Set(roots));
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProducts = async (categoryPath = null, search = '') => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 20,
        ...(categoryPath && { path: categoryPath }),
        ...(search && { q: search }),
      };
      const res = await productsApi.list(params);
      // Server returns: { items, total, page, limit, pages }
      const list = res?.items || res?.data?.items || res?.data || res?.products || res || [];
      setProducts(list);
      // Prefetch promotions for the listed products to display quick badges
      fetchPromotionsForProducts(list);
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
      setPromosByProduct({});
    } finally {
      setLoading(false);
    }
  };

  const fetchPromotionsForProducts = async (list = []) => {
    if (!Array.isArray(list) || list.length === 0) {
      setPromosByProduct({});
      return;
    }
    // Limit concurrent requests; small list (<=20) is fine
    const controller = new AbortController();
    let mounted = true;
    try {
      const pairs = await Promise.all(
        list.map(async (p) => {
          try {
            if (!p?._id) return [null, []];
            const promos = await promotionsApi.available(0, {
              all: true,
              productIds: [p._id],
              ...(p.categoryId ? { categoryIds: [p.categoryId] } : {}),
            });
            // Only keep promos that actually apply to the product to avoid misleading tags
            const topPromos = (Array.isArray(promos) ? promos : [])
              .filter((promo) => promo?.applicable)
              .slice(0, 2);
            return [String(p._id), topPromos];
          } catch {
            return [String(p?._id || ''), []];
          }
        }),
      );
      if (!mounted) return;
      const map = {};
      for (const [pid, arr] of pairs) if (pid) map[pid] = arr;
      setPromosByProduct(map);
    } finally {
      controller.abort();
    }
  };

  const handleCategoryClick = (category) => {
    if (!category) {
      // Show all products
      setSelectedCategory(null);
      loadProducts(null, searchText);
      return;
    }

    if (selectedCategory?.slug === category.slug) {
      // Deselect
      setSelectedCategory(null);
      loadProducts(null, searchText);
    } else {
      setSelectedCategory(category);
      // Use category.path to include descendants on server side
      loadProducts(category.path, searchText);
    }
  };

  const handleSearch = (e) => {
    const text = e.target.value;
    setSearchText(text);
    loadProducts(selectedCategory?.path, text);
  };

  const handleProductSelect = (product) => {
    // Attach promotion info that was already calculated for display
    const promos = promosByProduct[product._id] || [];
    const base = Number(
      product.minPrice ?? product.basePrice ?? product?.variants?.[0]?.price ?? 0,
    );

    let bestPromo = null;
    let bestDiscount = 0;
    let bestPercent = 0;

    for (const pr of promos) {
      if (pr?.type === 'percent') {
        const d = Math.round((base * Number(pr.value || 0)) / 100);
        if (d > bestDiscount) {
          bestDiscount = d;
          bestPercent = Number(pr.value || 0);
          bestPromo = pr;
        }
      } else if (pr?.type === 'amount') {
        const d = Number(pr.value || 0);
        const pct = base > 0 ? Math.round((d / base) * 100) : 0;
        if (d > bestDiscount) {
          bestDiscount = d;
          bestPercent = pct;
          bestPromo = pr;
        }
      }
    }

    const finalPrice = Math.max(0, base - bestDiscount);

    // Send product with embedded promotion info
    const productWithPromo = {
      ...product,
      _promotion: bestPromo
        ? {
            code: bestPromo.code,
            discountPercent: bestPercent,
            discountAmount: bestDiscount,
            finalPrice,
            originalPrice: base,
          }
        : null,
    };

    onSelectProduct(productWithPromo);
    onClose();
  };

  const img = (publicId, width = 200) => {
    if (!publicId) return '/no-image.png';
    if (publicId.startsWith('http')) return publicId;
    return `https://res.cloudinary.com/${
      import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    }/image/upload/w_${width},f_auto,q_auto/${publicId}`;
  };

  if (!isOpen) return null;

  // Build a tree from flat categories
  const buildTree = (list) => {
    const byId = new Map();
    const roots = [];
    (list || []).forEach((c) => byId.set(String(c._id), { ...c, children: [] }));
    for (const c of byId.values()) {
      const pid = c.parentId ? String(c.parentId) : null;
      if (pid && byId.has(pid)) byId.get(pid).children.push(c);
      else roots.push(c);
    }
    // optional: sort by sort then name
    const sortNodes = (arr) =>
      arr
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name))
        .map((n) => ({ ...n, children: sortNodes(n.children || []) }));
    return sortNodes(roots);
  };

  const tree = buildTree(categories);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderTree = (nodes, level = 0) => {
    if (!Array.isArray(nodes) || !nodes.length) return null;
    return nodes.map((node) => {
      const id = String(node._id);
      const isExpanded = expanded.has(id);
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const isActive = selectedCategory?.slug === node.slug;
      return (
        <div key={id} className={styles.treeRow}>
          <div className={styles.treeLine} style={{ paddingLeft: 8 + level * 14 }}>
            {hasChildren ? (
              <button
                type="button"
                className={styles.chevron}
                onClick={() => toggleExpand(id)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className={styles.chevronPlaceholder} />
            )}
            <button
              className={`${styles.categoryItem} ${isActive ? styles.active : ''}`}
              onClick={() => handleCategoryClick(node)}
              title={node.name}
            >
              {node.icon || '📁'} {node.name}
            </button>
          </div>
          {hasChildren && isExpanded && <div>{renderTree(node.children, level + 1)}</div>}
        </div>
      );
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Chọn sản phẩm gửi cho khách hàng</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="🔍 Tìm kiếm sản phẩm..."
            value={searchText}
            onChange={handleSearch}
          />
        </div>

        <div className={styles.content}>
          {/* Categories sidebar */}
          <div className={styles.sidebar}>
            <h3>Danh mục</h3>
            <div className={styles.categoryList}>
              <button
                className={`${styles.categoryItem} ${!selectedCategory ? styles.active : ''}`}
                onClick={() => handleCategoryClick(null)}
              >
                📦 Tất cả sản phẩm
              </button>
              <div className={styles.treeList}>{renderTree(tree, 0)}</div>
            </div>
          </div>

          {/* Products grid */}
          <div className={styles.productsArea}>
            {loading ? (
              <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Đang tải sản phẩm...</p>
              </div>
            ) : products.length === 0 ? (
              <div className={styles.empty}>
                <p>Không tìm thấy sản phẩm nào</p>
              </div>
            ) : (
              <div className={styles.productGrid}>
                {Array.isArray(products) &&
                  products.map((product) => (
                    <div
                      key={product._id}
                      className={styles.productCard}
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className={styles.productImage}>
                        <img
                          src={img(
                            product.coverPublicId ||
                              product.images?.[0]?.publicId ||
                              product.images?.[0],
                            300,
                          )}
                          alt={product.name}
                          onError={(e) => {
                            e.target.src = '/no-image.png';
                          }}
                        />
                        {(() => {
                          const base = Number(
                            product.minPrice ??
                              product.basePrice ??
                              product?.variants?.[0]?.price ??
                              0,
                          );
                          const promos = promosByProduct[product._id] || [];
                          let bestDiscount = 0;
                          let bestPercent = 0;
                          for (const pr of promos) {
                            if (pr?.type === 'percent') {
                              const d = Math.round((base * Number(pr.value || 0)) / 100);
                              if (d > bestDiscount) {
                                bestDiscount = d;
                                bestPercent = Number(pr.value || 0);
                              }
                            } else if (pr?.type === 'amount') {
                              const d = Number(pr.value || 0);
                              const pct = base > 0 ? Math.round((d / base) * 100) : 0;
                              if (d > bestDiscount) {
                                bestDiscount = d;
                                bestPercent = pct;
                              }
                            }
                          }
                          return bestPercent > 0 ? (
                            <div className={styles.discountBadge}>-{Math.round(bestPercent)}%</div>
                          ) : null;
                        })()}
                      </div>
                      <div className={styles.productInfo}>
                        <h4>{product.name}</h4>
                        {(() => {
                          const base = Number(
                            product.minPrice ??
                              product.basePrice ??
                              product?.variants?.[0]?.price ??
                              0,
                          );
                          const promos = promosByProduct[product._id] || [];
                          let bestDiscount = 0;
                          let bestPercent = 0;
                          for (const pr of promos) {
                            if (pr?.type === 'percent') {
                              const d = Math.round((base * Number(pr.value || 0)) / 100);
                              if (d > bestDiscount) {
                                bestDiscount = d;
                                bestPercent = Number(pr.value || 0);
                              }
                            } else if (pr?.type === 'amount') {
                              const d = Number(pr.value || 0);
                              const pct = base > 0 ? Math.round((d / base) * 100) : 0;
                              if (d > bestDiscount) {
                                bestDiscount = d;
                                bestPercent = pct;
                              }
                            }
                          }
                          const finalPrice = Math.max(0, base - bestDiscount);
                          return bestDiscount > 0 ? (
                            <div className={styles.priceRow}>
                              <span className={styles.priceNow}>
                                {finalPrice.toLocaleString('vi-VN')}đ
                              </span>
                              <span className={styles.priceOld}>
                                {base.toLocaleString('vi-VN')}đ
                              </span>
                            </div>
                          ) : (
                            <p className={styles.price}>{base.toLocaleString('vi-VN')}đ</p>
                          );
                        })()}
                        {Array.isArray(promosByProduct[product._id]) &&
                          promosByProduct[product._id].length > 0 && (
                            <div className={styles.promoRow}>
                              {promosByProduct[product._id].map((promo) => (
                                <span key={promo.id || promo.code} className={styles.promoTag}>
                                  {promo.code}
                                </span>
                              ))}
                            </div>
                          )}
                        {product.ratingAvg > 0 && (
                          <div className={styles.rating}>
                            ⭐ {product.ratingAvg.toFixed(1)} ({product.ratingCount || 0})
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
