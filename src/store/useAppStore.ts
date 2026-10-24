import { create } from 'zustand';
import type { CourierDeduction, GameEvaluationResult, LogEntry, LogLevel, LogSource, SearchResult, WorkerResponse } from '../core/types';
import type { GameMission } from '../core/gameEngine';
import { PRESET_MISSIONS } from '../core/gameEngine';
import { addLog, clearLogs as clearCoreLogs, onLog } from '../core/logger';
import { cleanQuery } from '../core/normalize';

interface AppState {
  // Navigation
  activeTab: 'dev' | 'game';
  setActiveTab: (tab: 'dev' | 'game') => void;

  // Worker & Loader
  worker: Worker | null;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  loadProgress: { step: string; progress: number };
  nWords: number;

  // Search (Dev Mode)
  searchStatus: 'idle' | 'searching' | 'done' | 'error';
  query: string;
  results: SearchResult[];
  lastSearchDuration: number;
  isOOV: boolean;
  errorMessage: string | null;

  // Game: 3 Bức Thư Mật
  gameMission: GameMission;
  clues: [string, string, string];
  gameStatus: 'idle' | 'evaluating' | 'evaluated' | 'error';
  gameStep: 1 | 2 | 3 | 'finished';
  evaluatingCourierIndex: number | null;
  courierDeductions: [CourierDeduction | null, CourierDeduction | null, CourierDeduction | null];
  gameResult: GameEvaluationResult | null;
  gameErrorMessage: string | null;

  // Console Panel
  consoleVisible: boolean;
  consoleHeight: number;
  logs: LogEntry[];
  logFilter: { level: LogLevel | 'ALL'; source: LogSource | 'ALL' };

  // Actions
  initApp: () => void;
  setQuery: (q: string) => void;
  performSearch: (targetWord?: string) => void;
  toggleConsole: () => void;
  setConsoleHeight: (height: number) => void;
  setLogFilter: (filter: { level: LogLevel | 'ALL'; source: LogSource | 'ALL' }) => void;
  clearConsoleLogs: () => void;

  // Game Actions
  setClue: (index: 0 | 1 | 2, text: string) => void;
  selectMission: (mission: GameMission) => void;
  setCustomMission: (secretWord: string) => void;
  submitCourierClue: (index: 0 | 1 | 2) => void;
  submitLetters: () => void;
  resetGameClues: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'game', // Default directly to the game tab for exciting user experience!

  worker: null,
  loadStatus: 'idle',
  loadProgress: { step: 'Đang chuẩn bị...', progress: 0 },
  nWords: 0,

  searchStatus: 'idle',
  query: '',
  results: [],
  lastSearchDuration: 0,
  isOOV: false,
  errorMessage: null,

  // Game initial state
  gameMission: PRESET_MISSIONS[0], // "cà phê"
  clues: ['', '', ''],
  gameStatus: 'idle',
  gameStep: 1,
  evaluatingCourierIndex: null,
  courierDeductions: [null, null, null],
  gameResult: null,
  gameErrorMessage: null,

  consoleVisible: true,
  consoleHeight: 220,
  logs: [],
  logFilter: { level: 'ALL', source: 'ALL' },

  setActiveTab: (tab: 'dev' | 'game') => {
    set({ activeTab: tab });
    addLog('INFO', 'UI', `Chuyển tab sang: ${tab === 'dev' ? 'Tra Cứu Từ Tương Quan (Dev Mode)' : 'Game: 3 Bức Thư Mật'}`);
  },

