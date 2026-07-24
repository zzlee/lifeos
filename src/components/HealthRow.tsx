import React from 'react';
import { toLocalDisplayTime } from '../lib/timeUtils';
import type { HealthEntry } from '../lib/types';

export interface HealthRowData {
  items: HealthEntry[];
  timezone: string;
  openEditHealth: (item: HealthEntry) => void;
  handleDeleteHealth: (id: number) => void;
}

interface HealthRowProps {
  index: number;
  style: React.CSSProperties;
  data: HealthRowData;
}

export const HealthRow = ({ index, style, data }: HealthRowProps) => {
  const { items, timezone, openEditHealth, handleDeleteHealth } = data;
  const item = items[index];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openEditHealth(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEditHealth(item);
        }
      }}
      style={{ ...style, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '4px' }}>
          {toLocalDisplayTime(item.date, timezone)}
        </div>
        <div style={{ display: 'flex', gap: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', color: '#334155' }}>
          <span>血壓: {item.sys}/{item.dia}</span>
          <span>心跳: {item.hr}</span>
          <span>體重: {item.weight ?? "-"}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div className="table-actions">
          <button className="icon-button danger" onClick={(e) => { e.stopPropagation(); handleDeleteHealth(item.id); }} title="刪除" aria-label="刪除健康紀錄">🗑️</button>
        </div>
      </div>
    </div>
  );
};
