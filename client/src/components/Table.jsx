export default function Table({
  columns = [],
  data = [],
  rowKey = '_id',
  emptyText = 'Không có dữ liệu',
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
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
                colSpan={columns.length}
                style={{ padding: 16, textAlign: 'center', color: '#777' }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row[rowKey]}>
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