  initApp: () => {
    if (get().worker) return;

    addLog('INFO', 'UI', 'Khởi tạo ứng dụng Web Từ Liên Tưởng');
    set({ loadStatus: 'loading' });

    // Listen to logger events
    onLog((entry) => {
      set((state) => {
        const updated = [...state.logs, entry];
        if (updated.length > 1000) updated.shift();
        return { logs: updated };
      });
    });

    try {
      // Instantiate Web Worker with Vite format
      const worker = new Worker(
        new URL('../worker/search.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'LOAD_PROGRESS') {
          set({ loadProgress: msg.progress });
        } else if (msg.type === 'LOAD_SUCCESS') {
          set({ loadStatus: 'ready', nWords: msg.nWords });
          addLog('INFO', 'UI', `Đã sẵn sàng! Kho từ gồm ${msg.nWords.toLocaleString()} từ`);
        } else if (msg.type === 'LOAD_ERROR') {
          set({ loadStatus: 'error', errorMessage: msg.error });
          addLog('ERROR', 'UI', `Lỗi tải dữ liệu: ${msg.error}`);
        } else if (msg.type === 'QUERY_SUCCESS') {
          set({
            searchStatus: 'done',
            results: msg.results,
            lastSearchDuration: msg.durationMs,
            isOOV: msg.isOOV,
          });
        } else if (msg.type === 'QUERY_ERROR') {
          set({
            searchStatus: 'error',
            errorMessage: msg.error,
          });
          addLog('ERROR', 'Search', `Lỗi tìm kiếm: ${msg.error}`);
        } else if (msg.type === 'COURIER_EVALUATION_SUCCESS') {
          const d = msg.deduction;
          const idx = d.courierIndex - 1; // 0, 1, 2
          const currentDeductions = [...get().courierDeductions] as [CourierDeduction | null, CourierDeduction | null, CourierDeduction | null];
          currentDeductions[idx] = d;

          if (d.leaked) {
            // Courier leaked the secret word! Immediate defeat!
            const secret = get().gameMission.secretWord;
            const result: GameEvaluationResult = {
              secretWord: secret,
              firstLetter: get().gameMission.firstLetter,
              couriers: [
                currentDeductions[0] || d,
                currentDeductions[1] || d,
                currentDeductions[2] || d,
              ],
              friend: {
                clues: get().clues,
                inferredWords: [],
                success: false,
              },
              isVictory: false,
              reason: `💥 KÉT SẮT BỊ CƯỚP! Người giao thư ${d.courierIndex} đã đoán trúng ngay từ khóa bí mật "${secret}" từ bức thư này!`,
            };

            set({
              courierDeductions: currentDeductions,
              evaluatingCourierIndex: null,
              gameStatus: 'evaluated',
              gameStep: 'finished',
              gameResult: result,
              gameErrorMessage: null,
            });
            addLog('WARN', 'UI', `💥 [GAME] Thất bại! Người giao thư ${d.courierIndex} đã giải mã được từ khóa bí mật!`);
          } else {
            // Courier is safe!
            const nextStep = (idx + 2) as 2 | 3;
            if (idx < 2) {
              set({
                courierDeductions: currentDeductions,
                evaluatingCourierIndex: null,
                gameStep: nextStep,
                gameErrorMessage: null,
              });
              addLog('INFO', 'UI', `🛡️ Người giao thư ${d.courierIndex} an toàn (đoán là: "${d.inferredWords[0]?.word || ''}")! Mở khóa Bức thư #${nextStep}`);
            } else {
              // Courier 3 is safe! All 3 couriers safe!
              set({
                courierDeductions: currentDeductions,
                evaluatingCourierIndex: null,
                gameStatus: 'evaluating',
                gameErrorMessage: null,
              });
              addLog('INFO', 'UI', `🛡️ Cả 3 người giao thư đều an toàn! Đang chuyển cho Người Bạn Phương Xa giải mã...`);

              const { worker, gameMission, clues } = get();
              worker?.postMessage({
                type: 'EVALUATE_FRIEND',
                firstLetter: gameMission.firstLetter,
                clues,
                secretWord: gameMission.secretWord,
              });
            }
          }
        } else if (msg.type === 'FRIEND_EVALUATION_SUCCESS') {
          const friendDed = msg.deduction;
          const { gameMission, courierDeductions } = get();
          const cList = courierDeductions as [CourierDeduction, CourierDeduction, CourierDeduction];
          const isVictory = friendDed.success;

          const topFriendGuess = friendDed.inferredWords.length > 0 ? friendDed.inferredWords[0].word : 'không rõ';
          const reason = isVictory
            ? `🎉 CHIẾN THẮNG HUY HOÀNG! Cả 3 người giao thư đều bị đánh lừa an toàn, và Người Bạn Phương Xa đã kết hợp xuất sắc cả 3 bức thư để đoán đúng "${gameMission.secretWord}"!`
            : `💥 THẤT BẠI! Cả 3 người giao thư đều an toàn, nhưng người bạn phương xa đoán nhầm thành "${topFriendGuess}" thay vì "${gameMission.secretWord}".`;

          const result: GameEvaluationResult = {
            secretWord: gameMission.secretWord,
            firstLetter: gameMission.firstLetter,
            couriers: cList,
            friend: friendDed,
            isVictory,
            reason,
          };

          set({
            gameStatus: 'evaluated',
            gameStep: 'finished',
            gameResult: result,
            gameErrorMessage: null,
          });

          addLog(
            isVictory ? 'INFO' : 'WARN',
            'UI',
            isVictory
              ? `🎉 [GAME] Chúc mừng! Mở kho báu thành công!`
              : `💥 [GAME] Thất bại! Người bạn đoán nhầm thành "${topFriendGuess}".`
          );
        } else if (msg.type === 'GAME_EVALUATION_SUCCESS') {
          set({
            gameStatus: 'evaluated',
            gameStep: 'finished',
            gameResult: msg.result,
            gameErrorMessage: null,
          });
          addLog(
            msg.result.isVictory ? 'INFO' : 'WARN',
            'UI',
            msg.result.isVictory
              ? '🎉 [GAME] Chúc mừng! Mở kho báu thành công!'
              : '💥 [GAME] Thất bại! Két sắt bị lộ hoặc người bạn không đoán ra.'
          );
        } else if (msg.type === 'GAME_EVALUATION_ERROR') {
          set({
            gameStatus: 'error',
            evaluatingCourierIndex: null,
            gameErrorMessage: msg.error,
          });
          addLog('ERROR', 'Worker', `Lỗi thẩm vấn game: ${msg.error}`);
        } else if (msg.type === 'LOG') {
          set((state) => {
            const updated = [...state.logs, msg.entry];
            if (updated.length > 1000) updated.shift();
            return { logs: updated };
          });
        }
      };

      worker.onerror = (err) => {
        addLog('ERROR', 'Worker', `Web Worker gặp sự cố: ${err.message}`);
        set({ loadStatus: 'error', errorMessage: err.message });
      };

      set({ worker });

      // Trigger data loading
      worker.postMessage({ type: 'LOAD', dataDir: '' });
    } catch (err: any) {
      addLog('ERROR', 'UI', `Không thể tạo Web Worker: ${err.message}`);
      set({ loadStatus: 'error', errorMessage: err.message });
    }
  },

