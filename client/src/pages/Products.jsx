import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@/api';
import { formatCurrency } from '@/utils/format';
import EmptyState from '@/components/EmptyState';

export default function Products() {
  const {
    data = { items: [] },
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsApi.list(),
  });

  if (isLoading) return <div style={{ padding: 24 }}>Đang tải…</div>;
  if (isError) return <EmptyState title="Không tải được sản phẩm" />;

  return (
    <div style={{ padding: 24 }}>
      <h1>Danh sách sản phẩm</h1>
      <ul>
        {data.items.map((p) => (
          <li key={p._id}>
            {p.name} — {formatCurrency(p.price)}
          </li>
        ))}
      </ul>
    </div>
  );
}
