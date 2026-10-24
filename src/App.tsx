import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { GameTab } from './components/GameTab';
import { LoadingScreen } from './components/LoadingScreen';
import { addLog } from './core/logger';

export const App: React.FC = () => {
  const { initApp, loadStatus } = useAppStore();

  useEffect(() => {
    // Catch global unhandled errors and log to core logger
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

  return (
    <main className="app-container" style={{ paddingBottom: '40px' }}>
      {/* Loading screen while initial offline data loads */}
      {loadStatus !== 'ready' && <LoadingScreen />}

      {/* Game: 3 Bức Thư Mật */}
      {loadStatus === 'ready' && <GameTab />}
    </main>
  );
};

export default App;
