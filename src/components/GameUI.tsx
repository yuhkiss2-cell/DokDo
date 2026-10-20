import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, RotateCcw, Home, Volume2, VolumeX, Shield, Award, 
  Sparkles, Sun, Sunset, Moon, HelpCircle, Trophy, ShoppingBag, Check, Settings
} from 'lucide-react';
import { GameDifficulty, TimeOfDay, GullSkin, ScoreRecord, GameStats } from '../types';
import { getLeaderboard, submitScore, LeaderboardEntry } from '../lib/firebase';

interface GameUIProps {
  gameState: 'idle' | 'playing' | 'paused' | 'gameover';
  score: number;
  fishCollected: number;
  highestScore: number;
  difficulty: GameDifficulty;
  timeOfDay: TimeOfDay;
  selectedSkin: GullSkin;
  skins: GullSkin[];
  onSelectSkin: (skin: GullSkin) => void;
  onSetDifficulty: (diff: GameDifficulty) => void;
  onSetTimeOfDay: (time: TimeOfDay) => void;
  onStartGame: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onRestartGame: () => void;
  onHome: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  lastPassedRock: string;
  shieldActive: boolean;
  stats: GameStats;
}

// Educational fun quotes from the black-tailed gull!
const GULL_QUOTES = [
  "독도는 아름다운 화산섬이자 천연기념물 제336호란다! 괭-!",
  "동도에는 한반도 모양을 닮은 한반도 바위가 있어! 정말 신기하지?",
  "서도는 동도보다 조금 더 높고 험준한 바위 봉우리로 되어있어!",
  "매년 봄이면 나와 내 친구들이 독도에 모여서 알을 품고 번식한단다.",
  "독도 주변 바다는 한류와 난류가 만나서 멸치와 오징어가 가득해, 완전 맛집이지!",
  "독도는 우리 땅! 맑은 날에는 울릉도에서도 보일 만큼 가깝단다. 괭-!",
  "독도에는 옛날부터 시원한 우물인 '물골'이 있어서 사람들이 식수로 썼어!",
  "독도의 삼형제굴바위와 촛대바위는 파도와 바람이 만든 대자연의 조각품이야."
];

