export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogSource = 'UI' | 'Loader' | 'Worker' | 'Model' | 'Search' | 'Calib';

export interface LogEntry {
  id: string;
  timestamp: string;  // HH:mm:ss.SSS
  level: LogLevel;
  source: LogSource;
  message: string;
  durationMs?: number;
}

export interface VocabItem {
  w: string;
  freq: number;
  hasAssoc?: boolean;
  hasVisim?: boolean;
}

export interface SearchResult {
  rank: number;
  word: string;
  similarity: number;  // Calibrated [0 - 100]%
  rawScore: number;    // Raw cosine / CSLS / fusion score
  probability: number; // Softmax probability on top candidates
  isApprox?: boolean;
}

export interface RankingConfig {
  alpha: number;       // Weight for static embedding (e.g. 0.6)
  beta: number;        // Weight for sentence embedding (e.g. 0.3)
  gamma: number;       // Frequency prior weight (e.g. 0.1)
  delta: number;       // Penalty for approx / compound vector (e.g. 0.05)
  temperature: number; // Temperature T for softmax probability (e.g. 0.8)
  useCSLS: boolean;    // Enable CSLS hubness correction
  kNeighbors: number;  // k for CSLS
}

export interface CalibrationPoint {
  raw: number;
  calibrated: number;
}

export interface WorkerLoadProgress {
  step: string;
  progress: number; // 0 - 100
  detail?: string;
}

export interface CourierDeduction {
  courierIndex: number; // 1, 2, 3
  clue: string;
  inferredWords: SearchResult[];
  leaked: boolean; // True if secret word was guessed by this courier
  targetRank?: number; // Rank if found in candidates
}

export interface FriendDeduction {
  clues: [string, string, string];
  inferredWords: SearchResult[];
  success: boolean; // True if secret word was successfully inferred
  targetRank?: number;
}

export interface GameEvaluationResult {
  secretWord: string;
  firstLetter: string;
  couriers: [CourierDeduction, CourierDeduction, CourierDeduction];
  friend: FriendDeduction;
  isVictory: boolean;
  reason: string;
}

export type WorkerRequest =
  | { type: 'LOAD'; dataDir: string }
  | { type: 'QUERY'; word: string; config?: Partial<RankingConfig> }
  | {
      type: 'EVALUATE_COURIER';
      courierIndex: number;
      clue: string;
      firstLetter: string;
      secretWord: string;
    }
  | {
      type: 'EVALUATE_FRIEND';
      firstLetter: string;
      clues: [string, string, string];
      secretWord: string;
    }
  | {
      type: 'EVALUATE_GAME';
      secretWord: string;
      firstLetter: string;
      clues: [string, string, string];
    };

export type WorkerResponse =
  | { type: 'LOAD_PROGRESS'; progress: WorkerLoadProgress }
  | { type: 'LOAD_SUCCESS'; nWords: number }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'QUERY_SUCCESS'; query: string; results: SearchResult[]; durationMs: number; isOOV: boolean }
  | { type: 'QUERY_ERROR'; query: string; error: string }
  | { type: 'COURIER_EVALUATION_SUCCESS'; deduction: CourierDeduction }
  | { type: 'FRIEND_EVALUATION_SUCCESS'; deduction: FriendDeduction }
  | { type: 'GAME_EVALUATION_SUCCESS'; result: GameEvaluationResult }
  | { type: 'GAME_EVALUATION_ERROR'; error: string }
  | { type: 'LOG'; entry: LogEntry };
