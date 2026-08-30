import React from 'react';
import { Play, Plus, Users, Smartphone, Globe, Shield, Sparkles, ArrowRight, Dices, Layers, Clock } from 'lucide-react';

export interface HomePageProps {
  onNavigate: (page: 'home' | 'play' | 'admin') => void;
  onSelectGameForPlay: (gameName: string, mode: 'local' | 'online') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSelectGameForPlay }) => {
  return (
    <div className="home-container">
      {/* Hero Banner (Top-Left Anchor & Gutenberg Z-Pattern) */}
      <section className="hero-section">
        <div className="hero-badge-pill">
          <Sparkles size={14} />
          <span>Open Web Tabletop Platform</span>
        </div>

        <h1 className="hero-heading">
          The Modern Multiplayer Web Tabletop
        </h1>

        <p className="hero-description">
          Play cooperative deduction, party games, and tabletop favorites directly in your browser.
          Zero downloads, instant room codes, and seamless local pass-and-play.
        </p>

        <div className="hero-cta-group">
          <button
            type="button"
            className="btn-primary hero-btn-main"
            onClick={() => onNavigate('play')}
          >
            <Play size={18} /> Jump Into Games <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="btn-secondary hero-btn-sub"
            onClick={() => onSelectGameForPlay('so-clover', 'online')}
          >
            <Plus size={18} /> Host So Clover! Room
          </button>
        </div>
      </section>

      {/* Featured Games Showcase Section */}
      <section className="featured-games-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Featured Tabletop Games</h2>
            <p className="section-subtitle">Jump straight into active board games available right now.</p>
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => onNavigate('play')}
          >
            View All Games <ArrowRight size={14} />
          </button>
        </div>

        <div className="featured-games-grid">
          {/* Card 1: So Clover */}
          <div className="featured-game-card">
            <div className="game-card-banner clover-theme-banner">
              <span className="game-card-icon">🍀</span>
              <span className="badge badge-green">Featured Co-Op</span>
            </div>

            <div className="game-card-body">
              <h3 className="game-card-title">So Clover!</h3>
              <p className="game-card-desc">
                A cooperative word-association deduction game. Link keywords with clever clues and work
                together to find the perfect clover matches!
              </p>

              <div className="game-specs-row">
                <span className="spec-pill">
                  <Users size={13} /> 1-6 Players
                </span>
                <span className="spec-pill">
                  <Clock size={13} /> 15-30 Min
                </span>
                <span className="spec-pill">
                  <Layers size={13} /> Deduction
                </span>
              </div>

              <div className="game-card-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onSelectGameForPlay('so-clover', 'online')}
                >
                  <Globe size={16} /> Online Play
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onSelectGameForPlay('so-clover', 'local')}
                >
                  <Smartphone size={16} /> Pass & Play
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Counter Duel */}
          <div className="featured-game-card">
            <div className="game-card-banner counter-theme-banner">
              <span className="game-card-icon">⚡</span>
              <span className="badge badge-yellow">Fast Arcade</span>
            </div>

            <div className="game-card-body">
              <h3 className="game-card-title">Counter Duel</h3>
              <p className="game-card-desc">
                Fast turn-based numeric strategy showdown and real-time state synchronization test ground.
              </p>

              <div className="game-specs-row">
                <span className="spec-pill">
                  <Users size={13} /> 1-4 Players
                </span>
                <span className="spec-pill">
                  <Clock size={13} /> 5 Min
                </span>
                <span className="spec-pill">
                  <Dices size={13} /> Quick Play
                </span>
              </div>

              <div className="game-card-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onSelectGameForPlay('counter-example', 'online')}
                >
                  <Globe size={16} /> Play Duel
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onSelectGameForPlay('counter-example', 'local')}
                >
                  <Smartphone size={16} /> Solo Test
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Upcoming Lab Title */}
          <div className="featured-game-card coming-soon-card">
            <div className="game-card-banner lab-theme-banner">
              <span className="game-card-icon">🔐</span>
              <span className="badge badge-spectator">In Platform Lab</span>
            </div>

            <div className="game-card-body">
              <h3 className="game-card-title">Decryption Protocol</h3>
              <p className="game-card-desc">
                Team-vs-team secret frequency communication and signal interception tabletop game. Coming soon to HobbyBoard.
              </p>

              <div className="game-specs-row">
                <span className="spec-pill">
                  <Users size={13} /> 4-8 Players
                </span>
                <span className="spec-pill">
                  <Clock size={13} /> ~30 Min
                </span>
              </div>

              <div className="game-card-actions">
                <button type="button" className="btn-secondary" disabled>
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Core Pillars Grid */}
      <section className="pillars-section">
        <h2 className="section-title">Built for Modern Game Nights</h2>

        <div className="pillars-grid">
          <div className="pillar-item">
            <div className="pillar-icon-box">
              <Globe size={22} />
            </div>
            <h3 className="pillar-title">Instant Browser Play</h3>
            <p className="pillar-desc">
              No software installations or accounts required to begin. Share a room link or match ID and start playing in seconds.
            </p>
          </div>

          <div className="pillar-item">
            <div className="pillar-icon-box">
              <Smartphone size={22} />
            </div>
            <h3 className="pillar-title">Mobile & Desktop Viewports</h3>
            <p className="pillar-desc">
              Ergonomic thumb-zone focus switches for mobile phones alongside wide side-by-side all-in-one board views on laptops.
            </p>
          </div>

          <div className="pillar-item">
            <div className="pillar-icon-box">
              <Users size={22} />
            </div>
            <h3 className="pillar-title">Pass & Play + Cloud Rooms</h3>
            <p className="pillar-desc">
              Pass a single phone or tablet around the table with zero server connectivity, or connect online across different cities.
            </p>
          </div>

          <div className="pillar-item">
            <div className="pillar-icon-box">
              <Shield size={22} />
            </div>
            <h3 className="pillar-title">Zero-Password Magic Links</h3>
            <p className="pillar-desc">
              Play freely as a Guest, or sign in with a 1-click passwordless Magic Link to save your identity across sessions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
