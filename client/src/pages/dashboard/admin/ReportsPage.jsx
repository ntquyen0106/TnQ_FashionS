import { useEffect, useMemo, useState } from 'react';
import reportsApi from '@/api/reports-api';
import s from './ReportsPage.module.css';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';
// CSV helpers
const csvEscape = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n|\r/g, ' ');
  if (s.includes(',') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
};
const toCSV = (headers, rows) => {
  const head = headers.map((h) => csvEscape(h.label)).join(',');
  const lines = rows.map((r) => headers.map((h) => csvEscape(r[h.key])).join(','));
  return [head, ...lines].join('\n');
};
const downloadCSV = (filename, csv) => {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
// small date helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - Number(n || 0));
  return d;
}

function toParamDate(d) {
  // Return YYYY-MM-DD in LOCAL time to avoid UTC shift dropping to previous day
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const presets = [
  { key: 'today', label: 'Hôm nay', from: () => new Date(), to: () => new Date() },
  { key: '7d', label: '7 ngày', from: () => daysAgo(6), to: () => new Date() },
  { key: '30d', label: '30 ngày', from: () => daysAgo(29), to: () => new Date() },
  { key: '90d', label: '90 ngày', from: () => daysAgo(89), to: () => new Date() },
  {
    key: 'month',
    label: 'Tháng này',
    from: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: () => new Date(),
  },
];

function useActivePreset(fromParam, toParam) {
  for (const p of presets) {
    if (toParamDate(p.from()) === fromParam && toParamDate(p.to()) === toParam) return p.key;
  }
  return null;
}

function TabBar({ active, onChange }) {
  return (
    <div className={s.tabbar} role="tablist">
      <button
        role="tab"
        className={`${s.tab} ${active === 'overview' ? s.tabActive : ''}`}
        onClick={() => onChange('overview')}
      >
        Tổng quan
      </button>
      <button
        role="tab"
        className={`${s.tab} ${active === 'products' ? s.tabActive : ''}`}
        onClick={() => onChange('products')}
      >
        Sản phẩm
      </button>
      <button
        role="tab"
        className={`${s.tab} ${active === 'staff' ? s.tabActive : ''}`}
        onClick={() => onChange('staff')}
      >
        Nhân viên
      </button>
    </div>
  );
}

// short formatter for axis labels (compact)
const fmtShortVND = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
};

// simple chart helper: computes values, max, dimensions and a scale function
function useChart(daily = [], key = 'count') {
  const values = (daily || []).map((d) => Number(d[key] || 0));
  const max = values.length ? Math.max(...values) : 0;
  const H = 160; // chart inner height
  const PADDING = 12;
  // rough BW/GAP that will be tweaked by caller
  const BW = Math.max(8, Math.round(Math.min(28, 600 / Math.max(1, values.length))));
  const GAP = 8;
  const scale = (v) => {
    if (!max) return 0;
    return Math.round((v / max) * H);
  };
  return { values, max, H, BW, GAP, PADDING, scale };
}

