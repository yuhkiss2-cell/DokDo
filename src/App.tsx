import { useState, useEffect } from 'react';
import { GameDifficulty, TimeOfDay, GullSkin, GameStats } from './types';
import { GameCanvas } from './components/GameCanvas';
import { GameUI } from './components/GameUI';
import { sound } from './components/SoundManager';
import { Shield, MapPin, Compass, AlertCircle } from 'lucide-react';

const DEFAULT_SKINS: GullSkin[] = [
  { id: 'skin_default', name: '기본 괭이갈매기', description: '독도의 마스코트 기본 갈매기', unlockedAt: 0, unlockedType: 'free', color: '#475569', beakColor: '#EAB308', accessory: 'none' },
  { id: 'skin_hipster', name: '선글라스 힙스터', description: '선글라스를 낀 힙한 날개', unlockedAt: 10, unlockedType: 'score', color: '#EC4899', beakColor: '#F59E0B', accessory: 'sunglasses' },
  { id: 'skin_guard', name: '독도 수호대 대원', description: '의경 수호대 캡을 쓴 갈매기', unlockedAt: 25, unlockedType: 'score', color: '#1E3A8A', beakColor: '#EF4444', accessory: 'hat' },
  { id: 'skin_royal', name: '로열 프린스', description: '금빛 왕관을 쓴 독도 왕자', unlockedAt: 15, unlockedType: 'fish', color: '#8B5CF6', beakColor: '#F59E0B', accessory: 'crown' },
  { id: 'skin_gold', name: '황금 전설', description: '찬란한 기운을 풍기는 전설의 날개', unlockedAt: 50, unlockedType: 'score', color: '#FBBF24', beakColor: '#EF4444', accessory: 'none', specialEffect: 'sparkle' },
];