export const GameUI: React.FC<GameUIProps> = ({
  gameState,
  score,
  fishCollected,
  highestScore,
  difficulty,
  timeOfDay,
  selectedSkin,
  skins,
  onSelectSkin,
  onSetDifficulty,
  onSetTimeOfDay,
  onStartGame,
  onPauseGame,
  onResumeGame,
  onRestartGame,
  onHome,
  isMuted,
  onToggleMute,
  lastPassedRock,
  shieldActive,
  stats
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'skins' | 'leaderboard' | 'missions' | 'settings'>('menu');
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  // Rankings and submission states
  const [schoolInput, setSchoolInput] = useState<string>(() => {
    try {
      return localStorage.getItem('dokdo_gull_school') || '';
    } catch {
      return '';
    }
  });
  const [nameInput, setNameInput] = useState<string>(() => {
    try {
      return localStorage.getItem('dokdo_gull_name') || '';
    } catch {
      return '';
    }
  });
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | 'easy' | 'normal' | 'hard'>('all');

  const currentQuote = GULL_QUOTES[score % GULL_QUOTES.length];

  // Fetch leaderboard rankings
  const fetchLeaderboard = async (diff?: 'easy' | 'normal' | 'hard') => {
    setIsLoadingLeaderboard(true);
    try {
      const entries = await getLeaderboard(diff);
      setLeaderboard(entries);
    } catch (err) {
      console.error('Error in UI fetching leaderboard:', err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // Fetch when active tab is leaderboard
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard(leaderboardFilter === 'all' ? undefined : leaderboardFilter);
    }
  }, [activeTab, leaderboardFilter]);

  // Reset submission state when a new game starts or player goes back to main menu
  useEffect(() => {
    if (gameState === 'playing' || gameState === 'idle') {
      setHasSubmitted(false);
      setSubmissionError('');
    }
    // Also pre-fetch leaderboard in gameover state so it is cached
    if (gameState === 'gameover') {
      fetchLeaderboard(leaderboardFilter === 'all' ? undefined : leaderboardFilter);
    }
  }, [gameState, leaderboardFilter]);

  // Handle score registration submission
  const handleSubmitRanking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolInput.trim()) {
      setSubmissionError('학교 이름을 입력해주세요!');
      return;
    }
    if (!nameInput.trim()) {
      setSubmissionError('이름을 입력해주세요!');
      return;
    }
    if (schoolInput.trim().length > 50) {
      setSubmissionError('학교 이름은 50자 이내여야 합니다.');
      return;
    }
    if (nameInput.trim().length > 30) {
      setSubmissionError('이름은 30자 이내여야 합니다.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError('');
    try {
      try {
        localStorage.setItem('dokdo_gull_school', schoolInput.trim());
        localStorage.setItem('dokdo_gull_name', nameInput.trim());
      } catch (err) {
        console.error('Error writing to localStorage:', err);
      }
      
      const success = await submitScore(
        schoolInput.trim(),
        nameInput.trim(),
        score,
        fishCollected,
        difficulty
      );

      if (success) {
        setHasSubmitted(true);
        // Refresh rankings immediately
        fetchLeaderboard(leaderboardFilter === 'all' ? undefined : leaderboardFilter);
      } else {
        setSubmissionError('등록에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setSubmissionError('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to translate difficulty name
  const translateDiff = (diff: GameDifficulty) => {
    switch(diff) {
      case 'easy': return '쉬움';
      case 'normal': return '보통';
      case 'hard': return '어려움';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-sans select-none z-10">
      
      {/* =========================================================================
          HUD - Heads Up Display (Visible during play and pause)
          ========================================================================= */}
      <AnimatePresence>
        {(gameState === 'playing' || gameState === 'paused') && (
          <div className="w-full flex justify-between items-start pointer-events-auto z-20">
            {/* Top Left Score & Fish Indicators */}
            <div className="flex flex-col gap-2">
              <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3 shadow-lg">
                <span className="text-xs text-slate-400 font-mono">SCORE</span>
                <span className="text-2xl font-bold font-mono text-white leading-none">{score}</span>
              </div>
              
              <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/50 flex items-center gap-2 shadow-lg w-fit">
                {/* Cute rotating silver fish icon */}
                <span className="text-base">🐟</span>
                <span className="text-sm font-bold font-mono text-amber-300 leading-none">{fishCollected}</span>
              </div>

              {/* Shield Active Status */}
              {shieldActive && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="bg-sky-500/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-sky-300 flex items-center gap-1.5 shadow-lg w-fit animate-pulse"
                >
                  <Shield size={14} className="text-white" />
                  <span className="text-xs font-bold text-white">수호막 발동!</span>
                </motion.div>
              )}
            </div>

            {/* Top Center: educational Rock name overlay on pass */}
            <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center pointer-events-none">
              <AnimatePresence mode="wait">
                {lastPassedRock && (
                  <motion.div
                    key={lastPassedRock}
                    initial={{ y: -20, opacity: 0, scale: 0.8 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 15, opacity: 0, scale: 0.8 }}
                    className="bg-emerald-600/90 text-white font-medium text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-emerald-400/30 flex items-center gap-1.5"
                  >
                    <span className="animate-bounce">🏔️</span>
                    <span>{lastPassedRock} 통과!</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Top Right Controls */}
            <div className="flex gap-2">
              <button 
                onClick={onToggleMute}
                id="hud_btn_mute"
                className="bg-slate-900/80 hover:bg-slate-800 transition-colors backdrop-blur-md p-2 rounded-xl border border-slate-700/50 text-slate-300 shadow-lg cursor-pointer"
              >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              
              {gameState === 'playing' ? (
                <button 
                  onClick={onPauseGame}
                  id="hud_btn_pause"
                  className="bg-slate-900/80 hover:bg-slate-800 transition-colors backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/50 text-slate-200 font-bold font-mono shadow-lg cursor-pointer flex items-center gap-1.5 text-sm"
                >
                  <span>PAUSE</span>
                </button>
              ) : (
                <button 
                  onClick={onResumeGame}
                  id="hud_btn_resume"
                  className="bg-amber-500 hover:bg-amber-400 transition-colors px-3.5 py-2 rounded-xl text-slate-950 font-bold font-mono shadow-lg cursor-pointer flex items-center gap-1.5 text-sm"
                >
                  <Play size={14} fill="currentColor" />
                  <span>RESUME</span>
                </button>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          PAUSE OVERLAY
          ========================================================================= */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col justify-center items-center pointer-events-auto z-30">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl mx-4"
            >
              <h2 className="text-2xl font-bold text-amber-400 font-sans tracking-tight mb-2">게임 일시정지</h2>
              <p className="text-slate-400 text-sm mb-6">갈매기가 바위 틈새에서 비행을 잠시 멈췄습니다.</p>

              {/* Statistics during pause */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 mb-6 flex justify-around">
                <div className="text-center">
                  <div className="text-xs text-slate-500 font-mono mb-1">SCORE</div>
                  <div className="text-xl font-bold text-white font-mono">{score}</div>
                </div>
                <div className="w-[1px] bg-slate-800" />
                <div className="text-center">
                  <div className="text-xs text-slate-500 font-mono mb-1">FISHES</div>
                  <div className="text-xl font-bold text-amber-300 font-mono flex items-center gap-1">
                    <span>🐟</span> {fishCollected}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={onResumeGame}
                  id="pause_btn_resume"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <Play size={18} fill="currentColor" />
                  <span>비행 계속하기</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onRestartGame}
                    id="pause_btn_restart"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-2xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw size={16} />
                    <span>다시 시작</span>
                  </button>
                  <button
                    onClick={onHome}
                    id="pause_btn_home"
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-2xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Home size={16} />
                    <span>메인으로</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          IDLE / TITLE SCREEN
          ========================================================================= */}
      <AnimatePresence>
        {gameState === 'idle' && (
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-transparent to-slate-950/60 flex flex-col justify-between pointer-events-auto z-10 p-5">
            
            {/* Top decorative header */}
            <div className="w-full flex justify-between items-center">
              <div className="bg-slate-900/70 border border-slate-800 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2">
                <Trophy size={14} className="text-amber-400" />
                <span className="text-xs text-slate-300 font-medium">최고 기록: <strong className="text-amber-400 font-mono text-sm">{highestScore}</strong>점</span>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={onToggleMute}
                  id="title_btn_mute"
                  className="bg-slate-900/70 border border-slate-800 hover:bg-slate-800/80 transition-colors backdrop-blur-md p-2 rounded-xl text-slate-300 shadow-md cursor-pointer"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                
                <button
                  onClick={() => setShowHowToPlay(true)}
                  id="title_btn_how"
                  className="bg-slate-900/70 border border-slate-800 hover:bg-slate-800/80 transition-colors backdrop-blur-md p-2 rounded-xl text-slate-300 shadow-md cursor-pointer"
                  title="게임 설명"
                >
                  <HelpCircle size={18} />
                </button>
              </div>
            </div>

            {/* Middle Logo Block */}
            <div className="flex flex-col items-center text-center mt-12 select-none">
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="relative"
              >
                {/* Elegant glowing background badge */}
                <div className="absolute -inset-1.5 bg-gradient-to-r from-sky-400 to-emerald-400 rounded-2xl blur-lg opacity-30 animate-pulse" />
                <span className="relative text-xs bg-sky-950/90 text-sky-300 border border-sky-800 px-3 py-1 rounded-full font-bold tracking-widest uppercase mb-3 inline-block">
                  Flappy Dokdo Adventure
                </span>
              </motion.div>

              <motion.h1 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md mt-2 flex flex-col gap-1"
              >
                <span className="bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">독도 괭이갈매기</span>
                <span className="text-3xl font-extrabold text-sky-400 tracking-wide mt-1">바다를 날다 🌊</span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 0.2 }}
                className="text-slate-200 text-xs mt-3.5 max-w-xs leading-relaxed font-medium bg-slate-950/50 backdrop-blur-sm py-1.5 px-3.5 rounded-full"
              >
                바람을 타고 독도 기암괴석 사이를 우아하게 통과하세요!
              </motion.p>
            </div>

            {/* Bottom Panel Layout (Tab-based controls) */}
            <div className="w-full flex flex-col gap-3 mt-auto max-w-md mx-auto">
              
              {/* Core tabs bar */}
              <div className="bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl flex justify-between gap-1 shadow-2xl backdrop-blur-md">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'menu' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Play size={16} fill={activeTab === 'menu' ? 'currentColor' : 'none'} />
                  <span className="text-[9px] mt-1">시작</span>
                </button>
                <button
                  onClick={() => setActiveTab('skins')}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'skins' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <ShoppingBag size={16} />
                  <span className="text-[9px] mt-1">꾸미기</span>
                </button>
                <button
                  onClick={() => setActiveTab('leaderboard')}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'leaderboard' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Trophy size={16} />
                  <span className="text-[9px] mt-1">명예전당</span>
                </button>
                <button
                  onClick={() => setActiveTab('missions')}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'missions' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Award size={16} />
                  <span className="text-[9px] mt-1">미션</span>
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Settings size={16} />
                  <span className="text-[9px] mt-1">설정</span>
                </button>
              </div>

              {/* Dynamic tab contents */}
              <div className="min-h-[160px] bg-slate-900/95 border border-slate-800/90 p-4 rounded-2xl shadow-xl backdrop-blur-md flex flex-col justify-center">
                
                {/* Tab: MENU */}
                {activeTab === 'menu' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex flex-col gap-3.5"
                  >
                    {/* Skin summary badge */}
                    <div className="flex items-center justify-between bg-slate-950/60 px-3.5 py-2.5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-5 h-5 rounded-full border border-white/20"
                          style={{ backgroundColor: selectedSkin.color }}
                        />
                        <div className="text-left">
                          <div className="text-[10px] text-slate-500 font-bold">선택된 날개</div>
                          <div className="text-xs font-bold text-white leading-none mt-0.5">{selectedSkin.name}</div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded-md">
                        {selectedSkin.accessory !== 'none' ? `액세서리: ${selectedSkin.accessory}` : '기본 상태'}
                      </span>
                    </div>

                    {/* Main Fly/Play Button */}
                    <button
                      onClick={onStartGame}
                      id="menu_btn_start"
                      className="w-full bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-slate-950 font-black py-4.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25 border-t border-sky-300/40 text-lg"
                    >
                      <Play size={20} fill="currentColor" />
                      <span>비행 준비 완료 (Tap!)</span>
                    </button>
                  </motion.div>
                )}

                {/* Tab: SKINS */}
                {activeTab === 'skins' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex flex-col h-full"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                      <span>갈매기 스킨 선택</span>
                      <span className="text-amber-400 font-mono text-[11px] flex items-center gap-1">
                        🐟 누적 획득: {stats.totalFishes}
                      </span>
                    </div>
                    
                    {/* Horizontal scrollable skin list */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                      {skins.map((skin) => {
                        const isSelected = selectedSkin.id === skin.id;
                        // Determine unlock state
                        const isUnlocked = 
                          skin.unlockedType === 'free' ||
                          (skin.unlockedType === 'score' && highestScore >= skin.unlockedAt) ||
                          (skin.unlockedType === 'fish' && stats.totalFishes >= skin.unlockedAt);

                        return (
                          <button
                            key={skin.id}
                            disabled={!isUnlocked}
                            onClick={() => onSelectSkin(skin)}
                            className={`flex-shrink-0 w-24 p-2 rounded-xl border transition-all text-center relative cursor-pointer ${
                              isSelected 
                                ? 'bg-sky-950/80 border-sky-400 text-sky-200' 
                                : isUnlocked 
                                  ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300' 
                                  : 'bg-slate-950/90 border-slate-900/90 opacity-60 text-slate-500'
                            }`}
                          >
                            {/* Circle bird representation color */}
                            <div className="relative w-10 h-10 mx-auto rounded-full border border-white/10 flex items-center justify-center mb-1.5" style={{ backgroundColor: skin.color }}>
                              <div className="absolute top-2.5 right-1 w-2.5 h-2 rounded-full" style={{ backgroundColor: skin.beakColor }} />
                              <div className="absolute top-2 right-4 w-1.5 h-1.5 rounded-full bg-slate-950" />
                              
                              {/* Accessory indicators */}
                              {skin.accessory === 'sunglasses' && <span className="absolute text-xs scale-70">🕶️</span>}
                              {skin.accessory === 'hat' && <span className="absolute text-xs -top-2.5 scale-75">👮</span>}
                              {skin.accessory === 'crown' && <span className="absolute text-xs -top-3.5 scale-90">👑</span>}
                            </div>

                            <div className="text-[10px] font-bold truncate leading-tight">{skin.name}</div>
                            
                            {!isUnlocked ? (
                              <div className="text-[8px] mt-1 text-amber-500 font-semibold bg-slate-900 px-1 py-0.5 rounded-md">
                                {skin.unlockedType === 'score' ? `최고 ${skin.unlockedAt}점` : `🐟 ${skin.unlockedAt}개`}
                              </div>
                            ) : (
                              <div className="text-[8px] mt-1 text-slate-400 font-medium">
                                {isSelected ? '장착됨' : '선택 가능'}
                              </div>
                            )}

                            {isSelected && (
                              <div className="absolute top-1 right-1 bg-sky-400 text-slate-950 rounded-full p-0.5">
                                <Check size={8} strokeWidth={4} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Tab: LEADERBOARD */}
                {activeTab === 'leaderboard' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex flex-col h-full text-left"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1">🏆 실시간 명예의 전당</span>
                      <div className="flex gap-1">
                        {(['all', 'easy', 'normal', 'hard'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setLeaderboardFilter(f)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all border ${
                              leaderboardFilter === f 
                                ? 'bg-sky-500/20 border-sky-400 text-sky-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                            }`}
                          >
                            {f === 'all' ? '전체' : f === 'easy' ? '쉬움' : f === 'normal' ? '보통' : '어려움'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 max-h-[110px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                      {isLoadingLeaderboard ? (
                        <div className="text-center py-6 text-xs text-slate-500 animate-pulse">
                          기록 데이터를 불러오는 중... 🌊
                        </div>
                      ) : leaderboard.length === 0 ? (
                        <div className="text-center py-6 text-xs text-slate-500">
                          등록된 기록이 없습니다. 첫 주인공이 되어보세요!
                        </div>
                      ) : (
                        leaderboard.map((entry, idx) => {
                          const medalColor = idx === 0 ? 'bg-yellow-500 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-950' : idx === 2 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400';
                          return (
                            <div 
                              key={entry.id || idx} 
                              className="bg-slate-950/60 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between gap-2 hover:border-slate-700/80 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono font-black text-xs ${medalColor}`}>
                                  {idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[10px] font-bold text-slate-200 truncate flex items-center gap-1">
                                    <span>{entry.name}</span>
                                    <span className="text-[8px] font-medium text-slate-500 truncate">({entry.school})</span>
                                  </div>
                                  <div className="text-[8px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <span className="bg-slate-900 px-1 py-0.2 rounded text-[7px] font-bold border border-slate-800">
                                      {entry.difficulty === 'easy' ? '쉬움' : entry.difficulty === 'normal' ? '보통' : '어려움'}
                                    </span>
                                    <span className="flex items-center gap-0.5">🐟 {entry.fishCollected}마리</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-sm font-black font-mono text-amber-400">{entry.score}</span>
                                <span className="text-[8px] text-slate-500 block font-mono">PTS</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Tab: MISSIONS */}
                {activeTab === 'missions' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex flex-col h-full"
                  >
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center justify-between">
                      <span>독도 수호대 미션</span>
                      <span className="text-emerald-400 font-mono text-[11px]">
                        달성률: {Math.floor((
                          ((stats.totalGames >= 1 ? 1 : 0) + 
                          (stats.totalFishes >= 5 ? 1 : 0) + 
                          (highestScore >= 15 ? 1 : 0) + 
                          (highestScore >= 30 ? 1 : 0) + 
                          (highestScore >= 50 ? 1 : 0) + 
                          (stats.highestScore >= 50 ? 1 : 0)) / 6
                        ) * 100)}%
                      </span>
                    </div>

                    {/* Missions list view */}
                    <div className="grid grid-cols-2 gap-2 max-h-[110px] overflow-y-auto pr-1">
                      {[
                        { name: '첫 비행 성공 🛫', desc: '게임 1회 이상 플레이', done: stats.totalGames >= 1 },
                        { name: '멸치 냠냠 🐟', desc: '누적 물고기 5마리 획득', done: stats.totalFishes >= 5 },
                        { name: '바위 전문가 🏔️', desc: '한 게임에서 15점 도달', done: highestScore >= 15 },
                        { name: '독도 수호대 대장 👮', desc: '한 게임에서 30점 도달', done: highestScore >= 30 },
                        { name: '황금 날개 소유자 ✨', desc: '한 게임에서 50점 도달', done: highestScore >= 50 },
                        { name: '갈매기 마스터 🎖️', desc: '누적 50마리 물고기 획득', done: stats.totalFishes >= 50 },
                      ].map((m, idx) => (
                        <div 
                          key={idx} 
                          className={`p-2 rounded-xl border text-left flex items-start gap-1.5 ${
                            m.done 
                              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' 
                              : 'bg-slate-950/60 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className={`mt-0.5 rounded-full p-0.5 flex-shrink-0 ${m.done ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                            <Check size={8} strokeWidth={4} />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold truncate leading-tight">{m.name}</div>
                            <div className="text-[8px] text-slate-500 truncate leading-normal mt-0.5">{m.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Tab: SETTINGS */}
                {activeTab === 'settings' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="flex flex-col gap-2.5 text-left"
                  >
                    {/* Time of Day setting */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">독도의 바다 시간대</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'day', name: '맑은 낮', icon: <Sun size={12} className="text-amber-400" /> },
                          { id: 'sunset', name: '붉은 노을', icon: <Sunset size={12} className="text-rose-400" /> },
                          { id: 'night', name: '낭만 밤', icon: <Moon size={12} className="text-indigo-400" /> }
                        ].map((t) => (
                          <button
                            key={t.id}
                            onClick={() => onSetTimeOfDay(t.id as TimeOfDay)}
                            className={`py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer flex items-center justify-center gap-1 transition-all ${
                              timeOfDay === t.id 
                                ? 'bg-sky-950/80 border-sky-400 text-sky-200' 
                                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            {t.icon}
                            <span>{t.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Difficulty setting */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">난이도 설정</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['easy', 'normal', 'hard'].map((d) => (
                          <button
                            key={d}
                            onClick={() => onSetDifficulty(d as GameDifficulty)}
                            className={`py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                              difficulty === d 
                                ? 'bg-sky-950/80 border-sky-400 text-sky-200' 
                                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span>{translateDiff(d as GameDifficulty)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>
              
            </div>

            {/* Subtle branding or instructions credit line */}
            <div className="text-[9px] text-slate-400/80 mt-4 tracking-wider select-none text-center">
              조작 방법: [Space] 키 또는 마우스/화면 터치로 비행 상승
            </div>
            
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          GAME OVER SCREEN
          ========================================================================= */}
      <AnimatePresence>
        {gameState === 'gameover' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col justify-center items-center pointer-events-auto z-30 p-5">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl mx-4 relative overflow-hidden"
            >
              {/* Highlight card banner */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-sky-500" />

              {/* High Score Flag Badge */}
              {score > 0 && score >= highestScore && (
                <div className="mx-auto mb-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] px-3 py-1 rounded-full w-fit uppercase tracking-widest shadow-lg flex items-center gap-1 animate-bounce">
                  <Sparkles size={11} fill="currentColor" />
                  <span>개인 최고 신기록!</span>
                </div>
              )}

              <h2 className="text-3xl font-black text-rose-500 tracking-tight mb-1">비행 종료 🍂</h2>
              <p className="text-xs text-slate-400 mb-5 font-medium leading-relaxed px-4">갈매기가 아름다운 독도 파도에 날개를 부딪쳤습니다.</p>

              {/* Game Score Summary Board */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 mb-5 grid grid-cols-2 gap-4">
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 font-mono font-bold">SCORE</div>
                  <div className="text-3xl font-extrabold text-white font-mono leading-none mt-1">{score}</div>
                  <div className="text-[9px] text-slate-500 font-bold mt-1.5">난이도: {translateDiff(difficulty)}</div>
                </div>
                
                <div className="text-right border-l border-slate-800 pl-4">
                  <div className="text-[10px] text-slate-500 font-mono font-bold">FISH COLLECTED</div>
                  <div className="text-2xl font-extrabold text-amber-300 font-mono leading-none mt-1.5 flex items-center justify-end gap-1">
                    <span>🐟</span> {fishCollected}
                  </div>
                  <div className="text-[9px] text-slate-500 font-bold mt-2">최고 기록: {highestScore}점</div>
                </div>
              </div>

              {/* Cute Educational Quote from Gull */}
              <div className="bg-slate-950/40 rounded-xl p-3 border border-slate-800/40 text-[11px] text-slate-300 leading-relaxed text-left mb-4 flex gap-2">
                <span className="text-lg">📢</span>
                <div>
                  <span className="font-bold text-sky-400 text-[10px] block mb-0.5">괭이갈매기의 독도 이야기:</span>
                  {currentQuote}
                </div>
              </div>

              {/* Leaderboard Submission Form */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-4 text-left">
                <h3 className="text-xs font-bold text-sky-400 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
                  <Trophy size={13} className="text-amber-400" />
                  <span>실시간 명예의 전당 등록</span>
                </h3>

                {hasSubmitted ? (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center py-2"
                  >
                    <div className="text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 mb-1">
                      <Check size={14} strokeWidth={3} className="bg-emerald-500 text-slate-950 rounded-full p-0.5" />
                      <span>기록이 성공적으로 등록되었습니다!</span>
                    </div>
                    <p className="text-[10px] text-slate-500">메인 화면의 '명예전당' 탭에서 순위를 확인하세요.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmitRanking} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-1">학교명</label>
                        <input
                          type="text"
                          value={schoolInput}
                          onChange={(e) => setSchoolInput(e.target.value)}
                          placeholder="예) 독도초"
                          maxLength={50}
                          disabled={isSubmitting}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-1">이름</label>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="예) 홍길동"
                          maxLength={30}
                          disabled={isSubmitting}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {submissionError && (
                      <p className="text-[10px] text-rose-500 font-semibold leading-none">{submissionError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-2 rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1 shadow-md shadow-sky-500/10 border-t border-sky-300/30"
                    >
                      {isSubmitting ? '등록 중...' : '내 기록 랭킹 올리기 🚀'}
                    </button>
                  </form>
                )}
              </div>

              {/* Replay & Navigation Buttons */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  onClick={onRestartGame}
                  id="gameover_btn_restart"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-2xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-md"
                >
                  <RotateCcw size={18} />
                  <span>다시 날기 (Replay)</span>
                </button>

                <button
                  onClick={onHome}
                  id="gameover_btn_home"
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-2xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Home size={16} />
                  <span>메인으로 이동</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          HOW TO PLAY OVERLAY DIALOG (Modal)
          ========================================================================= */}
      <AnimatePresence>
        {showHowToPlay && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center pointer-events-auto z-40 p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
            >
              <h3 className="text-xl font-bold text-sky-400 mb-3 flex items-center gap-2">
                <span>🎮</span> 독도 괭이갈매기 놀이터
              </h3>
              
              <div className="text-xs text-slate-300 leading-relaxed space-y-3.5 mb-6 text-left">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="font-bold text-white block mb-1">기본 조작 방법:</span>
                  • 키보드 <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white text-[10px] border border-slate-700">Space</kbd> 키나 <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white text-[10px] border border-slate-700">↑ (위 방향키)</kbd>를 누르면 상승합니다.<br />
                  • 마우스 <span className="font-semibold text-white">왼쪽 클릭</span>이나 모바일 <span className="font-semibold text-white">화면 터치</span>로도 똑같이 상승합니다.
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="font-bold text-white block mb-1">주요 아이템:</span>
                  • 🐟 <span className="font-semibold text-amber-300">멸치 (물고기)</span>: 스킨 해금에 사용되는 소중한 식량입니다.<br />
                  • 🛡️ <span className="font-semibold text-sky-300">수호막</span>: 바위에 1회 충돌을 완전 방어해줍니다.
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="font-bold text-white block mb-1">독도 바위 장애물:</span>
                  • 독도의 독특한 명소들을 본뜬 바위 기둥입니다. 파도를 스치거나 바위에 부딪히지 않도록 주의하세요!
                </div>
              </div>

              <button
                onClick={() => setShowHowToPlay(false)}
                id="how_btn_close"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-2xl border border-slate-700 transition-colors cursor-pointer"
              >
                알겠어, 괭-!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
export default GameUI;
