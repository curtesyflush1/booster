import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient';
import { Eye } from 'lucide-react';

type TxStatus = 'attempted' | 'carted' | 'purchased' | 'failed';

interface TransactionRow {
  id: string;
  product_id: string;
  retailer_slug: string;
  status: TxStatus;
  price_paid?: number | string | null;
  msrp?: number | string | null;
  qty?: number | null;
  alert_at?: string | null;
  added_to_cart_at?: string | null;
  purchased_at?: string | null;
  failure_reason?: string | null;
  region?: string | null;
  session_fingerprint?: string | null;
  created_at: string;
}

const badgeClass = (status: TxStatus) => {
  switch (status) {
    case 'purchased':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'carted':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

function formatMoney(v?: number | string | null): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n as number)) return '—';
  return `$${(n as number).toFixed(2)}`;
}

const AdminRecentTransactionsPanel: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(50);
  const [productNames, setProductNames] = useState<Record<string, { name: string; slug?: string; imageUrl?: string }>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<{ success: boolean; data: TransactionRow[] }>(
        '/admin/purchases/transactions/recent',
        { params: { limit } }
      );
      const rows = res.data.data || [];
      setTransactions(rows);

      // Fetch product names in batch for nicer display
      const ids = Array.from(new Set((rows || []).map(r => r.product_id).filter(Boolean)));
      if (ids.length > 0) {
        try {
          const batch = await apiClient.post<{ data?: { products?: any[] }; products?: any[] }>(
            '/products/by-ids',
            { ids }
          );
          const list = (batch.data as any)?.data?.products || (batch.data as any)?.products || [];
          const map: Record<string, { name: string; slug?: string; imageUrl?: string }> = {};
          for (const p of list) {
            if (p?.id) {
              const image = p.imageUrl || p.image_url || p.thumbnailUrl || p.thumbnail_url || p.image || null;
              map[p.id] = { name: p.name || p.slug || p.id, slug: p.slug, imageUrl: image || undefined };
            }
          }
          setProductNames(map);
        } catch (e) {
          // Non-fatal: leave names blank
        }
      } else {
        setProductNames({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Limit</label>
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.max(1, Math.min(200, parseInt(e.target.value || '50', 10))))}
            className="w-20 px-2 py-1 border rounded"
          />
          <button
            onClick={load}
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retailer</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price Paid</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500 text-sm">No transactions yet.</td>
              </tr>
            )}
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {new Date(tx.purchased_at || tx.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{tx.retailer_slug}</td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">
                  {(() => {
                    const meta = productNames[tx.product_id];
                    const href = meta?.slug
                      ? `/products?slug=${meta.slug}`
                      : `/products?productId=${tx.product_id}`;
                    return (
                      <div className="flex items-center gap-3" title={`${meta?.name || tx.product_id}${meta?.slug ? ` (${meta.slug})` : ''}`}>
                        {meta?.imageUrl ? (
                          <img
                            src={meta.imageUrl}
                            alt={meta?.name || 'Product'}
                            className="w-8 h-8 rounded object-cover bg-gray-200"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                            {(meta?.name || 'P').slice(0, 1)}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                            {meta?.name || tx.product_id}
                          </a>
                          {meta?.slug && (
                            <span className="text-xs text-gray-500">{meta.slug}</span>
                          )}
                        </div>
                        <a href={href} target="_blank" rel="noopener noreferrer" title="View">
                          <Eye className="w-4 h-4 text-blue-600" />
                        </a>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${badgeClass(tx.status)}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-700">{tx.qty ?? 1}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right text-sm text-gray-900">{formatMoney(tx.price_paid)}</td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 max-w-xs truncate" title={tx.failure_reason || ''}>
                  {tx.failure_reason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminRecentTransactionsPanel;