export default function App() {
  // Game state
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameover'>('idle');
  const [score, setScore] = useState<number>(0);
  const [fishCollected, setFishCollected] = useState<number>(0);
  const [shieldActive, setShieldActive] = useState<boolean>(false);
  const [lastPassedRock, setLastPassedRock] = useState<string>('');
  const [lastRockTimer, setLastRockTimer] = useState<NodeJS.Timeout | null>(null);

  // Settings & unlocking states
  const [difficulty, setDifficulty] = useState<GameDifficulty>('normal');
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [selectedSkin, setSelectedSkin] = useState<GullSkin>(DEFAULT_SKINS[0]);
  const [highestScore, setHighestScore] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Cumulative player statistics for achievements & skin unlocks
  const [stats, setStats] = useState<GameStats>({
    totalGames: 0,
    totalFlaps: 0,
    totalFishes: 0,
    highestScore: 0,
  });

  // Load from LocalStorage safely on mount
  useEffect(() => {
    try {
      const savedHigh = localStorage.getItem('dokdo_gull_high');
      if (savedHigh) setHighestScore(parseInt(savedHigh, 10));

      const savedDiff = localStorage.getItem('dokdo_gull_diff');
      if (savedDiff) setDifficulty(savedDiff as GameDifficulty);

      const savedMuted = localStorage.getItem('dokdo_gull_muted');
      if (savedMuted) {
        const muted = savedMuted === 'true';
        setIsMuted(muted);
        sound.setEnabled(!muted);
      } else {
        sound.setEnabled(true);
      }

      const savedSkinId = localStorage.getItem('dokdo_gull_skin');
      if (savedSkinId) {
        const found = DEFAULT_SKINS.find(s => s.id === savedSkinId);
        if (found) setSelectedSkin(found);
      }

      const savedStats = localStorage.getItem('dokdo_gull_stats');
      if (savedStats) {
        setStats(JSON.parse(savedStats));
      }
    } catch (e) {
      console.error("Failed loading storage:", e);
    }
  }, []);

  // Set sound state when isMuted changes
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sound.setEnabled(!nextMute);
    sound.playClick();
    try {
      localStorage.setItem('dokdo_gull_muted', String(nextMute));
    } catch(e){}
  };

  const handleSetDifficulty = (diff: GameDifficulty) => {
    setDifficulty(diff);
    sound.playClick();
    try {
      localStorage.setItem('dokdo_gull_diff', diff);
    } catch(e){}
  };

  const handleSetTimeOfDay = (time: TimeOfDay) => {
    setTimeOfDay(time);
    sound.playClick();
  };

  const handleSelectSkin = (skin: GullSkin) => {
    setSelectedSkin(skin);
    sound.playClick();
    try {
      localStorage.setItem('dokdo_gull_skin', skin.id);
    } catch(e){}
  };

  // State modification triggers
  const handleStartGame = () => {
    setGameState('playing');
    setScore(0);
    setFishCollected(0);
    setShieldActive(false);
    setLastPassedRock('');
    sound.playClick();
  };

  const handlePauseGame = () => {
    setGameState('paused');
    sound.playClick();
  };

  const handleResumeGame = () => {
    setGameState('playing');
    sound.playClick();
  };

  const handleRestartGame = () => {
    handleStartGame();
  };

  const handleHome = () => {
    setGameState('idle');
    setScore(0);
    setFishCollected(0);
    setShieldActive(false);
    setLastPassedRock('');
    sound.playClick();
  };

  const handleFlap = () => {
    setStats(prev => {
      const next = { ...prev, totalFlaps: prev.totalFlaps + 1 };
      try {
        localStorage.setItem('dokdo_gull_stats', JSON.stringify(next));
      } catch(e){}
      return next;
    });
  };

  const handleScoreChange = (newScore: number) => {
    setScore(newScore);
  };

  const handleFishCollect = (count: number) => {
    setFishCollected(count);
  };

  const handleRockPassed = (rockName: string) => {
    // Clear old timer if any
    if (lastRockTimer) {
      clearTimeout(lastRockTimer);
    }
    setLastPassedRock(rockName);
    
    // Auto clear name indicator after 2.2 seconds
    const timer = setTimeout(() => {
      setLastPassedRock('');
    }, 2200);
    setLastRockTimer(timer);
  };

  const handleGameOver = (finalScore: number) => {
    setGameState('gameover');
    
    // Update high scores and statistics
    const isNewHigh = finalScore > highestScore;
    let nextHigh = highestScore;
    if (isNewHigh) {
      nextHigh = finalScore;
      setHighestScore(finalScore);
      try {
        localStorage.setItem('dokdo_gull_high', String(finalScore));
      } catch(e){}
    }

    setStats(prev => {
      const next: GameStats = {
        totalGames: prev.totalGames + 1,
        totalFlaps: prev.totalFlaps,
        totalFishes: prev.totalFishes + fishCollected,
        highestScore: Math.max(prev.highestScore, finalScore),
      };
      try {
        localStorage.setItem('dokdo_gull_stats', JSON.stringify(next));
      } catch(e){}
      return next;
    });
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (lastRockTimer) clearTimeout(lastRockTimer);
    };
  }, [lastRockTimer]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row items-center justify-center p-0 md:p-6 overflow-hidden relative">
      
      {/* Ocean atmosphere background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* LEFT PANEL: Educational sidebar with Dokdo facts & coordinates on desktop */}
      <div className="hidden lg:flex flex-col max-w-xs w-full mr-8 text-left space-y-6 z-10 select-none">
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 text-sky-400 font-bold mb-3">
            <Compass size={18} className="animate-spin-slow" />
            <h2 className="text-sm tracking-wide uppercase">독도 좌표 & 환경 정보</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            독도는 경상북도 울릉군 울릉읍 독도리에 속해 있으며, 아름다운 우리 영토입니다.
          </p>
          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-500">위도/경도</span>
              <span className="text-slate-300 font-medium">37°14′26.8″N 131°52′10.4″E</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-500">천연기념물</span>
              <span className="text-slate-300 font-medium">제336호 (천연보호구역)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-500">대표 조류</span>
              <span className="text-sky-300 font-bold">괭이갈매기 (Black-tailed Gull)</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-5 rounded-2xl shadow-xl text-xs space-y-3">
          <div className="flex items-center gap-1.5 text-amber-500 font-bold">
            <AlertCircle size={15} />
            <span>갈매기 상식 한 조각</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            괭이갈매기는 고양이와 유사한 "괭-" 하는 울음소리를 낸다 하여 붙여진 사랑스러운 이름입니다. 꼬리 깃에 선명한 검은 띠가 있는 것이 특징이랍니다!
          </p>
        </div>
      </div>

      {/* CENTRAL ARCADE CABINET CONTAINER */}
      <div className="relative w-full h-screen md:h-[640px] md:w-[480px] md:rounded-3xl overflow-hidden shadow-2xl md:border-4 md:border-slate-800 bg-slate-950 flex flex-col z-10">
        
        {/* Retro screen bezel shadow overlay */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.6)] z-20" />

        {/* The active canvas game loop renderer */}
        <GameCanvas
          gameState={gameState}
          difficulty={difficulty}
          timeOfDay={timeOfDay}
          selectedSkin={selectedSkin}
          isMuted={isMuted}
          onScoreChange={handleScoreChange}
          onFishCollect={handleFishCollect}
          onGameOver={handleGameOver}
          onFlap={handleFlap}
          onRockPassed={handleRockPassed}
          shieldActive={shieldActive}
          setShieldActive={setShieldActive}
        />

        {/* Heads Up Overlay UI menus, states, selections */}
        <GameUI
          gameState={gameState}
          score={score}
          fishCollected={fishCollected}
          highestScore={highestScore}
          difficulty={difficulty}
          timeOfDay={timeOfDay}
          selectedSkin={selectedSkin}
          skins={DEFAULT_SKINS}
          onSelectSkin={handleSelectSkin}
          onSetDifficulty={handleSetDifficulty}
          onSetTimeOfDay={handleSetTimeOfDay}
          onStartGame={handleStartGame}
          onPauseGame={handlePauseGame}
          onResumeGame={handleResumeGame}
          onRestartGame={handleRestartGame}
          onHome={handleHome}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          lastPassedRock={lastPassedRock}
          shieldActive={shieldActive}
          stats={stats}
        />
        
      </div>

      {/* RIGHT PANEL: Stats Overview & instructions on desktop */}
      <div className="hidden lg:flex flex-col max-w-xs w-full ml-8 text-left space-y-6 z-10 select-none">
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3">
            <MapPin size={18} />
            <h2 className="text-sm tracking-wide uppercase">누적 비행 통계</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3.5 mt-2">
            <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold">총 플레이 횟수</span>
              <span className="block text-lg font-bold text-slate-200 mt-1 font-mono">{stats.totalGames}회</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl text-center">
              <span className="text-[10px] text-slate-500 font-bold">누적 날갯짓</span>
              <span className="block text-lg font-bold text-slate-200 mt-1 font-mono">{stats.totalFlaps}번</span>
            </div>
            <div className="bg-slate-950/60 border border-slate-800/60 p-3 rounded-xl text-center col-span-2 flex items-center justify-between px-4">
              <span className="text-[10px] text-slate-500 font-bold">총 수집한 멸치 식량</span>
              <span className="text-md font-bold text-amber-300 font-mono">🐟 {stats.totalFishes}마리</span>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-500/80 leading-normal text-center bg-slate-950/20 py-2.5 px-4 rounded-xl border border-slate-900/60">
          독도 괭이갈매기 수호 모험 v1.1.2<br />
          © 2026 Dokdo Gull Flight, Inc.
        </div>
      </div>

    </div>
  );
}