  setQuery: (q: string) => set({ query: q }),

  performSearch: (targetWord?: string) => {
    const word = (targetWord ?? get().query).trim();
    if (!word) {
      addLog('WARN', 'UI', 'Từ khóa nhập vào rỗng');
      return;
    }

    const { worker, loadStatus } = get();
    if (loadStatus !== 'ready' || !worker) {
      addLog('WARN', 'UI', 'Dữ liệu chưa tải xong, xin vui lòng đợi');
      return;
    }

    addLog('INFO', 'UI', `Click "Tìm từ tương đồng": "${word}"`);
    set({ searchStatus: 'searching', errorMessage: null });

    worker.postMessage({
      type: 'QUERY',
      word,
    });
  },

  // Game actions
  setClue: (index: 0 | 1 | 2, text: string) => {
    set((state) => {
      const updated = [...state.clues] as [string, string, string];
      updated[index] = text;
      return { clues: updated };
    });
  },

  selectMission: (mission: GameMission) => {
    set({
      gameMission: mission,
      clues: ['', '', ''],
      gameStatus: 'idle',
      gameStep: 1,
      evaluatingCourierIndex: null,
      courierDeductions: [null, null, null],
      gameResult: null,
      gameErrorMessage: null,
    });
    addLog('INFO', 'UI', `Chọn nhiệm vụ mới: "${mission.secretWord}" (Chữ cái đầu: "${mission.firstLetter}")`);
  },

