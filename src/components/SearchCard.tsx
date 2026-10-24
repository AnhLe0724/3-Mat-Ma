import React, { useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const SearchCard: React.FC = () => {
  const { query, setQuery, performSearch, loadStatus, searchStatus } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loadStatus === 'ready') {
      inputRef.current?.focus();
    }
  }, [loadStatus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const isReady = loadStatus === 'ready';
  const isSearching = searchStatus === 'searching';

  return (
    <div className="search-card">
      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} />
        <input
          ref={inputRef}
          type="text"
          id="association-input"
          className="search-input"
          placeholder={isReady ? 'Nhập một từ tiếng Việt (ví dụ: chó, biển, học sinh, cà phê...)' : 'Đang nạp model...'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isReady || isSearching}
          autoComplete="off"
          spellCheck={false}
          aria-label="Nhập một từ để tìm liên tưởng"
        />
      </div>

      <div className="search-btn-row">
        <button
          id="btn-search"
          className="btn-primary"
          onClick={() => performSearch()}
          disabled={!isReady || isSearching || !query.trim()}
          aria-busy={isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Đang tính toán...</span>
            </>
          ) : (
            <span>Tìm từ tương đồng</span>
          )}
        </button>
      </div>
    </div>
  );
};
