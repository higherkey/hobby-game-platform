import React from 'react';
import type { SoCloverGameState } from '../../games/so-clover/types';
import { getRecordOfLegendsRating } from '../../games/so-clover/game';
import { Trophy, RefreshCw, Star } from 'lucide-react';

export interface ScoreViewProps {
  G: SoCloverGameState;
  onPlayAgain?: () => void;
}

export const ScoreView: React.FC<ScoreViewProps> = ({ G, onPlayAgain }) => {
  const rating = getRecordOfLegendsRating(G.totalScore, G.playerOrder.length);

  return (
    <div className="gameover-overlay">
      <Trophy size={48} className="trophy-icon" />
      <h2>Game Complete!</h2>

      <div className="score-display-huge">
        {G.totalScore} <span className="score-subtext">/ {G.maxPossibleScore}</span>
      </div>

      <div className="legend-badge">
        <Star size={18} /> {rating.title}
      </div>

      <p className="legend-description">{rating.description}</p>

      <div className="lobby-card score-breakdown-card">
        <h4 className="score-breakdown-title">Board Score Breakdown</h4>
        {G.playerOrder.map((pid, idx) => {
          const p = G.players[pid];
          return (
            <div key={pid} className="score-breakdown-row">
              <span>
                <strong>Player {idx + 1}</strong> ({p.playerName})
              </span>
              <span className="badge badge-green">{p.score} pts</span>
            </div>
          );
        })}
      </div>

      {onPlayAgain && (
        <button type="button" className="btn-primary" onClick={onPlayAgain}>
          <RefreshCw size={18} /> Play Again
        </button>
      )}
    </div>
  );
};
