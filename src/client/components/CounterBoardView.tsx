import React from 'react';
import type { CounterGameState } from '../../core/example';
import { Plus, RotateCcw, Activity } from 'lucide-react';

export interface CounterBoardViewProps {
  G: CounterGameState;
  onIncrement: (amount: number) => void;
  onReset: () => void;
  readOnly?: boolean;
}

export const CounterBoardView: React.FC<CounterBoardViewProps> = ({
  G,
  onIncrement,
  onReset,
  readOnly = false
}) => {
  return (
    <div className="counter-board-shell">
      <div className="counter-main-card">
        <span className="counter-badge-label">Active Count</span>
        <div className="counter-huge-display tabular-nums">
          {G.count}
        </div>

        <div className="counter-controls-row">
          <button
            type="button"
            className="btn-primary counter-action-btn"
            onClick={() => onIncrement(1)}
            disabled={readOnly}
          >
            <Plus size={18} /> +1
          </button>
          <button
            type="button"
            className="btn-primary counter-action-btn"
            onClick={() => onIncrement(5)}
            disabled={readOnly}
          >
            <Plus size={18} /> +5
          </button>
          <button
            type="button"
            className="btn-primary counter-action-btn"
            onClick={() => onIncrement(10)}
            disabled={readOnly}
          >
            <Plus size={18} /> +10
          </button>
          <button
            type="button"
            className="btn-secondary counter-action-btn"
            onClick={onReset}
            disabled={readOnly}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      <div className="counter-history-card">
        <div className="counter-history-header">
          <Activity size={16} />
          <span>Action Log ({G.history.length})</span>
        </div>

        {G.history.length === 0 ? (
          <p className="counter-empty-history">No actions recorded yet. Click a button above to test real-time state sync.</p>
        ) : (
          <div className="counter-history-list">
            {G.history.slice(-8).reverse().map((item, idx) => (
              <div key={idx} className="counter-history-item">
                <span className="history-index">#{item.actionIndex}</span>
                <span className="history-player">Player {Number(item.player) + 1}</span>
                <span className="history-amount">
                  {item.amount === 0 ? 'Reset count' : `+${item.amount}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
