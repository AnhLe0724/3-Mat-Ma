import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Compass, KeyRound } from 'lucide-react';

export const NavigationTabs: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <nav className="nav-tabs-container">
      <div className="nav-tabs-list">
        <button
          type="button"
          className={`nav-tab-button ${activeTab === 'game' ? 'active' : ''}`}
          onClick={() => setActiveTab('game')}
          id="tab-game"
        >
          <span className="tab-icon-wrapper">
            <KeyRound size={18} className="tab-icon" />
          </span>
          <span className="tab-title">3 Bức Thư Mật</span>
          <span className="tab-badge game-badge">GAME HOT</span>
        </button>

        <button
          type="button"
          className={`nav-tab-button ${activeTab === 'dev' ? 'active' : ''}`}
          onClick={() => setActiveTab('dev')}
          id="tab-dev"
        >
          <span className="tab-icon-wrapper">
            <Compass size={18} className="tab-icon" />
          </span>
          <span className="tab-title">Tra Cứu Tương Đồng</span>
          <span className="tab-badge dev-badge">DEV MODE</span>
        </button>
      </div>
    </nav>
  );
};
