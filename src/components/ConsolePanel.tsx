import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Trash2, Terminal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { LogLevel, LogSource } from '../core/types';
import { exportLogsAsText } from '../core/logger';

export const ConsolePanel: React.FC = () => {
  const {
    consoleVisible,
    consoleHeight,
    toggleConsole,
    setConsoleHeight,
    logs,
    logFilter,
    setLogFilter,
    clearConsoleLogs,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHRef = useRef(0);

  // Auto-scroll to bottom unless user scrolled up
  useEffect(() => {
    if (consoleVisible && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs.length, consoleVisible]);

  // Global shortcut: Ctrl + `
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleConsole();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleConsole]);

  // Drag resizer handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHRef.current = consoleHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = startYRef.current - moveEvent.clientY;
      setConsoleHeight(startHRef.current + deltaY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleCopyLogs = () => {
    const text = exportLogsAsText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter logs
  const filteredLogs = logs.filter((l) => {
    if (logFilter.level !== 'ALL' && l.level !== logFilter.level) return false;
    if (logFilter.source !== 'ALL' && l.source !== logFilter.source) return false;
    return true;
  });

  return (
    <div
      className="console-panel"
      style={{
        height: consoleVisible ? `${consoleHeight}px` : '36px',
        transition: isDraggingRef.current ? 'none' : 'height 0.15s ease',
      }}
      role="region"
      aria-label="Console log panel"
    >
      {/* Resizer handle */}
      {consoleVisible && (
        <div className="console-resizer" onMouseDown={handleMouseDown} title="Kéo để đổi chiều cao" />
      )}

      {/* Header bar */}
      <div className="console-header">
        <div className="console-title-row">
          <div className="console-title" onClick={toggleConsole} title="Bấm để bật/tắt (hoặc phím Ctrl+`)">
            <Terminal size={14} />
            <span>Console</span>
            {consoleVisible ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
          <span className="console-count">
            {filteredLogs.length} dòng {logs.length !== filteredLogs.length && `(tổng ${logs.length})`}
          </span>
        </div>

        {consoleVisible && (
          <div className="console-actions">
            {/* Level filter */}
            <select
              className="console-select"
              value={logFilter.level}
              onChange={(e) =>
                setLogFilter({ ...logFilter, level: e.target.value as LogLevel | 'ALL' })
              }
              aria-label="Lọc theo cấp độ log"
            >
              <option value="ALL">Mọi cấp độ</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="DEBUG">DEBUG</option>
            </select>

            {/* Source filter */}
            <select
              className="console-select"
              value={logFilter.source}
              onChange={(e) =>
                setLogFilter({ ...logFilter, source: e.target.value as LogSource | 'ALL' })
              }
              aria-label="Lọc theo nguồn log"
            >
              <option value="ALL">Mọi nguồn</option>
              <option value="UI">UI</option>
              <option value="Loader">Loader</option>
              <option value="Worker">Worker</option>
              <option value="Search">Search</option>
              <option value="Model">Model</option>
              <option value="Calib">Calib</option>
            </select>

            {/* Copy button */}
            <button className="btn-console" onClick={handleCopyLogs} title="Sao chép toàn bộ log">
              <Copy size={12} />
              <span>{copied ? 'Đã sao chép!' : 'Copy'}</span>
            </button>

            {/* Clear button */}
            <button className="btn-console" onClick={clearConsoleLogs} title="Xóa màn hình log">
              <Trash2 size={12} />
              <span>Xóa</span>
            </button>
          </div>
        )}
      </div>

      {/* Log Entries List */}
      {consoleVisible && (
        <div ref={logsContainerRef} className="console-logs-list" role="log">
          {filteredLogs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: '8px 0' }}>
              Chưa có thông điệp log nào...
            </div>
          ) : (
            filteredLogs.map((l) => (
              <div key={l.id} className="log-line">
                <span className="log-time">{l.timestamp}</span>
                <span className={`log-lvl-${l.level}`}>{l.level.padEnd(5)}</span>
                <span className="log-source">[{l.source}]</span>
                <span className="log-msg">{l.message}</span>
                {l.durationMs !== undefined && (
                  <span className="log-dur">+{l.durationMs}ms</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
