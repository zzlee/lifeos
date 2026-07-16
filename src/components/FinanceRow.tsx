import React from 'react';
import { toLocalDisplayTime } from '../lib/timeUtils';

export interface FinanceRowData {
  items: any[];
  timezone: string;
  openEditExpense: (item: any) => void;
  openEditAccounting: (item: any) => void;
  handleDeleteExpense: (id: number) => void;
  handleDeleteAccountingTransaction: (id: number) => void;
}

interface FinanceRowProps {
  index: number;
  style: React.CSSProperties;
  data: FinanceRowData;
}

export const FinanceRow = ({ index, style, data }: FinanceRowProps) => {
  const {
    items,
    timezone,
    openEditExpense,
    openEditAccounting,
    handleDeleteExpense,
    handleDeleteAccountingTransaction,
  } = data;
  const item = items[index];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => item.type === "internal" ? openEditExpense(item) : openEditAccounting(item.original)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.type === "internal" ? openEditExpense(item) : openEditAccounting(item.original);
        }
      }}
      style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
          <span className={`tag ${item.type === 'external' ? 'secondary' : 'neutral'}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>{item.category}</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{toLocalDisplayTime(item.date, timezone)}</span>
        </div>
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: '#334155' }} title={item.note}>
          {item.note || '無備註'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div className="strong" style={{ fontSize: '1rem' }}>NT$ {item.amount}</div>
        <div className="table-actions">
          {item.type === "internal" ? (
            <button className="icon-button danger" onClick={(e) => { e.stopPropagation(); handleDeleteExpense(item.id); }} title="刪除" aria-label="刪除消費">🗑️</button>
          ) : (
            <button className="icon-button danger" onClick={(e) => { e.stopPropagation(); handleDeleteAccountingTransaction(item.id); }} title="刪除" aria-label="刪除外部記帳">🗑️</button>
          )}
        </div>
      </div>
    </div>
  );
};