  setCustomMission: (secretWordRaw: string) => {
    const secretWord = cleanQuery(secretWordRaw);
    if (!secretWord) return;

    // Automatically extract first letter
    const firstLetter = secretWord.trim().charAt(0).toUpperCase();

    const customMission: GameMission = {
      id: `custom-${Date.now()}`,
      secretWord,
      firstLetter,
      category: 'Tự chọn',
      hint: 'Nhiệm vụ do chính người chơi thiết lập thử thách!',
      difficulty: 'Trung bình',
    };

    set({
      gameMission: customMission,
      clues: ['', '', ''],
      gameStatus: 'idle',
      gameStep: 1,
      evaluatingCourierIndex: null,
      courierDeductions: [null, null, null],
      gameResult: null,
      gameErrorMessage: null,
    });
    addLog('INFO', 'UI', `Tạo nhiệm vụ tùy chỉnh: "${secretWord}" (Chữ cái đầu: "${firstLetter}")`);
  },

  submitCourierClue: (index: 0 | 1 | 2) => {
    const { clues, gameMission, worker, loadStatus, evaluatingCourierIndex } = get();

    if (loadStatus !== 'ready' || !worker) {
      addLog('WARN', 'UI', 'Dữ liệu chưa tải xong, xin vui lòng đợi');
      return;
    }
    if (evaluatingCourierIndex !== null) return;

    const clue = clues[index].trim();
    if (!clue) {
      addLog('WARN', 'UI', `Vui lòng nhập manh mối cho Bức thư #${index + 1} trước khi gửi!`);
      set({ gameErrorMessage: `Vui lòng nhập manh mối cho Bức thư #${index + 1} trước khi gửi!` });
      return;
    }

    addLog('INFO', 'UI', `Gửi Bức thư #${index + 1} (manh mối: "${clue}")`);
    set({ evaluatingCourierIndex: index, gameErrorMessage: null });

    worker.postMessage({
      type: 'EVALUATE_COURIER',
      courierIndex: index + 1,
      clue,
      firstLetter: gameMission.firstLetter,
      secretWord: gameMission.secretWord,
    });
  },

  submitLetters: () => {
    const { clues, gameMission, worker, loadStatus } = get();

    if (loadStatus !== 'ready' || !worker) {
      addLog('WARN', 'UI', 'Dữ liệu chưa tải xong, xin vui lòng đợi');
      return;
    }

    const c1 = clues[0].trim();
    const c2 = clues[1].trim();
    const c3 = clues[2].trim();

    if (!c1 || !c2 || !c3) {
      addLog('WARN', 'UI', 'Bạn cần điền đủ cả 3 manh mối cho 3 bức thư!');
      set({ gameErrorMessage: 'Vui lòng nhập đầy đủ manh mối cho cả 3 bức thư trước khi gửi!' });
      return;
    }

    addLog('INFO', 'UI', `Bắt đầu gửi 3 bức thư: [1: "${c1}", 2: "${c2}", 3: "${c3}"]`);
    set({ gameStatus: 'evaluating', gameErrorMessage: null });

    worker.postMessage({
      type: 'EVALUATE_GAME',
      secretWord: gameMission.secretWord,
      firstLetter: gameMission.firstLetter,
      clues: [c1, c2, c3],
    });
  },

  resetGameClues: () => {
    set({
      clues: ['', '', ''],
      gameStatus: 'idle',
      gameStep: 1,
      evaluatingCourierIndex: null,
      courierDeductions: [null, null, null],
      gameResult: null,
      gameErrorMessage: null,
    });
    addLog('INFO', 'UI', 'Làm mới toàn bộ 3 bức thư để thử lại');
  },

  toggleConsole: () => {
    set((state) => {
      const next = !state.consoleVisible;
      addLog('INFO', 'UI', `${next ? 'Mở' : 'Thu gọn'} panel console`);
      return { consoleVisible: next };
    });
  },

  setConsoleHeight: (h: number) => {
    set({ consoleHeight: Math.max(120, Math.min(500, h)) });
  },

  setLogFilter: (filter) => set({ logFilter: filter }),

  clearConsoleLogs: () => {
    clearCoreLogs();
    set({ logs: [] });
    addLog('INFO', 'UI', 'Đã xóa toàn bộ log trong console');
  },
}));
