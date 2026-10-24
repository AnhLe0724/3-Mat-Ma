import React from 'react';
import { useAppStore } from '../store/useAppStore';

export const ResultSection: React.FC = () => {
  const { results, query, lastSearchDuration, isOOV, searchStatus } = useAppStore();

  if (searchStatus === 'idle' || results.length === 0) {
    return null;
  }

  const heroResult = results[0];
  const secondaryResults = results.slice(1, 5);

  return (
    <div className="results-container" aria-live="polite">
      <div className="results-header-info">
        <div>
          Kết quả liên tưởng cho: <strong style={{ color: '#fff' }}>"{query}"</strong>
          {isOOV && (
            <span style={{ marginLeft: '8px', color: 'var(--color-warn)', fontSize: '11px' }}>
              (Độ tin cậy xấp xỉ)
            </span>
          )}
        </div>
        <div>{lastSearchDuration} ms</div>
      </div>

      {/* Hero Card */}
      <div className="hero-card">
        <div className="hero-label">TỪ LIÊN QUAN NHẤT</div>
        <div className="hero-body">
          <div className="hero-word">{heroResult.word}</div>
          <div className="hero-pct-wrap">
            <div className="hero-pct-ring">{heroResult.similarity}%</div>
            <div className="hero-pct">{heroResult.similarity}%</div>
          </div>
        </div>
      </div>

      {/* 4 Secondary Cards */}
      {secondaryResults.length > 0 && (
        <div className="secondary-grid">
          {secondaryResults.map((item) => (
            <div key={item.word} className="secondary-card">
              <div className="sec-card-header">
                <span className="sec-rank">#{item.rank}</span>
                <span className="sec-pct">{item.similarity}%</span>
              </div>
              <div className="sec-word">{item.word}</div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(5, item.similarity))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
        * % tương đồng đã hiệu chỉnh theo cảm nhận người dùng; không phải xác suất tuyệt đối.
      </div>
    </div>
  );
};
