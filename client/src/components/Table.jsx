export default function Table({
  columns = [],
  data = [],
  rowKey = '_id',
  emptyText = 'Không có dữ liệu',
  rowSelection, // { selectedRowKeys: [], onChange: (keys)=>void }
}) {
  const sel = rowSelection;
  const allKeys = data.map((row) => row[rowKey]);
  const allChecked = sel
    ? allKeys.every((k) => sel.selectedRowKeys.includes(k)) && allKeys.length > 0
    : false;
  const someChecked = sel
    ? allKeys.some((k) => sel.selectedRowKeys.includes(k)) && !allChecked
    : false;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {sel && (
              <th style={{ width: 36, padding: 10, borderBottom: '1px solid #eee' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => el && (el.indeterminate = someChecked)}
                  onChange={(e) => {
                    if (e.target.checked) sel.onChange(allKeys);
                    else sel.onChange([]);
                  }}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key || c.dataIndex}
                style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid #eee' }}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (sel ? 1 : 0)}
                style={{ padding: 16, textAlign: 'center', color: '#777' }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row[rowKey]}>
                {sel && (
                  <td style={{ padding: 10, borderBottom: '1px solid #f3f3f3' }}>
                    <input
                      type="checkbox"
                      checked={sel.selectedRowKeys.includes(row[rowKey])}
                      onChange={(e) => {
                        const k = row[rowKey];
                        if (e.target.checked)
                          sel.onChange(Array.from(new Set([...sel.selectedRowKeys, k])));
                        else sel.onChange(sel.selectedRowKeys.filter((x) => x !== k));
                      }}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key || c.dataIndex}
                    style={{ padding: 10, borderBottom: '1px solid #f3f3f3' }}
                  >
                    {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
