import { useEffect, useState } from "react";
import { http } from "../api/http";

export default function Products() {
  const [data, setData] = useState({ items: [] });

  useEffect(() => {
    const load = async () => {
      const res = await http.get("/products");
      setData(res.data);
    };
    load();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Danh sách sản phẩm</h1>
      <ul>
        {data.items.map(p => (
          <li key={p._id}>
            {p.name} – {p.price}₫
          </li>
        ))}
      </ul>
    </div>
  );
}
