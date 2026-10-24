import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { PRESET_MISSIONS, type GameMission } from '../core/gameEngine';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Dice5,
  Eye,
  EyeOff,
  HelpCircle,
  Home,
  Lock,
  Mail,
  Play,
  Plus,
  RefreshCw,
  Scroll,
  Send,
  ShieldAlert,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

export const GameTab: React.FC = () => {
  const {
    gameMission,
    clues,
    gameStatus,
    gameStep,
    evaluatingCourierIndex,
    courierDeductions,
    gameResult,
    gameErrorMessage,
    setClue,
    selectMission,
    setCustomMission,
    submitCourierClue,
    loadStatus,
  } = useAppStore();

  const [gamePhase, setGamePhase] = useState<'start' | 'story' | 'cutscene' | 'playing'>('start');
  const [reelWord, setReelWord] = useState<string>('???');
  const [isReelLocked, setIsReelLocked] = useState<boolean>(false);
  const [lockedMission, setLockedMission] = useState<GameMission | null>(null);

  const [showSecret, setShowSecret] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [customWordInput, setCustomWordInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);

  const reelWordsPool = [
    'kim cương', 'tàu ngầm', 'hoa hồng', 'mặt trời', 'bác sĩ',
    'ngân hàng', 'sư tử', 'vương miện', 'bánh mì', 'ngọn hải đăng',
    'bình minh', 'đồng hồ', 'kho báu', 'cà phê', 'núi lửa',
    'phi thuyền', 'hải âu', 'thám tử', 'rừng rậm', 'kính thiên văn'
  ];

  const startRandomWordCutscene = () => {
    const available = PRESET_MISSIONS.filter((m) => m.id !== gameMission.id);
    const target = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : PRESET_MISSIONS[Math.floor(Math.random() * PRESET_MISSIONS.length)];

    setGamePhase('cutscene');
    setIsReelLocked(false);
    setLockedMission(null);

    let counter = 0;
    const fastInterval = setInterval(() => {
      counter++;
      const randomDisplayWord = reelWordsPool[Math.floor(Math.random() * reelWordsPool.length)];
      setReelWord(randomDisplayWord);

      if (counter >= 16) {
        clearInterval(fastInterval);

        setTimeout(() => {
          setReelWord(reelWordsPool[Math.floor(Math.random() * reelWordsPool.length)]);
        }, 120);

        setTimeout(() => {
          setReelWord(reelWordsPool[Math.floor(Math.random() * reelWordsPool.length)]);
        }, 260);

        setTimeout(() => {
          setReelWord(target.secretWord);
          setIsReelLocked(true);
          setLockedMission(target);
          selectMission(target);

          setTimeout(() => {
            setGamePhase('playing');
          }, 1500);
        }, 460);
      }
    }, 65);
  };

  const handleRandomMission = () => {
    startRandomWordCutscene();
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWordInput.trim()) return;
    setCustomMission(customWordInput.trim());
    setCustomWordInput('');
    setShowCustomModal(false);
    setGamePhase('playing');
  };

  const isEvaluating = gameStatus === 'evaluating';
  const stepNum = gameStep === 'finished' ? 4 : gameStep;

  return (
    <div className="game-screen-wrapper">
      {/* Decorative Game Pattern Background Elements */}
      <div className="game-bg-cross cross-1">✕ ✕ ✕</div>
      <div className="game-bg-cross cross-2">✕ ✕ ✕</div>
      <div className="game-bg-circle circle-1" />
      <div className="game-bg-circle circle-2" />

      {/* Big Chunky 3D Title Section */}
      <div className="game-hero-header">
        <h2 className="game-chunky-title">
          <span className="title-top">3 BỨC THƯ</span>
          <span className="title-bottom">MẬT MÃ</span>
        </h2>
        <p className="game-hero-subtitle">
          Giao thư qua 3 gián điệp — Đánh lừa kẻ địch để bạn hiền mở kho báu!
        </p>
      </div>

      {/* 1. START SCREEN */}
      {gamePhase === 'start' && (
        <div className="game-start-view">
          <div className="start-hero-card">
            <div className="start-badge-pill">
              <Sparkles size={14} />
              <span>Thử Thách Trí Tuệ Liên Tưởng</span>
            </div>

            <h3 className="start-main-headline">
              Giao 3 Bức Thư Qua 3 Tuyến Đường<br />
              <span>Đánh Lừa Gián Điệp — Mở Khóa Kho Báu!</span>
            </h3>

            <p className="start-tagline">
              Mỗi người giao thư chỉ biết đúng chữ cái đầu tiên của mật mã bí mật. Hãy soạn 3 bức thư thật tinh tế để kẻ địch đoán sai nhưng bạn tri kỷ gom lại đoán đúng!
            </p>

            {/* 3 Roles Spotlight Cards */}
            <div className="start-roles-grid">
              <div className="start-role-col">
                <div className="role-icon-box courier-bg">🕵️</div>
                <span className="role-title">3 Gián Điệp Giao Thư</span>
                <span className="role-desc">Mỗi người chỉ nhận 1 thư. Họ đoán trúng két là bạn thua!</span>
              </div>

              <div className="start-role-col">
                <div className="role-icon-box vault-bg">💎</div>
                <span className="role-title">Mật Mã Kho Báu</span>
                <span className="role-desc">Từ khóa bí mật ngẫu nhiên trong két sắt an toàn.</span>
              </div>

              <div className="start-role-col">
                <div className="role-icon-box friend-bg">🤝</div>
                <span className="role-title">Người Bạn Tri Kỷ</span>
                <span className="role-desc">Nhận đủ cả 3 thư để liên kết và giải mã chiến thắng!</span>
              </div>
            </div>

            {/* Giant 3D Pulsating Start Button */}
            <button
              type="button"
              className="btn-start-hero"
              onClick={() => setGamePhase('story')}
            >
              <Play size={24} fill="currentColor" />
              <span>BẮT ĐẦU CHƠI</span>
            </button>

            {/* Quick Action Badges on Start Screen */}
            <div className="start-aux-actions">
              <button
                type="button"
                className="game-pill-btn start-aux-btn"
                onClick={startRandomWordCutscene}
              >
                <Zap size={14} color="#000000" />
                <span style={{ color: '#000000' }}>Vào Nhiệm Vụ Ngẫu Nhiên Ngay</span>
              </button>

              <button
                type="button"
                className="game-pill-btn start-aux-btn"
                onClick={() => setGamePhase('story')}
              >
                <BookOpen size={14} color="#000000" />
                <span style={{ color: '#000000' }}>Cốt Truyện & Luật Chơi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. STORY & RULES BRIEFING SCREEN */}
      {gamePhase === 'story' && (
        <div className="game-story-view">
          <div className="story-card-container">
            <div className="story-header-area">
              <div className="story-title-group">
                <BookOpen size={24} color="#7c3aed" />
                <h3>Cốt Truyện & Luật Chơi</h3>
              </div>
              <span className="start-badge-pill">Tập Trận Mật Vụ</span>
            </div>

            {/* Story Lore Box */}
            <div className="story-lore-box">
              <div className="story-lore-header">
                <Scroll size={16} />
                <span>HỒ SƠ BỐI CẢNH TỐI MẬT</span>
              </div>
              <div className="story-lore-content">
                Bạn đang nắm giữ một <strong>mật mã kho báu bí mật</strong>. Nhiệm vụ của bạn là gửi mật mã này tới <strong>Người Bạn Tri Kỷ</strong> ở căn cứ đối diện.
                <br /><br />
                ⚠️ <strong>Cạm bẫy gián điệp:</strong> 3 người giao thư thực chất là <strong>3 gián điệp ngầm</strong>! Họ chỉ biết đúng <strong>chữ cái đầu tiên</strong> của mật mã. Nếu bất kỳ ai trong số họ đoán trúng mật mã ngay khi nhận thư của bạn, thông tin bị đánh cắp và bạn <strong>THUA CUỘC</strong>!
                <br /><br />
                🎯 <strong>Kỳ tích tình bạn:</strong> Người Bạn Tri Kỷ ở đích đến sẽ nhận được đầy đủ cả 3 bức thư. Dù cũng chỉ biết chữ cái đầu, sự liên kết của cả 3 manh mối sẽ giúp bạn mình giải mã thành công!
              </div>
            </div>

            {/* 3 Step Rules List */}
            <div className="story-rules-list">
              <div className="story-rule-item">
                <div className="rule-number-badge">1</div>
                <div className="rule-content">
                  <strong>Soạn Thư Từng Chặng:</strong> Điền 1 từ manh mối (bắt đầu bằng chữ cái quy định) rồi bấm nộp cho từng người giao thư.
                </div>
              </div>

              <div className="story-rule-item">
                <div className="rule-number-badge">2</div>
                <div className="rule-content">
                  <strong>Đánh Lừa Gián Điệp:</strong> Mỗi người giao thư chỉ được đoán 1 lần duy nhất. Nếu họ đoán SAI mật mã, chặng giao thư đó AN TOÀN!
                </div>
              </div>

              <div className="story-rule-item">
                <div className="rule-number-badge">3</div>
                <div className="rule-content">
                  <strong>Mở Khóa Kho Báu:</strong> Khi cả 3 người giao thư đều không đoán được, Người Bạn nhận đủ 3 thư phải ĐOÁN ĐÚNG mật mã để GIÀNH CHIẾN THẮNG!
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="story-actions-row">
              <button
                type="button"
                className="game-btn-ghost-sm"
                onClick={() => setGamePhase('start')}
              >
                Quay Lại
              </button>

              <button
                type="button"
                className="btn-proceed-mission"
                onClick={startRandomWordCutscene}
              >
                <Sparkles size={18} />
                <span>TIẾP TỤC — VÀO NHIỆM VỤ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. RANDOM WORD CUTSCENE (SLOT MACHINE REEL) */}
      {gamePhase === 'cutscene' && (
        <div className="game-cutscene-overlay">
          <div className="cutscene-modal-card">
            <div className="cutscene-top-tag">
              <Shuffle size={14} />
              <span>Hệ Thống Đang Thiết Lập</span>
            </div>

            <h3 className="cutscene-title">
              {isReelLocked ? 'ĐÃ KHÓA MẬT MÃ KHO BÁU!' : 'ĐANG QUAY TỪ KHÓA BÍ MẬT...'}
            </h3>

            <p className="cutscene-sub">
              {isReelLocked
                ? 'Hồ sơ nhiệm vụ đã sẵn sàng. Hãy chuẩn bị 3 bức thư đánh lừa!'
                : 'Đang ngẫu nhiên chọn từ ngữ tiếng Việt kịch tính...'}
            </p>

            {/* Slot Reel Machine Frame */}
            <div className="cutscene-reel-frame">
              <span className="reel-indicator-left">▶</span>
              <div className="reel-slot-center">
                <span
                  className={`reel-spinning-word ${
                    isReelLocked ? 'locked-effect' : 'blur-effect'
                  }`}
                >
                  {reelWord}
                </span>
              </div>
              <span className="reel-indicator-right">◀</span>
            </div>

            {/* Dossier Card when locked */}
            {isReelLocked && lockedMission && (
              <div className="cutscene-revealed-dossier animate-pop-in">
                <div className="dossier-pill-row">
                  <span className="dossier-pill letter-pill">
                    Chữ cái đầu: "{lockedMission.firstLetter}"
                  </span>
                  <span className="dossier-pill cat-pill">
                    Chủ đề: {lockedMission.category}
                  </span>
                </div>
                <p className="dossier-hint-text">
                  "{lockedMission.hint}"
                </p>
              </div>
            )}

            {/* Fast Enter Game Action */}
            <button
              type="button"
              className="btn-enter-game-fast"
              onClick={() => setGamePhase('playing')}
            >
              <span>{isReelLocked ? 'VÀO CHƠI NGAY' : 'BỎ QUA & VÀO CHƠI'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN GAMEPLAY VIEW */}
      {gamePhase === 'playing' && (
        <>
          {/* Quick Action Badges */}
          <div className="game-action-pill-row">
            <button
              type="button"
              className="game-pill-btn"
              onClick={() => setGamePhase('start')}
              title="Về màn hình chính"
            >
              <Home size={14} />
              <span>Trang Chủ</span>
            </button>

            <button
              type="button"
              className="game-pill-btn"
              onClick={handleRandomMission}
              title="Đổi màn ngẫu nhiên"
            >
              <Dice5 size={14} />
              <span>Đổi Nhiệm Vụ</span>
            </button>

            <button
              type="button"
              className="game-pill-btn"
              onClick={() => setShowCustomModal(!showCustomModal)}
              title="Tự nhập từ khóa bí mật"
            >
              <Plus size={14} />
              <span>Tự Tạo Từ Khóa</span>
            </button>

            <button
              type="button"
              className="game-pill-btn"
              onClick={() => setShowRules(!showRules)}
            >
              <HelpCircle size={14} />
              <span>{showRules ? 'Đóng Luật Chơi' : 'Xem Luật Chơi'}</span>
              {showRules ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

      {/* Custom Word Modal Popup */}
      {showCustomModal && (
        <div className="game-popup-overlay">
          <div className="game-popup-card">
            <div className="popup-header">
              <span className="popup-icon">🎁</span>
              <h3 className="popup-title">Tự Tạo Thử Thách Mới</h3>
            </div>
            <p className="popup-desc">
              Nhập từ khóa bí mật tiếng Việt mà bạn muốn bạn của mình giải mã:
            </p>
            <form onSubmit={handleCreateCustom} className="popup-form">
              <input
                type="text"
                placeholder="Ví dụ: hoa sen, tàu hỏa, sư tử, ngọc trai..."
                value={customWordInput}
                onChange={(e) => setCustomWordInput(e.target.value)}
                className="game-input-styled"
                autoFocus
              />
              <div className="popup-actions">
                <button type="submit" className="game-btn-green-sm">
                  Bắt Đầu Chơi
                </button>
                <button
                  type="button"
                  className="game-btn-ghost-sm"
                  onClick={() => setShowCustomModal(false)}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collapsible Rules Modal Box */}
      {showRules && (
        <div className="game-rules-card animate-pop-in">
          <div className="rules-header">
            <span className="rules-icon">📜</span>
            <h4 className="rules-title">Bí Kíp Đánh Lừa Gián Điệp</h4>
          </div>
          <div className="rules-grid">
            <div className="rules-item">
              <span className="item-num">1</span>
              <div>
                <strong>3 Bức Thư Riêng Biệt:</strong> Bạn gửi 3 manh mối cho 3 người giao thư khác nhau.
              </div>
            </div>
            <div className="rules-item">
              <span className="item-num">2</span>
              <div>
                <strong>Chữ Cái Công Khai:</strong> Tất cả người giao thư và người bạn đều biết chữ cái đầu tiên (ví dụ <em>"C"</em>).
              </div>
            </div>
            <div className="rules-item">
              <span className="item-num">3</span>
              <div>
                <strong>Thất Bại Khi Bị Lộ:</strong> Nếu dù chỉ 1 người giao thư đoán trúng ngay ở vị trí #1, két sắt bị cướp!
              </div>
            </div>
            <div className="rules-item">
              <span className="item-num">4</span>
              <div>
                <strong>Chiến Thắng Hoàn Hảo:</strong> 3 người giao thư đều đoán sai, nhưng người bạn gộp cả 3 thư lại thì đoán đúng (Top 1–3)!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Secret Chest Card (White container style from Figma UI kit) */}
      <div className="game-white-card mission-vault-card">
        <div className="vault-top-banner">
          <div className="vault-category-pill">
            <Sparkles size={13} className="sparkle-icon" />
            <span>{gameMission.category}</span>
          </div>

          <div className="vault-difficulty-rating">
            <span className="rating-label">Độ khó:</span>
            <div className="stars-row">
              <Star size={13} className="star-active" />
              <Star
                size={13}
                className={gameMission.difficulty !== 'Dễ' ? 'star-active' : 'star-inactive'}
              />
              <Star
                size={13}
                className={gameMission.difficulty === 'Thách thức' ? 'star-active' : 'star-inactive'}
              />
            </div>
          </div>
        </div>

        <div className="vault-body-grid">
          {/* Public Letter Badge - 3D Medal Style */}
          <div className="vault-subpanel letter-subpanel">
            <span className="subpanel-tag">CÔNG KHAI CHO TẤT CẢ</span>
            <div className="letter-medal-circle">
              <span className="letter-char">{gameMission.firstLetter}</span>
            </div>
            <span className="letter-label">Chữ Cái Đầu Tiên</span>
          </div>

          {/* Secret Word Box */}
          <div className="vault-subpanel secret-subpanel">
            <div className="subpanel-header-row">
              <span className="subpanel-tag">MẬT MÃ KÉT SẮT</span>
              <button
                type="button"
                className="peek-pill-btn"
                onClick={() => setShowSecret(!showSecret)}
                title={showSecret ? 'Ẩn từ khóa bí mật' : 'Xem từ khóa bí mật'}
              >
                {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showSecret ? 'Ẩn Mã' : 'Xem Mã'}</span>
              </button>
            </div>

            <div className="secret-display-safe">
              <Lock size={18} className="lock-icon" />
              {showSecret ? (
                <span className="secret-word-revealed">{gameMission.secretWord}</span>
              ) : (
                <span className="secret-word-masked">••••••••••</span>
              )}
            </div>

            <p className="vault-hint-text">
              💡 <em>{gameMission.hint}</em>
            </p>
          </div>
        </div>
      </div>

      {/* 3 Letter Drafting Cards Section (Turn-by-turn submission) */}
      <div className="game-white-card letters-draft-card">
        <div className="draft-header-row">
          <div className="draft-title-group">
            <Mail className="draft-icon" size={20} />
            <h3 className="draft-title">Giao Thư Từng Chặng (3 Người Giao Thư)</h3>
          </div>
          <div className="draft-step-indicator">
            <span className={`step-dot ${stepNum >= 1 ? 'active' : ''}`}>1</span>
            <span className="step-line" />
            <span className={`step-dot ${stepNum >= 2 ? 'active' : ''}`}>2</span>
            <span className="step-line" />
            <span className={`step-dot ${stepNum >= 3 ? 'active' : ''}`}>3</span>
            <span className="step-line" />
            <span className={`step-dot ${stepNum >= 4 ? 'active' : ''}`}>🎯</span>
          </div>
        </div>

        <div className="game-letters-grid">
          {/* Letter 1 - Courier 1 */}
          <div className={`game-letter-box letter-slot-1 ${courierDeductions[0]?.leaked ? 'box-leaked' : courierDeductions[0] ? 'box-safe' : gameStep === 1 ? 'box-active' : ''}`}>
            <div className="slot-top-ribbon ribbon-cyan">
              <span className="ribbon-text">BỨC THƯ #1</span>
            </div>

            <div className="courier-card-head">
              <div className="avatar-disc disc-cyan">🕵️‍♂️</div>
              <div className="courier-info-text">
                <div className="courier-title-line">
                  <h4 className="courier-tag-name">Người giao thư 1</h4>
                  {courierDeductions[0]?.leaked && (
                    <span className="badge-pill badge-danger">
                      <ShieldAlert size={11} /> BỊ LỘ!
                    </span>
                  )}
                  {courierDeductions[0] && !courierDeductions[0].leaked && (
                    <span className="badge-pill badge-success">
                      <ShieldCheck size={11} /> AN TOÀN
                    </span>
                  )}
                </div>
                <p className="courier-knows">
                  Chỉ biết: Chữ <strong>"{gameMission.firstLetter}"</strong> + Manh mối 1
                </p>
              </div>
            </div>

            <div className="game-input-slot">
              <input
                type="text"
                className="game-chunky-input"
                placeholder="Nhập 1 từ gợi ý (ví dụ: hạt)"
                value={clues[0]}
                onChange={(e) => setClue(0, e.target.value)}
                disabled={courierDeductions[0] !== null || isEvaluating || evaluatingCourierIndex !== null}
                id="clue-input-0"
              />
            </div>

            {/* Deduction Result or Submit Button */}
            {courierDeductions[0] ? (
              <div className={`deduction-result-banner ${courierDeductions[0].leaked ? 'banner-leaked' : 'banner-safe'}`}>
                <span className="deduction-label">Dự đoán duy nhất của gián điệp 1:</span>
                <div className="deduction-word-row">
                  <strong className="deduction-word">"{courierDeductions[0].inferredWords[0]?.word || ''}"</strong>
                  {courierDeductions[0].leaked ? (
                    <span className="leak-flag">ĐOÁN ĐÚNG MẬT MÃ!</span>
                  ) : (
                    <span className="safe-flag">ĐOÁN SAI (BỊ ĐÁNH LỪA)</span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-courier-submit"
                onClick={() => submitCourierClue(0)}
                disabled={gameStep !== 1 || evaluatingCourierIndex !== null || loadStatus !== 'ready'}
              >
                {evaluatingCourierIndex === 0 ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" />
                    <span>Đang Thẩm Vấn...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Gửi Thư #1 (Nộp)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Letter 2 - Courier 2 */}
          <div className={`game-letter-box letter-slot-2 ${stepNum < 2 && !courierDeductions[1] ? 'box-locked' : ''} ${courierDeductions[1]?.leaked ? 'box-leaked' : courierDeductions[1] ? 'box-safe' : gameStep === 2 ? 'box-active' : ''}`}>
            <div className="slot-top-ribbon ribbon-pink">
              <span className="ribbon-text">BỨC THƯ #2</span>
            </div>

            <div className="courier-card-head">
              <div className="avatar-disc disc-pink">🕵️‍♀️</div>
              <div className="courier-info-text">
                <div className="courier-title-line">
                  <h4 className="courier-tag-name">Người giao thư 2</h4>
                  {courierDeductions[1]?.leaked && (
                    <span className="badge-pill badge-danger">
                      <ShieldAlert size={11} /> BỊ LỘ!
                    </span>
                  )}
                  {courierDeductions[1] && !courierDeductions[1].leaked && (
                    <span className="badge-pill badge-success">
                      <ShieldCheck size={11} /> AN TOÀN
                    </span>
                  )}
                </div>
                <p className="courier-knows">
                  Chỉ biết: Chữ <strong>"{gameMission.firstLetter}"</strong> + Manh mối 2
                </p>
              </div>
            </div>

            <div className="game-input-slot">
              <input
                type="text"
                className="game-chunky-input"
                placeholder={stepNum < 2 ? '🔒 Hãy nộp xong Thư #1 trước' : 'Nhập 1 từ gợi ý (ví dụ: nâu)'}
                value={clues[1]}
                onChange={(e) => setClue(1, e.target.value)}
                disabled={stepNum < 2 || courierDeductions[1] !== null || isEvaluating || evaluatingCourierIndex !== null}
                id="clue-input-1"
              />
            </div>

            {/* Deduction Result or Submit Button */}
            {courierDeductions[1] ? (
              <div className={`deduction-result-banner ${courierDeductions[1].leaked ? 'banner-leaked' : 'banner-safe'}`}>
                <span className="deduction-label">Dự đoán duy nhất của gián điệp 2:</span>
                <div className="deduction-word-row">
                  <strong className="deduction-word">"{courierDeductions[1].inferredWords[0]?.word || ''}"</strong>
                  {courierDeductions[1].leaked ? (
                    <span className="leak-flag">ĐOÁN ĐÚNG MẬT MÃ!</span>
                  ) : (
                    <span className="safe-flag">ĐOÁN SAI (BỊ ĐÁNH LỪA)</span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-courier-submit"
                onClick={() => submitCourierClue(1)}
                disabled={gameStep !== 2 || evaluatingCourierIndex !== null || loadStatus !== 'ready'}
              >
                {evaluatingCourierIndex === 1 ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" />
                    <span>Đang Thẩm Vấn...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Gửi Thư #2 (Nộp)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Letter 3 - Courier 3 */}
          <div className={`game-letter-box letter-slot-3 ${stepNum < 3 && !courierDeductions[2] ? 'box-locked' : ''} ${courierDeductions[2]?.leaked ? 'box-leaked' : courierDeductions[2] ? 'box-safe' : gameStep === 3 ? 'box-active' : ''}`}>
            <div className="slot-top-ribbon ribbon-amber">
              <span className="ribbon-text">BỨC THƯ #3</span>
            </div>

            <div className="courier-card-head">
              <div className="avatar-disc disc-amber">🕵️</div>
              <div className="courier-info-text">
                <div className="courier-title-line">
                  <h4 className="courier-tag-name">Người giao thư 3</h4>
                  {courierDeductions[2]?.leaked && (
                    <span className="badge-pill badge-danger">
                      <ShieldAlert size={11} /> BỊ LỘ!
                    </span>
                  )}
                  {courierDeductions[2] && !courierDeductions[2].leaked && (
                    <span className="badge-pill badge-success">
                      <ShieldCheck size={11} /> AN TOÀN
                    </span>
                  )}
                </div>
                <p className="courier-knows">
                  Chỉ biết: Chữ <strong>"{gameMission.firstLetter}"</strong> + Manh mối 3
                </p>
              </div>
            </div>

            <div className="game-input-slot">
              <input
                type="text"
                className="game-chunky-input"
                placeholder={stepNum < 3 ? '🔒 Hãy nộp xong Thư #2 trước' : 'Nhập 1 từ gợi ý (ví dụ: thức khuya)'}
                value={clues[2]}
                onChange={(e) => setClue(2, e.target.value)}
                disabled={stepNum < 3 || courierDeductions[2] !== null || isEvaluating || evaluatingCourierIndex !== null}
                id="clue-input-2"
              />
            </div>

            {/* Deduction Result or Submit Button */}
            {courierDeductions[2] ? (
              <div className={`deduction-result-banner ${courierDeductions[2].leaked ? 'banner-leaked' : 'banner-safe'}`}>
                <span className="deduction-label">Dự đoán duy nhất của gián điệp 3:</span>
                <div className="deduction-word-row">
                  <strong className="deduction-word">"{courierDeductions[2].inferredWords[0]?.word || ''}"</strong>
                  {courierDeductions[2].leaked ? (
                    <span className="leak-flag">ĐOÁN ĐÚNG MẬT MÃ!</span>
                  ) : (
                    <span className="safe-flag">ĐOÁN SAI (BỊ ĐÁNH LỪA)</span>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-courier-submit"
                onClick={() => submitCourierClue(2)}
                disabled={gameStep !== 3 || evaluatingCourierIndex !== null || loadStatus !== 'ready'}
              >
                {evaluatingCourierIndex === 2 ? (
                  <>
                    <RefreshCw size={16} className="spin-icon" />
                    <span>Đang Thẩm Vấn...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Gửi Thư #3 (Nộp)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Evaluating Friend Status Banner */}
        {isEvaluating && (
          <div className="evaluating-friend-banner">
            <RefreshCw size={20} className="spin-icon" />
            <span>Cả 3 gián điệp đã bị qua mặt! Đồng đội phương xa đang hợp nhất 3 bức thư để giải mã...</span>
          </div>
        )}

        {/* Error message banner */}
        {gameErrorMessage && (
          <div className="game-alert-banner">
            <AlertTriangle size={18} className="alert-icon" />
            <span>{gameErrorMessage}</span>
          </div>
        )}


      </div>

      {/* Evaluation Results Stage (Matches top-right popup card in reference image) */}
      {gameStatus === 'evaluated' && gameResult && (
        <div className="game-evaluation-overlay" id="game-results-stage">
          {/* Modal Pop-up Card */}
          <div className="game-result-modal animate-pop-in">
            {/* Top Stars Header */}
            <div className="modal-stars-header">
              <div className={`star-badge star-left ${gameResult.isVictory ? 'lit' : 'dim'}`}>
                <Star size={32} />
              </div>
              <div className={`star-badge star-center ${gameResult.isVictory ? 'lit center' : 'dim center'}`}>
                <Star size={44} />
              </div>
              <div className={`star-badge star-right ${gameResult.isVictory ? 'lit' : 'dim'}`}>
                <Star size={32} />
              </div>
            </div>

            {/* Folded Ribbon Banner (Pink for failed, Emerald for victory) */}
            <div className={`modal-ribbon-banner ${gameResult.isVictory ? 'ribbon-victory' : 'ribbon-failed'}`}>
              <div className="ribbon-tail-left" />
              <div className="ribbon-center-content">
                <span className="ribbon-subtag">
                  {gameResult.isVictory ? 'CHIẾN CÔNG MỞ KHO BÁU' : 'NHIỆM VỤ THẤT BẠI'}
                </span>
                <h3 className="ribbon-main-title">
                  {gameResult.isVictory ? '🎉 CHIẾN THẮNG!' : '💥 NHIỆM VỤ THẤT BẠI!'}
                </h3>
              </div>
              <div className="ribbon-tail-right" />
            </div>

            {/* Score Pill & Verdict Reason */}
            <div className="modal-body-content">
              <div className="score-capsule-pill">
                <span className="score-capsule-label">KẾT QUẢ ĐIỂM SỐ</span>
                <span className="score-capsule-num">{gameResult.isVictory ? '100' : '00'}</span>
              </div>

              <p className="verdict-explanation-text">{gameResult.reason}</p>

              {/* Single Deduction of Friend */}
              {gameResult.friend && gameResult.friend.inferredWords.length > 0 && (
                <div className={`friend-single-guess-box ${gameResult.friend.success ? 'friend-box-win' : 'friend-box-lose'}`}>
                  <div className="friend-single-head">
                    <span className="friend-icon">🧑‍🤝‍🧑</span>
                    <span className="friend-label">Dự đoán DUY NHẤT của Người Bạn Phương Xa:</span>
                  </div>
                  <div className="friend-guess-hero">
                    <span className="friend-guess-word">"{gameResult.friend.inferredWords[0].word}"</span>
                    {gameResult.friend.success ? (
                      <span className="friend-pill-tag tag-win">🎯 ĐÚNG MÃ KHO BÁU!</span>
                    ) : (
                      <span className="friend-pill-tag tag-lose">❌ ĐOÁN NHẦM (MÃ ĐÚNG: "{gameResult.secretWord}")</span>
                    )}
                  </div>
                </div>
              )}

              {/* 3 Couriers Breakdown Cards (Each showing 1 single guess) */}
              <div className="couriers-interrogation-section">
                <h4 className="section-subtitle">
                  <span>🕵️ Kết Quả Thẩm Vấn Từng Gián Điệp (Mỗi người đoán 1 từ):</span>
                </h4>

                <div className="spies-result-grid">
                  {gameResult.couriers.map((courier, idx) => (
                    <div
                      key={courier.courierIndex || idx}
                      className={`spy-card-box ${courier.leaked ? 'spy-leaked' : 'spy-safe'}`}
                    >
                      <div className="spy-card-header">
                        <span className="spy-avatar">🕵️</span>
                        <div className="spy-titles">
                          <span className="spy-num">Người giao thư #{courier.courierIndex}</span>
                          <span className="spy-clue-label">Thư: "{courier.clue}"</span>
                        </div>

                        {courier.leaked ? (
                          <div className="badge-pill badge-danger">
                            <ShieldAlert size={12} />
                            <span>BỊ LỘ!</span>
                          </div>
                        ) : (
                          <div className="badge-pill badge-success">
                            <ShieldCheck size={12} />
                            <span>AN TOÀN</span>
                          </div>
                        )}
                      </div>

                      <div className="single-guess-display">
                        <span className="single-guess-label">Đoán duy nhất:</span>
                        <strong className="single-guess-value">
                          "{courier.inferredWords[0]?.word || 'Chưa gửi'}"
                        </strong>
                        {courier.leaked ? (
                          <span className="leak-badge-text">Đoán trúng két sắt!</span>
                        ) : (
                          <span className="safe-badge-text">Bị đánh lừa an toàn</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Continue / Play Again Button */}
              <div className="modal-actions-footer">
                <button
                  type="button"
                  className="btn-juicy-continue"
                  onClick={handleRandomMission}
                >
                  <Award size={20} />
                  <span>CHƠI MÀN TIẾP THEO (CONTINUE)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