// pick indexes for X tick labels (max ~10 ticks)
function pickXTickIndexes(n) {
  if (!n) return [];
  const maxTicks = 10;
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil(n / maxTicks);
  const idx = [];
  for (let i = 0; i < n; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return idx;
}
function OverviewPanel({ data, loading, from, to }) {
  const status = (data && data.statusCounts) || {};
  const daily = (data && data.daily) || [];

  const [chartKey, setChartKey] = useState('count');
  const [pageIndex, setPageIndex] = useState(0);
  const [ordersSort, setOrdersSort] = useState('date_desc');
  const PAGE_SIZE = 31;
  const pages = Math.max(1, Math.ceil(daily.length / PAGE_SIZE));

  useEffect(() => setPageIndex(0), [daily.length]);

  // client-side sorting for the orders table: date/count/revenue with asc/desc
  const sortedDaily = (daily || []).slice().sort((a, b) => {
    const [k, dir] = (ordersSort || 'date_desc').split('_');
    if (k === 'date') {
      const va = new Date(a.date).getTime();
      const vb = new Date(b.date).getTime();
      return dir === 'asc' ? va - vb : vb - va;
    }
    const va = Number(a[k] || 0);
    const vb = Number(b[k] || 0);
    return dir === 'asc' ? va - vb : vb - va;
  });

  // Orders table is shown chronologically; sorting UI removed per request.

  // Keep the chart chronological: compute a chrono-sorted slice for the chart pagination
  const chronoDaily = (daily || [])
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pageDaily = chronoDaily.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  const chartActive = useChart(pageDaily, chartKey === 'count' ? 'count' : 'revenue');

  const [tooltip, setTooltip] = useState(null);

  // layout params
  let BW = Math.max(12, chartActive.BW);
  let GAP = Math.max(8, chartActive.GAP);
  const n = chartActive.values.length;
  if (n <= 7) {
    GAP = Math.max(GAP, 22);
    BW = Math.max(10, Math.round(BW * 0.95));
  } else if (n <= 14) {
    GAP = Math.max(GAP, 16);
  } else if (n > 20) {
    GAP = Math.max(GAP, 12);
    BW = Math.max(8, Math.round(BW * 0.85));
  }
  if (n > 35) {
    GAP = Math.max(GAP, 16);
    BW = Math.max(6, Math.round(BW * 0.75));
  }

  const Y_LABEL_W = 56;
  const TICK_LEFT = Y_LABEL_W + 8;
  const LPAD = chartActive.PADDING + TICK_LEFT;
  const RPAD = chartActive.PADDING;
  const W = n * (BW + GAP) + LPAD + RPAD;

  // Decide stacking based on the user-selected date range (from/to),
  // not on how many days have data — this ensures selecting a 30-day
  // range will switch to stacked layout even if some days have no data.
  let rangeDays = (daily || []).length;
  try {
    if (from && to) {
      const f = new Date(from + 'T00:00:00');
      const t = new Date(to + 'T23:59:59');
      const msPerDay = 24 * 60 * 60 * 1000;
      rangeDays = Math.round((t - f) / msPerDay) + 1;
    }
  } catch (err) {
    // fallback to data length
  }

  // Stack chart above the orders table for ranges of 30 days or more
  // to prevent the orders table from needing horizontal scrolling when the chart is wide.
  const stacked = rangeDays >= 30;

  return (
    <>
      <div className={s.cards}>
        <div className={s.card}>
          <div className={s.label}>Doanh thu</div>
          <div className={s.value}>{fmtVND((data && data.revenue) || 0)}</div>
        </div>
        <div className={s.card}>
          <div className={s.label}>Đơn hoàn tất</div>
          <div className={s.value}>{(data && data.ordersDone) || 0}</div>
        </div>
        <div className={s.card}>
          <div className={s.label}>Giá trị TB/đơn</div>
          <div className={s.value}>{fmtVND((data && data.avgOrder) || 0)}</div>
        </div>
        <div className={s.card}>
          <div className={s.label}>Đang chờ</div>
          <div className={s.value}>{status.PENDING || 0}</div>
        </div>
        <div className={s.card}>
          <div className={s.label}>Đang giao</div>
          <div className={s.value}>{(status.SHIPPING || 0) + (status.DELIVERING || 0)}</div>
        </div>
        <div className={s.card}>
          <div className={s.label}>Đã hủy</div>
          <div className={s.value}>{status.CANCELLED || 0}</div>
        </div>
      </div>

      {stacked ? (
        <div className={s.overviewMain}>
          <section className={s.panel}>
            <h3>Biểu đồ</h3>
            <div className={s.chartWrap}>
              <div className={s.chartControls}>
                <div className={s.legendLabel}>Hiển thị:</div>
                <button
                  className={`${s.legendBtn} ${chartKey === 'count' ? s.legendActive : ''}`}
                  onClick={() => setChartKey('count')}
                >
                  Đơn
                </button>
                <button
                  className={`${s.legendBtn} ${chartKey === 'revenue' ? s.legendActive : ''}`}
                  onClick={() => setChartKey('revenue')}
                >
                  Doanh thu
                </button>
                {/* sort controls removed - table stays chronological */}
                {pages > 1 && (
                  <div className={s.pageControls}>
                    <button
                      className={s.pagerBtn}
                      onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                      disabled={pageIndex === 0}
                    >
                      ‹
                    </button>
                    <span className={s.pageInfo}>
                      Trang {pageIndex + 1} / {pages} — {pageDaily.length} ngày
                    </span>
                    <button
                      className={s.pagerBtn}
                      onClick={() => setPageIndex((p) => Math.min(p + 1, pages - 1))}
                      disabled={pageIndex === pages - 1}
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              {pageDaily.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <div
                    className={s.yAxisHtml}
                    style={{ left: 0, top: 20, height: chartActive.H, width: Y_LABEL_W }}
                    aria-hidden
                  >
                    <div className={s.yAxisHtmlInner}>
                      {chartKey === 'count' ? 'Đơn' : 'Doanh thu (đ)'}
                    </div>
                  </div>

                  <svg
                    className={s.chart}
                    width={W}
                    height={chartActive.H + 72}
                    role="img"
                    aria-label="Biểu đồ đơn hàng theo ngày"
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>

                    <rect
                      x={LPAD}
                      y={20}
                      width={W - LPAD - RPAD}
                      height={chartActive.H}
                      rx={8}
                      fill="#f9fafb"
                    />

                    {Array.from({ length: 4 }).map((_, i) => {
                      const ticks = 3;
                      const val = Math.round((chartActive.max / ticks) * i);
                      const y = chartActive.H - chartActive.scale(val) + 20;
                      return (
                        <g key={i}>
                          <line x1={LPAD} x2={W - RPAD} y1={y} y2={y} className={s.gridLine} />
                          <text x={TICK_LEFT} y={y - 4} className={s.chartAxisLabel}>
                            {chartKey === 'count' ? String(val) : fmtShortVND(val)}
                          </text>
                        </g>
                      );
                    })}

                    {chartActive.values.map((v, i) => {
                      const h = chartActive.scale(v);
                      const x = LPAD + i * (BW + GAP);
                      const y = chartActive.H - h + 20;
                      const d = pageDaily[i];
                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={BW}
                            height={h}
                            rx="5"
                            className={s.bar}
                            fill="url(#barGrad)"
                            onMouseEnter={(e) =>
                              setTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                date: fmtDate(d.date),
                                count: d.count,
                                revenue: d.revenue,
                              })
                            }
                            onMouseMove={(e) =>
                              setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
                            }
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <title>{`${fmtDate(d.date)}\n${d.count} đơn · ${fmtVND(
                              d.revenue,
                            )}`}</title>
                          </rect>
                          {chartKey === 'count' && (
                            <text x={x + BW / 2} y={y - 6} className={s.barLabel}>
                              {v}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {(() => {
                      const ticks = pickXTickIndexes(chartActive.values.length);
                      return ticks.map((i) => {
                        const x = LPAD + i * (BW + GAP) + BW / 2;
                        const d = pageDaily[i];
                        return (
                          <text key={i} x={x} y={chartActive.H + 40} className={s.chartXLabel}>
                            {new Date(d.date).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </text>
                        );
                      });
                    })()}
                  </svg>

                  <div className={s.xAxisHtml} style={{ width: W, marginLeft: LPAD }}>
                    Ngày
                  </div>

                  {tooltip && (
                    <div
                      className={s.tooltip}
                      style={{ left: tooltip.x + 8, top: tooltip.y + 8 }}
                      role="status"
                    >
                      <div style={{ fontWeight: 700 }}>{tooltip.date}</div>
                      <div>{String(tooltip.count)} đơn</div>
                      <div>{fmtVND(tooltip.revenue)}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={s.empty}>
                  {loading ? 'Đang tải...' : 'Không có dữ liệu trong khoảng thời gian này.'}
                </div>
              )}
            </div>
          </section>

          <section className={s.panel}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0 }}>Đơn hàng</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>Sắp xếp:</label>
                  <select
                    className={s.select}
                    value={ordersSort}
                    onChange={(e) => setOrdersSort(e.target.value)}
                    aria-label="Sắp xếp đơn hàng"
                    style={{ minWidth: 160 }}
                  >
                    <option value="date_desc">Ngày (mới nhất)</option>
                    <option value="date_asc">Ngày (cũ nhất)</option>
                    <option value="count_desc">Đơn ↓</option>
                    <option value="count_asc">Đơn ↑</option>
                    <option value="revenue_desc">Doanh thu ↓</option>
                    <option value="revenue_asc">Doanh thu ↑</option>
                  </select>
                  <button
                    className={`${s.legendBtn} ${s.exportBtn}`}
                    onClick={() => {
                      const rows = (sortedDaily || []).map((d) => ({
                        date: new Date(d.date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }),
                        count: d.count,
                        revenue: d.revenue,
                      }));
                      const headers = [
                        { key: 'date', label: 'Ngày' },
                        { key: 'count', label: 'Đơn' },
                        { key: 'revenue', label: 'Doanh thu' },
                      ];
                      downloadCSV('don-hang-theo-ngay.csv', toCSV(headers, rows));
                    }}
                    disabled={(sortedDaily || []).length === 0}
                  >
                    Xuất CSV
                  </button>
                </div>
              </div>
            </div>
            <div className={s.table}>
              <div className={`${s.row} ${s.headerRow}`}>
                <div className={s.cell}>Ngày</div>
                <div className={`${s.cell} ${s.right}`}>Đơn</div>
                <div className={`${s.cell} ${s.right}`}>Doanh thu</div>
              </div>
              {(sortedDaily || []).map((d) => (
                <div className={s.row} key={d.date}>
                  <div className={s.cell}>{fmtDate(d.date)}</div>
                  <div className={`${s.cell} ${s.right}`}>{d.count}</div>
                  <div className={`${s.cell} ${s.right}`}>{fmtVND(d.revenue)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className={`${s.grid} ${s.grid2}`}>
          <section className={s.panel}>
            <h3>Biểu đồ</h3>
            <div className={s.chartWrap}>
              <div className={s.chartControls}>
                <div className={s.legendLabel}>Hiển thị:</div>
                <button
                  className={`${s.legendBtn} ${chartKey === 'count' ? s.legendActive : ''}`}
                  onClick={() => setChartKey('count')}
                >
                  Đơn
                </button>
                <button
                  className={`${s.legendBtn} ${chartKey === 'revenue' ? s.legendActive : ''}`}
                  onClick={() => setChartKey('revenue')}
                >
                  Doanh thu
                </button>
              </div>

              {pageDaily.length > 0 ? (
                <div style={{ position: 'relative' }}>
                  <div
                    className={s.yAxisHtml}
                    style={{ left: 0, top: 20, height: chartActive.H, width: Y_LABEL_W }}
                    aria-hidden
                  >
                    <div className={s.yAxisHtmlInner}>
                      {chartKey === 'count' ? 'Đơn' : 'Doanh thu (đ)'}
                    </div>
                  </div>

                  <svg
                    className={s.chart}
                    width={W}
                    height={chartActive.H + 72}
                    role="img"
                    aria-label="Biểu đồ đơn hàng theo ngày"
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>

                    <rect
                      x={LPAD}
                      y={20}
                      width={W - LPAD - RPAD}
                      height={chartActive.H}
                      rx={8}
                      fill="#f9fafb"
                    />

                    {Array.from({ length: 4 }).map((_, i) => {
                      const ticks = 3;
                      const val = Math.round((chartActive.max / ticks) * i);
                      const y = chartActive.H - chartActive.scale(val) + 20;
                      return (
                        <g key={i}>
                          <line x1={LPAD} x2={W - RPAD} y1={y} y2={y} className={s.gridLine} />
                          <text x={TICK_LEFT} y={y - 4} className={s.chartAxisLabel}>
                            {chartKey === 'count' ? String(val) : fmtShortVND(val)}
                          </text>
                        </g>
                      );
                    })}

                    {chartActive.values.map((v, i) => {
                      const h = chartActive.scale(v);
                      const x = LPAD + i * (BW + GAP);
                      const y = chartActive.H - h + 20;
                      const d = pageDaily[i];
                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={BW}
                            height={h}
                            rx="5"
                            className={s.bar}
                            fill="url(#barGrad)"
                            onMouseEnter={(e) =>
                              setTooltip({
                                x: e.clientX,
                                y: e.clientY,
                                date: fmtDate(d.date),
                                count: d.count,
                                revenue: d.revenue,
                              })
                            }
                            onMouseMove={(e) =>
                              setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
                            }
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <title>{`${fmtDate(d.date)}\n${d.count} đơn · ${fmtVND(
                              d.revenue,
                            )}`}</title>
                          </rect>
                          {chartKey === 'count' && (
                            <text x={x + BW / 2} y={y - 6} className={s.barLabel}>
                              {v}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {(() => {
                      const ticks = pickXTickIndexes(chartActive.values.length);
                      return ticks.map((i) => {
                        const x = LPAD + i * (BW + GAP) + BW / 2;
                        const d = pageDaily[i];
                        return (
                          <text key={i} x={x} y={chartActive.H + 40} className={s.chartXLabel}>
                            {new Date(d.date).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </text>
                        );
                      });
                    })()}
                  </svg>

                  <div className={s.xAxisHtml} style={{ width: W, marginLeft: LPAD }}>
                    Ngày
                  </div>

                  {tooltip && (
                    <div
                      className={s.tooltip}
                      style={{ left: tooltip.x + 8, top: tooltip.y + 8 }}
                      role="status"
                    >
                      <div style={{ fontWeight: 700 }}>{tooltip.date}</div>
                      <div>{String(tooltip.count)} đơn</div>
                      <div>{fmtVND(tooltip.revenue)}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={s.empty}>
                  {loading ? 'Đang tải...' : 'Không có dữ liệu trong khoảng thời gian này.'}
                </div>
              )}
            </div>
          </section>

          <section className={s.panel}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h3 style={{ margin: 0 }}>Đơn hàng</h3>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 13, color: 'var(--muted)' }}>Sắp xếp:</label>
                  <select
                    className={s.select}
                    value={ordersSort}
                    onChange={(e) => setOrdersSort(e.target.value)}
                    aria-label="Sắp xếp đơn hàng"
                    style={{ minWidth: 160 }}
                  >
                    <option value="date_desc">Ngày (mới nhất)</option>
                    <option value="date_asc">Ngày (cũ nhất)</option>
                    <option value="count_desc">Đơn ↓</option>
                    <option value="count_asc">Đơn ↑</option>
                    <option value="revenue_desc">Doanh thu ↓</option>
                    <option value="revenue_asc">Doanh thu ↑</option>
                  </select>
                  <button
                    className={`${s.legendBtn} ${s.exportBtn}`}
                    onClick={() => {
                      const rows = (sortedDaily || []).map((d) => ({
                        date: new Date(d.date).toLocaleDateString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                        }),
                        count: d.count,
                        revenue: d.revenue,
                      }));
                      const headers = [
                        { key: 'date', label: 'Ngày' },
                        { key: 'count', label: 'Đơn' },
                        { key: 'revenue', label: 'Doanh thu' },
                      ];
                      downloadCSV('don-hang-theo-ngay.csv', toCSV(headers, rows));
                    }}
                    disabled={(sortedDaily || []).length === 0}
                  >
                    Xuất CSV
                  </button>
                </div>
              </div>
            </div>
            <div className={s.table}>
              <div className={`${s.row} ${s.headerRow}`}>
                <div className={s.cell}>Ngày</div>
                <div className={`${s.cell} ${s.right}`}>Đơn</div>
                <div className={`${s.cell} ${s.right}`}>Doanh thu</div>
              </div>
              {(sortedDaily || []).map((d) => (
                <div className={s.row} key={d.date}>
                  <div className={s.cell}>{fmtDate(d.date)}</div>
                  <div className={`${s.cell} ${s.right}`}>{d.count}</div>
                  <div className={`${s.cell} ${s.right}`}>{fmtVND(d.revenue)}</div>
                </div>
              ))}
              {!loading && (daily || []).length === 0 && (
                <div className={s.empty}>Không có dữ liệu trong khoảng thời gian này</div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ProductsPanel({ from, to }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_SIZE_PRODUCTS = 30;
  // sort format: "key_dir" where key is 'qty' or 'revenue' and dir is 'asc' or 'desc'
  const [sort, setSort] = useState('qty_desc');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // server currently ignores sort param (returns top by qty desc),
        // we'll still fetch and apply the chosen sort client-side for predictable UX
        const res = await reportsApi.topProducts({ from, to, limit: 50 });
        if (!alive) return;
        setRows((res && res.items) || []);
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to, sort]);

  const filtered = rows.filter(
    (r) =>
      !q ||
      (r.name && r.name.toLowerCase().includes(q.toLowerCase())) ||
      ((r.variantSku || '') && r.variantSku.toLowerCase().includes(q.toLowerCase())),
  );

  // reset page when filter changes
  useEffect(() => setPageIndex(0), [q, filtered.length]);

  // apply client-side sorting according to selected sort key and direction
  const [sortKey, sortDir] = (sort || 'qty_desc').split('_');
  const sorted = filtered.slice().sort((a, b) => {
    const va = Number(a[sortKey] || 0);
    const vb = Number(b[sortKey] || 0);
    if (va === vb) return 0;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE_PRODUCTS));
  const visible = sorted.slice(
    pageIndex * PAGE_SIZE_PRODUCTS,
    pageIndex * PAGE_SIZE_PRODUCTS + PAGE_SIZE_PRODUCTS,
  );

  return (
    <div className={s.panel}>
      <div className={s.toolbar}>
        <input
          className={s.input}
          placeholder="Tìm sản phẩm hoặc SKU"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={s.select} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="qty_desc">Số lượng ↓</option>
          <option value="qty_asc">Số lượng ↑</option>
          <option value="revenue_desc">Doanh thu ↓</option>
          <option value="revenue_asc">Doanh thu ↑</option>
        </select>
        <button
          className={`${s.legendBtn} ${s.exportBtn}`}
          onClick={() => {
            const rows = sorted.map((r) => ({
              name: r.name,
              qty: r.qty,
              revenue: r.revenue,
            }));
            const headers = [
              { key: 'name', label: 'Sản phẩm' },
              { key: 'qty', label: 'SL' },
              { key: 'revenue', label: 'Doanh thu' },
            ];
            downloadCSV('top-san-pham.csv', toCSV(headers, rows));
          }}
          disabled={sorted.length === 0}
        >
          Xuất CSV
        </button>
        {sorted.length > PAGE_SIZE_PRODUCTS && (
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={s.pagerBtn}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
            >
              ‹
            </button>
            <span className={s.pageInfo}>
              Trang {pageIndex + 1} / {pages}
            </span>
            <button
              className={s.pagerBtn}
              onClick={() => setPageIndex((p) => Math.min(p + 1, pages - 1))}
              disabled={pageIndex === pages - 1}
            >
              ›
            </button>
          </div>
        )}
      </div>
      <div className={s.table}>
        <div className={`${s.row} ${s.headerRow}`}>
          <div className={s.cell}>Sản phẩm</div>
          <div className={`${s.cell} ${s.right}`}>SL</div>
          <div className={`${s.cell} ${s.right}`}>Doanh thu</div>
        </div>
        {visible.map((r) => (
          <div className={s.row} key={String(r.productId) + (r.variantSku || '')}>
            <div className={s.cell}>
              {r.name}
              {r.variantSku ? ` · ${r.variantSku}` : ''}
            </div>
            <div className={`${s.cell} ${s.right}`}>{r.qty}</div>
            <div className={`${s.cell} ${s.right}`}>{fmtVND(r.revenue)}</div>
          </div>
        ))}
        {!loading && filtered.length === 0 && <div className={s.empty}>Không có dữ liệu.</div>}
      </div>
    </div>
  );
}

function StaffPanel({ from, to }) {
  const [loading, setLoading] = useState(false);
  const [staffData, setStaffData] = useState([]);

  // filter: minimum total orders
  // (removed) minTotal filter - show all staff by default

  // sort staff by total: 'total_desc' | 'total_asc'
  const [staffSort, setStaffSort] = useState('total_desc');

  // pagination for wide ranges (show up to PAGE_SIZE days per page)
  const PAGE_SIZE = 30;
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await reportsApi.ordersByStaff({ from, to });
        if (!alive) return;
        setStaffData((res && res.items) || []);
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to]);

  // reset page when range changes
  useEffect(() => setPageIndex(0), [from, to]);

  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T23:59:59');
  const days = [];
  // Build list of days using LOCAL date, not UTC toISOString (which shifts back a day in VN)
  for (let d = new Date(f); d <= t; d.setDate(d.getDate() + 1)) {
    days.push(toParamDate(d));
  }

  const pages = Math.max(1, Math.ceil(days.length / PAGE_SIZE));
  const pageDays = days.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);

  // compute totals and filter staff by minTotal
  const staffWithTotals = (staffData || []).map((st) => {
    const totalAll = (st.days || []).reduce((s, it) => s + (it.count || 0), 0);
    return { ...st, total: totalAll };
  });

  // no minTotal filter: use all staffWithTotals
  const filteredStaff = staffWithTotals;

  // apply staff sort (by total asc/desc)
  const [staffSortKey, staffSortDir] = (staffSort || 'total_desc').split('_');
  const sortedStaff = filteredStaff.slice().sort((a, b) => {
    const va = Number(a.total || 0);
    const vb = Number(b.total || 0);
    if (va === vb) return 0;
    return staffSortDir === 'asc' ? va - vb : vb - va;
  });

  return (
    <div className={s.panel}>
      {staffData.length === 0 && !loading ? (
        <div className={s.empty}>Không có dữ liệu nhân viên trong khoảng này.</div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Nhân viên</div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* minTotal filter removed; show all staff */}
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Sắp xếp:</label>
              <select
                className={s.select}
                value={staffSort}
                onChange={(e) => setStaffSort(e.target.value)}
                aria-label="Sắp xếp nhân viên theo tổng"
                style={{ minWidth: 140 }}
              >
                <option value="total_desc">Tổng ↓</option>
                <option value="total_asc">Tổng ↑</option>
              </select>
              <button
                className={`${s.pagerBtn} ${s.exportBtn}`}
                onClick={() => {
                  const headers = [
                    { key: 'name', label: 'Nhân viên' },
                    ...days.map((dd) => ({
                      key: dd,
                      label: new Date(dd).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      }),
                    })),
                    { key: 'total', label: 'Tổng' },
                  ];
                  const rows = sortedStaff.map((st) => {
                    const map = new Map((st.days || []).map((r) => [r.date, r.count]));
                    const row = { name: st.staffName, total: st.total };
                    days.forEach((dd) => {
                      row[dd] = map.get(dd) || 0;
                    });
                    return row;
                  });
                  downloadCSV('nhan-vien-theo-ngay.csv', toCSV(headers, rows));
                }}
                disabled={sortedStaff.length === 0}
              >
                Xuất CSV
              </button>
              {pages > 1 && (
                <>
                  <button
                    className={s.pagerBtn}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={pageIndex === 0}
                  >
                    ‹
                  </button>
                  <span className={s.pageInfo}>
                    Trang {pageIndex + 1} / {pages} — {pageDays.length} ngày
                  </span>
                  <button
                    className={`${s.pagerBtn} ${s.exportBtn}`}
                    onClick={() => setPageIndex((p) => Math.min(p + 1, pages - 1))}
                    disabled={pageIndex === pages - 1}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={s.staffWrap}>
            <table className={s.smallTable}>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  {pageDays.map((dd) => (
                    <th key={dd}>
                      {new Date(dd).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </th>
                  ))}
                  <th>Tổng</th>
                </tr>
              </thead>
              <tbody>
                {sortedStaff.map((st, rowIdx) => {
                  const map = new Map((st.days || []).map((r) => [r.date, r.count]));
                  const totalAll = st.total;
                  return (
                    <tr key={String(st.staffId) + st.staffName} className={s.staffRow}>
                      <td className={s.staffName}>{st.staffName}</td>
                      {pageDays.map((dd) => {
                        const c = map.get(dd) || 0;
                        const cls = c >= 6 ? s.countHigh : c >= 2 ? s.countMed : s.countLow;
                        return (
                          <td key={dd} className={s.centerCell}>
                            {c ? (
                              <span className={`${s.countBadge} ${cls}`}>{c}</span>
                            ) : (
                              <span className={s.countZero}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={s.centerCell}>{totalAll}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
function ReportsPage() {
  const [from, setFrom] = useState(toParamDate(daysAgo(29)));
  const [to, setTo] = useState(toParamDate(new Date()));
  const [active, setActive] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);

  const activePreset = useActivePreset(from, to);

  useEffect(() => {
    if (active !== 'overview') return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await reportsApi.overview({ from, to });
        if (!mounted) return;
        setOverview(res || null);
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [from, to, active]);

  return (
    <div className={s.page}>
      <div className={s.header}>
        <h2>Thống kê</h2>
        <div className={s.filters}>
          <div className={s.presets}>
            {presets.map((p) => (
              <button
                key={p.key}
                className={`${s.presetBtn} ${activePreset === p.key ? s.presetActive : ''}`}
                onClick={() => {
                  setFrom(toParamDate(p.from()));
                  setTo(toParamDate(p.to()));
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className={s.rangeInputs}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>—</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      <TabBar active={active} onChange={(k) => setActive(k)} />

      {active === 'overview' && (
        <OverviewPanel data={overview} loading={loading} from={from} to={to} />
      )}
      {active === 'products' && <ProductsPanel from={from} to={to} />}
      {active === 'staff' && <StaffPanel from={from} to={to} />}
    </div>
  );
}

export default ReportsPage;

// Add the following utility function at the top of the file
const fmtDate = (d) => new Date(d).toLocaleString('vi-VN');
