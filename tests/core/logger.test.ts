import { describe, it, expect, beforeEach } from 'vitest';
import { addLog, clearLogs, exportLogsAsText, getLogs, onLog } from '../../src/core/logger';

describe('Logger Module', () => {
  beforeEach(() => {
    clearLogs();
  });

  it('formats timestamp as HH:mm:ss.SSS', () => {
    const entry = addLog('INFO', 'UI', 'Test message');
    expect(entry.timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    expect(entry.level).toBe('INFO');
    expect(entry.source).toBe('UI');
    expect(entry.message).toBe('Test message');
  });

  it('subscribes to log events', () => {
    let received: any = null;
    const unsub = onLog((entry) => {
      received = entry;
    });

    addLog('WARN', 'Search', 'Warning occurred');
    expect(received).not.toBeNull();
    expect(received.message).toBe('Warning occurred');

    unsub();
  });

  it('caps buffer at 1000 entries', () => {
    for (let i = 0; i < 1050; i++) {
      addLog('DEBUG', 'Worker', `Log entry #${i}`);
    }
    const logs = getLogs();
    expect(logs.length).toBe(1000);
    expect(logs[0].message).toBe('Log entry #50');
    expect(logs[999].message).toBe('Log entry #1049');
  });

  it('exports logs as text', () => {
    addLog('INFO', 'UI', 'First line');
    addLog('ERROR', 'Loader', 'Error line', 45);

    const text = exportLogsAsText();
    expect(text).toContain('First line');
    expect(text).toContain('Error line');
    expect(text).toContain('(+45ms)');
  });
});
