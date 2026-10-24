import type { LogEntry, LogLevel, LogSource } from './types';

const MAX_LOGS = 1000;
let logBuffer: LogEntry[] = [];
let listeners: Array<(entry: LogEntry) => void> = [];

function formatTimestamp(date: Date): string {
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const sss = pad(date.getMilliseconds(), 3);
  return `${hh}:${mm}:${ss}.${sss}`;
}

let counter = 0;

export function addLog(
  level: LogLevel,
  source: LogSource,
  message: string,
  durationMs?: number
): LogEntry {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${++counter}`,
    timestamp: formatTimestamp(new Date()),
    level,
    source,
    message,
    durationMs,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Notify listeners
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch (e) {
      console.error('Logger listener error:', e);
    }
  }

  // Also print to browser console with styling
  const style = level === 'ERROR' ? 'color: #ff5555' :
                level === 'WARN' ? 'color: #ffb86c' :
                level === 'DEBUG' ? 'color: #6272a4' : 'color: #8be9fd';
  console.log(`%c[${entry.timestamp}] [${level}] [${source}] ${message}${durationMs !== undefined ? ` (+${durationMs}ms)` : ''}`, style);

  return entry;
}

export function getLogs(): LogEntry[] {
  return [...logBuffer];
}

export function clearLogs(): void {
  logBuffer = [];
}

export function onLog(callback: (entry: LogEntry) => void): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

export function exportLogsAsText(): string {
  return logBuffer
    .map(
      (l) =>
        `${l.timestamp} · ${l.level.padEnd(5)} · [${l.source.padEnd(6)}] · ${l.message}${
          l.durationMs !== undefined ? ` (+${l.durationMs}ms)` : ''
        }`
    )
    .join('\n');
}
