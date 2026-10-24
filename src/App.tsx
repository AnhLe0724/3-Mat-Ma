import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { SearchCard } from './components/SearchCard';
import { ResultSection } from './components/ResultSection';
import { NavigationTabs } from './components/NavigationTabs';
import { GameTab } from './components/GameTab';
import { ConsolePanel } from './components/ConsolePanel';
import { LoadingScreen } from './components/LoadingScreen';
import { addLog } from './core/logger';
import { Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const { initApp, loadStatus, activeTab, consoleVisible, consoleHeight } = useAppStore();

  useEffect(() => {
    // Catch global unhandled errors and log to console
    const errorHandler = (event: ErrorEvent) => {
      addLog('ERROR', 'UI', `Uncaught: ${event.message} (${event.filename}:${event.lineno})`);
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      addLog('ERROR', 'UI', `Unhandled Promise Rejection: ${event.reason}`);
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    initApp();

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [initApp]);

  const bottomPadding = consoleVisible ? consoleHeight + 20 : 50;

  return (
    <>
      <main className="app-container" style={{ paddingBottom: `${bottomPadding}px` }}>
        {/* App Header */}
        <header className="app-header">
          <h1 className="app-title">
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
            <span>Từ Liên Tưởng</span>
            <span className="app-badge">Offline Local</span>
          </h1>
          <p className="app-subtitle">
            Mô phỏng mạng lưới liên tưởng ngữ nghĩa tiếng Việt — hoàn toàn local, không gọi API ngoài
          </p>
        </header>

        {/* Loading screen while initial offline data loads */}
        {loadStatus !== 'ready' && <LoadingScreen />}

        {/* Navigation Tabs (Game vs Dev Mode) */}
        {loadStatus === 'ready' && <NavigationTabs />}

        {/* Tab 1: Game - 3 Bức Thư Mật */}
        {loadStatus === 'ready' && activeTab === 'game' && <GameTab />}

        {/* Tab 2: Tra cứu tương đồng (Dev Mode) */}
        {loadStatus === 'ready' && activeTab === 'dev' && (
          <>
            <SearchCard />
            <ResultSection />
          </>
        )}
      </main>

      {/* Persistent Bottom Console Panel */}
      <ConsolePanel />
    </>
  );
};

export default App;
