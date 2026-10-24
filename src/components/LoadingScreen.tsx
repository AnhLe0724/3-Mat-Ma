import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const LoadingScreen: React.FC = () => {
  const { loadProgress, loadStatus, errorMessage } = useAppStore();

  if (loadStatus === 'error') {
    return (
      <div className="loading-box" style={{ borderColor: 'var(--color-error)' }}>
        <div className="loading-step-title" style={{ color: 'var(--color-error)' }}>
          Lỗi tải dữ liệu Offline
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
          {errorMessage || 'Không thể đọc các file trong public/data/.'}
        </p>
        <button
          className="btn-primary"
          style={{ margin: '0 auto' }}
          onClick={() => window.location.reload()}
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  return (
    <div className="loading-box">
      <div className="loading-step-title">
        {loadProgress.step || 'Đang chuẩn bị dữ liệu...'}
      </div>
      <div className="loading-bar-wrap">
        <div
          className="loading-bar-inner"
          style={{ width: `${Math.min(100, Math.max(5, loadProgress.progress))}%` }}
        />
      </div>
      <div className="loading-pct">{loadProgress.progress}% hoàn tất</div>
    </div>
  );
};
