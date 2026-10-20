import React, { useRef, useEffect, useState } from 'react';
import { GameDifficulty, TimeOfDay, GullSkin, Obstacle, Collectible, Particle } from '../types';
import { sound } from './SoundManager';

interface GameCanvasProps {
  gameState: 'idle' | 'playing' | 'paused' | 'gameover';
  difficulty: GameDifficulty;
  timeOfDay: TimeOfDay;
  selectedSkin: GullSkin;
  isMuted: boolean;
  onScoreChange: (score: number) => void;
  onFishCollect: (fishCount: number) => void;
  onGameOver: (finalScore: number) => void;
  onFlap: () => void;
  onRockPassed: (rockName: string) => void;
  shieldActive: boolean;
  setShieldActive: (active: boolean) => void;
}

// Famous rocks and islands of Dokdo and Ulleungdo to dynamically name each obstacle!
const DOKDO_ROCK_NAMES = [
  '독도 동도 (Dongdo, Dokdo)',
  '독도 서도 (Seodo, Dokdo)',
  '울릉도 삼선암 (Samseonam, Ulleungdo)',
  '울릉도 딴바위 (Ddanbawi, Ulleungdo)',
  '독도 삼형제굴바위 (Three Brothers Cave Rock)',
  '독도 촛대바위 (Candle Rock, Dokdo)',
  '울릉도 관음도 (Gwaneumdo, Ulleungdo)',
  '독도 독립문바위 (Independence Gate Rock, Dokdo)',
  '독도 한반도바위 (Korean Peninsula Rock, Dokdo)',
  '울릉도 코끼리바위/공암 (Elephant Rock, Ulleungdo)',
  '울릉도 국수바위 주상절리 (Guksubawi Columnar Joint, Ulleungdo)',
  '독도 숫돌바위 (Sutdolbawi, Dokdo)',
  '독도 부채바위 (Fan Rock, Dokdo)',
  '울릉도 사자바위 (Lion Rock, Ulleungdo)',
  '울릉도 거북바위 (Turtle Rock, Ulleungdo)',
  '독도 물오리바위 (Mulo-ribawi, Dokdo)',
  '독도 닭바위 (Dalkbawi, Dokdo)',
  '울릉도 죽도 (Jukdo, Ulleungdo)'
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  difficulty,
  timeOfDay,
  selectedSkin,
  isMuted,
  onScoreChange,
  onFishCollect,
  onGameOver,
  onFlap,
  onRockPassed,
  shieldActive,
  setShieldActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevGameStateRef = useRef<'idle' | 'playing' | 'paused' | 'gameover'>('idle');

  // Virtual resolution for physics consistency
  const V_WIDTH = 480;
  const V_HEIGHT = 640;

  // Game state refs (to avoid stale closures in requestAnimationFrame)
  const stateRef = useRef({
    gameState,
    difficulty,
    timeOfDay,
    selectedSkin,
    isMuted,
    score: 0,
    fishCollected: 0,
    shieldActive,
    
    // Bird physics
    birdY: V_HEIGHT / 2,
    birdVelocity: 0,
    birdAngle: 0,
    birdRadius: 18,
    flapStrength: -8.0,
    gravity: 0.38,
    
    // Game entities
    obstacles: [] as Obstacle[],
    collectibles: [] as Collectible[],
    particles: [] as Particle[],
    
    // Background parallax offsets
    bgOffsetClouds: 0,
    bgOffsetIslands: 0,
    bgOffsetWavesBack: 0,
    bgOffsetWavesFront: 0,
    
    // Frame counting / wave sin animation
    frameCount: 0,
    wingAngle: 0,
    wingDirection: 1,
    
    // Timers
    obstacleSpawnTimer: 0,
    nextObstacleNameIndex: 0,
    invincibilityFrames: 0,
  });

  // Keep stateRef in sync with props
  useEffect(() => {
    stateRef.current.gameState = gameState;
    stateRef.current.difficulty = difficulty;
    stateRef.current.timeOfDay = timeOfDay;
    stateRef.current.selectedSkin = selectedSkin;
    stateRef.current.isMuted = isMuted;
    stateRef.current.shieldActive = shieldActive;

    // Apply difficulty changes
    if (difficulty === 'easy') {
      stateRef.current.gravity = 0.32;
      stateRef.current.flapStrength = -7.0;
    } else if (difficulty === 'normal') {
      stateRef.current.gravity = 0.38;
      stateRef.current.flapStrength = -7.8;
    } else { // hard
      stateRef.current.gravity = 0.44;
      stateRef.current.flapStrength = -8.5;
    }
  }, [gameState, difficulty, timeOfDay, selectedSkin, isMuted, shieldActive]);

  // Handle Canvas Resize perfectly dynamically
  const [dimensions, setDimensions] = useState({ width: V_WIDTH, height: V_HEIGHT });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Maintain portrait 3:4 or 4:5 ratio or just fill parent safely
        // Let's scale up based on the smaller container dimension
        const containerRatio = width / height;
        const targetRatio = V_WIDTH / V_HEIGHT;

        let w = width;
        let h = height;

        if (containerRatio > targetRatio) {
          // Parent is wider than target ratio, bound by height
          h = height;
          w = height * targetRatio;
        } else {
          // Parent is taller than target ratio, bound by width
          w = width;
          h = width / targetRatio;
        }

        setDimensions({ width: w, height: h });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Set up game parameters for starting a new game
  const resetGame = () => {
    const s = stateRef.current;
    s.birdY = V_HEIGHT / 2.5;
    s.birdVelocity = 0;
    s.birdAngle = 0;
    s.score = 0;
    s.fishCollected = 0;
    s.obstacles = [];
    s.collectibles = [];
    s.particles = [];
    s.bgOffsetClouds = 0;
    s.bgOffsetIslands = 0;
    s.bgOffsetWavesBack = 0;
    s.bgOffsetWavesFront = 0;
    s.frameCount = 0;
    s.obstacleSpawnTimer = 0;
    s.nextObstacleNameIndex = 0;
    s.invincibilityFrames = 0;
    setShieldActive(false);
    onScoreChange(0);
    onFishCollect(0);
  };

  // Trigger flap action
  const triggerFlap = () => {
    const s = stateRef.current;
    if (s.gameState !== 'playing') return;

    s.birdVelocity = s.flapStrength;
    onFlap();
    sound.playJump();

    // Spawn cute feather particles behind the gull
    const featherCount = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < featherCount; i++) {
      s.particles.push({
        x: 100 - 10,
        y: s.birdY,
        vx: -2 - Math.random() * 3,
        vy: (Math.random() * 4) - 2,
        size: 4 + Math.random() * 6,
        alpha: 1,
        color: s.selectedSkin.color === '#FFD700' ? '#FFF' : s.selectedSkin.color,
        rotation: Math.random() * Math.PI * 2,
        vRotation: (Math.random() * 0.1) - 0.05,
        type: s.selectedSkin.specialEffect === 'sparkle' ? 'sparkle' : 'feather',
        life: 0,
        maxLife: 40 + Math.random() * 20
      });
    }

    // Special skin sparkle effects
    if (s.selectedSkin.specialEffect === 'sparkle' || s.selectedSkin.id === 'skin_gold') {
      for (let i = 0; i < 4; i++) {
        s.particles.push({
          x: 100 + (Math.random() * 20 - 10),
          y: s.birdY + (Math.random() * 20 - 10),
          vx: (Math.random() * 2 - 1),
          vy: (Math.random() * 2 - 1),
          size: 3 + Math.random() * 4,
          alpha: 1,
          color: '#FFE853',
          rotation: Math.random() * Math.PI * 2,
          vRotation: 0.1,
          type: 'sparkle',
          life: 0,
          maxLife: 25 + Math.random() * 15
        });
      }
    }
  };

  // Listen to mouse/keyboard/touch events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        triggerFlap();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Prevent zooming, etc.
      e.preventDefault();
      triggerFlap();
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        triggerFlap();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('mousedown', handleMouseDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (canvas) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [gameState]);

  // Handle initial trigger / state shifts
  useEffect(() => {
    if (gameState === 'playing' && (prevGameStateRef.current === 'idle' || prevGameStateRef.current === 'gameover')) {
      resetGame();
    }
    prevGameStateRef.current = gameState;
  }, [gameState]);

  // Main Render & Physics update Loop
  useEffect(() => {
    let animationFrameId: number;

    const updatePhysics = () => {
      const s = stateRef.current;
      if (s.gameState !== 'playing') return;

      s.frameCount++;

      // Bird gravity
      s.birdVelocity += s.gravity;
      s.birdY += s.birdVelocity;

      // Handle wing animation flap rate based on vertical velocity
      s.wingAngle += 0.2 * s.wingDirection;
      if (Math.abs(s.wingAngle) > 0.8) {
        s.wingDirection *= -1;
      }

      // Smooth gull tilting
      // Velocities around -8 (jumping) to 12 (falling)
      const targetAngle = Math.min(Math.max(s.birdVelocity * 0.05, -0.4), 0.7);
      s.birdAngle += (targetAngle - s.birdAngle) * 0.25;

      // Invincibility countdown
      if (s.invincibilityFrames > 0) {
        s.invincibilityFrames--;
      }

      // Sea / Ceiling boundary checking
      const oceanLevel = V_HEIGHT - 75;
      if (s.birdY - s.birdRadius < 0) {
        s.birdY = s.birdRadius;
        s.birdVelocity = 0;
      }

      if (s.birdY + s.birdRadius > oceanLevel) {
        // Splash!
        sound.playCrash();
        triggerSplash(100, oceanLevel);
        onGameOver(s.score);
        return;
      }

      // Move background parallax offsets
      let speedMultiplier = 1;
      if (s.difficulty === 'normal') speedMultiplier = 1.25;
      if (s.difficulty === 'hard') speedMultiplier = 1.5;

      s.bgOffsetClouds = (s.bgOffsetClouds + 0.3 * speedMultiplier) % V_WIDTH;
      s.bgOffsetIslands = (s.bgOffsetIslands + 0.5 * speedMultiplier) % V_WIDTH;
      s.bgOffsetWavesBack = (s.bgOffsetWavesBack + 1.2 * speedMultiplier) % V_WIDTH;
      s.bgOffsetWavesFront = (s.bgOffsetWavesFront + 2.0 * speedMultiplier) % V_WIDTH;

      // Obstacle Generation & Motion
      let spawnInterval = 130; // frames
      let obstacleSpeed = 2.4 * speedMultiplier;
      let gapHeight = 160; // default gap width

      if (s.difficulty === 'easy') {
        gapHeight = 185;
        spawnInterval = 140;
      } else if (s.difficulty === 'hard') {
        gapHeight = 135;
        spawnInterval = 110;
      }

      s.obstacleSpawnTimer++;
      if (s.obstacleSpawnTimer >= spawnInterval) {
        s.obstacleSpawnTimer = 0;

        // Generate height within limits
        const minHeight = 60;
        const maxHeight = V_HEIGHT - 75 - gapHeight - minHeight;
        const topHeight = minHeight + Math.random() * (maxHeight - minHeight);
        const bottomHeight = V_HEIGHT - 75 - gapHeight - topHeight;

        s.obstacles.push({
          x: V_WIDTH,
          width: 65,
          topHeight,
          bottomHeight,
          passed: false,
          rockTypeTop: Math.floor(Math.random() * 5),
          rockTypeBottom: Math.floor(Math.random() * 5),
        });

        // Chance to spawn floating fish/collectible in between gaps
        if (Math.random() < 0.6) {
          const fishY = topHeight + gapHeight / 2 + (Math.random() * 40 - 20);
          const collectType = Math.random() < 0.12 ? 'shield' : 'fish'; // Shield is rarer!
          s.collectibles.push({
            x: V_WIDTH + 32, // Center of the rock width
            y: fishY,
            type: collectType,
            collected: false,
            size: 15,
            pulsePhase: Math.random() * Math.PI,
          });
        }
      }

      // Move & filter obstacles
      s.obstacles.forEach((obs) => {
        obs.x -= obstacleSpeed;

        // Check if passed gull position (which is fixed at x = 100)
        if (!obs.passed && obs.x + obs.width < 100) {
          obs.passed = true;
          s.score++;
          onScoreChange(s.score);
          
          // Trigger a beautiful, educational rock pass notification!
          const name = DOKDO_ROCK_NAMES[s.nextObstacleNameIndex];
          onRockPassed(name);
          s.nextObstacleNameIndex = (s.nextObstacleNameIndex + 1) % DOKDO_ROCK_NAMES.length;

          // Sound effect on high scoring intervals
          if (s.score > 0 && s.score % 10 === 0) {
            sound.playHighScore();
          } else {
            // Soft synth chime for scores (optional, we could play a micro synth but score count is enough)
          }
        }
      });

      // Filter off-screen obstacles
      s.obstacles = s.obstacles.filter((obs) => obs.x + obs.width > -50);

      // Move & filter collectibles
      s.collectibles.forEach((col) => {
        col.x -= obstacleSpeed;
        col.pulsePhase += 0.05;

        // Collision check with black-tailed gull
        if (!col.collected) {
          const dist = Math.hypot((col.x - 100), (col.y - s.birdY));
          if (dist < s.birdRadius + col.size - 2) {
            col.collected = true;
            if (col.type === 'fish') {
              s.fishCollected++;
              onFishCollect(s.fishCollected);
              sound.playCollect();

              // Spawn sparkling splash particles
              for (let i = 0; i < 8; i++) {
                s.particles.push({
                  x: col.x,
                  y: col.y,
                  vx: (Math.random() * 4 - 2),
                  vy: (Math.random() * 4 - 2),
                  size: 3 + Math.random() * 3,
                  alpha: 1,
                  color: '#FFE853',
                  rotation: Math.random() * Math.PI,
                  vRotation: 0,
                  type: 'sparkle',
                  life: 0,
                  maxLife: 20 + Math.random() * 15
                });
              }
            } else if (col.type === 'shield') {
              setShieldActive(true);
              sound.playShield();

              // Shield activation ring particles
              for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                s.particles.push({
                  x: 100,
                  y: s.birdY,
                  vx: Math.cos(angle) * 3,
                  vy: Math.sin(angle) * 3,
                  size: 4 + Math.random() * 3,
                  alpha: 1,
                  color: '#38BDF8',
                  rotation: angle,
                  vRotation: 0,
                  type: 'bubble',
                  life: 0,
                  maxLife: 30
                });
              }
            }
          }
        }
      });

      s.collectibles = s.collectibles.filter((col) => col.x > -50 && !col.collected);

      // Collision checks with obstacles
      if (s.invincibilityFrames === 0) {
        for (let obs of s.obstacles) {
          // AABB with custom circular clearance for gull
          const gullLeft = 100 - s.birdRadius + 4;
          const gullRight = 100 + s.birdRadius - 4;
          const gullTop = s.birdY - s.birdRadius + 4;
          const gullBottom = s.birdY + s.birdRadius - 4;

          const insideX = gullRight > obs.x && gullLeft < obs.x + obs.width;
          const hitTop = insideX && gullTop < obs.topHeight;
          const hitBottom = insideX && gullBottom > V_HEIGHT - 75 - obs.bottomHeight;

          if (hitTop || hitBottom) {
            if (s.shieldActive) {
              // Destroy shield, give grace invincibility period!
              setShieldActive(false);
              s.invincibilityFrames = 60; // 1 second of grace
              sound.playCrash(); // lower crash feedback

              // Big circle expansion bubble
              for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2;
                s.particles.push({
                  x: 100,
                  y: s.birdY,
                  vx: Math.cos(angle) * 5,
                  vy: Math.sin(angle) * 5,
                  size: 5 + Math.random() * 4,
                  alpha: 1,
                  color: '#38BDF8',
                  rotation: angle,
                  vRotation: 0.1,
                  type: 'bubble',
                  life: 0,
                  maxLife: 40
                });
              }
              break;
            } else {
              // Crash! Game over
              sound.playCrash();
              triggerSplash(100, s.birdY);
              onGameOver(s.score);
              return;
            }
          }
        }
      }

      // Update particles
      s.particles.forEach((part) => {
        part.life++;
        part.x += part.vx;
        part.y += part.vy;
        part.rotation += part.vRotation;
        part.alpha = 1 - part.life / part.maxLife;

        // Slight gravity on feathers/splashes
        if (part.type === 'feather') {
          part.vy += 0.05;
          part.vx *= 0.98;
        } else if (part.type === 'splash') {
          part.vy += 0.25; // heavier gravity
        }
      });

      s.particles = s.particles.filter((part) => part.life < part.maxLife);
    };

    const triggerSplash = (x: number, y: number) => {
      const s = stateRef.current;
      const splashCount = 20;
      for (let i = 0; i < splashCount; i++) {
        s.particles.push({
          x,
          y,
          vx: (Math.random() * 8 - 4),
          vy: -3 - Math.random() * 8,
          size: 4 + Math.random() * 8,
          alpha: 1,
          color: s.timeOfDay === 'night' ? '#1E3A8A' : '#7DD3FC',
          rotation: Math.random() * Math.PI,
          vRotation: (Math.random() * 0.2) - 0.1,
          type: 'splash',
          life: 0,
          maxLife: 30 + Math.random() * 20
        });
      }
    };

    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const s = stateRef.current;

      // Clear Canvas
      ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

      // 1. Draw Sky Background based on TimeOfDay
      const bgGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT);
      if (s.timeOfDay === 'day') {
        bgGrad.addColorStop(0, '#BAE6FD'); // sky light blue
        bgGrad.addColorStop(0.6, '#F0FDFA'); // warm white glow near horizon
        bgGrad.addColorStop(1, '#93C5FD'); // marine blue horizon
      } else if (s.timeOfDay === 'sunset') {
        bgGrad.addColorStop(0, '#4C1D95'); // sunset dark purple
        bgGrad.addColorStop(0.4, '#B91C1C'); // fiery red-orange
        bgGrad.addColorStop(0.7, '#F59E0B'); // golden yellow
        bgGrad.addColorStop(1, '#FEF3C7'); // warm glow
      } else { // night
        bgGrad.addColorStop(0, '#0F172A'); // deep slate
        bgGrad.addColorStop(0.6, '#1E293B'); // indigo
        bgGrad.addColorStop(1, '#0F172A'); // deep horizon
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

      // Draw Sun / Moon / Celestial bodies
      if (s.timeOfDay === 'day') {
        // Soft sun
        ctx.save();
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#FDE047';
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(V_WIDTH - 100, 110, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (s.timeOfDay === 'sunset') {
        // Red, setting sun half-sunk in horizon
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#EA580C';
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(V_WIDTH - 120, 220, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else { // night
        // Twinkling Stars
        ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 20; i++) {
          const starX = (Math.sin(i * 123.45) * 0.5 + 0.5) * V_WIDTH;
          const starY = (Math.cos(i * 543.21) * 0.5 + 0.5) * (V_HEIGHT - 200);
          // Simple blinking
          const starAlpha = 0.3 + 0.7 * Math.abs(Math.sin((s.frameCount + i * 15) * 0.05));
          ctx.globalAlpha = starAlpha;
          ctx.fillRect(starX, starY, 2, 2);
        }
        ctx.globalAlpha = 1.0;

        // Moon
        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#FEF08A';
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(V_WIDTH - 90, 90, 25, 0, Math.PI * 2);
        ctx.fill();
        // Moon shade for crescent look
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(V_WIDTH - 100, 90, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Clouds (slow background movement)
      ctx.fillStyle = s.timeOfDay === 'night' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.5)';
      const cloudLayers = [
        { x: 50, y: 80, r: 25 }, { x: 80, y: 75, r: 35 }, { x: 120, y: 80, r: 25 },
        { x: 300, y: 150, r: 30 }, { x: 330, y: 140, r: 40 }, { x: 370, y: 150, r: 30 }
      ];
      ctx.save();
      cloudLayers.forEach((c) => {
        let cx = (c.x - s.bgOffsetClouds + V_WIDTH) % V_WIDTH;
        ctx.beginPath();
        ctx.arc(cx, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        // Secondary overlap for tiling
        ctx.beginPath();
        ctx.arc(cx + V_WIDTH, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // 2. Draw Distant Dokdo Silhouettes (Dongdo and Seodo islands!)
      ctx.save();
      ctx.fillStyle = s.timeOfDay === 'day' ? '#3B82F6' : s.timeOfDay === 'sunset' ? '#1E1B4B' : '#0F172A';
      ctx.globalAlpha = s.timeOfDay === 'day' ? 0.25 : 0.4;
      
      const drawIsland = (offsetX: number) => {
        ctx.beginPath();
        // West Island (Seodo) shape: steep craggy peaks
        ctx.moveTo(offsetX - 220, V_HEIGHT - 75);
        ctx.quadraticCurveTo(offsetX - 170, V_HEIGHT - 200, offsetX - 140, V_HEIGHT - 210);
        ctx.lineTo(offsetX - 110, V_HEIGHT - 170);
        ctx.lineTo(offsetX - 80, V_HEIGHT - 190);
        ctx.lineTo(offsetX - 30, V_HEIGHT - 75);
        
        // East Island (Dongdo) shape: slightly flatter top, crater look
        ctx.moveTo(offsetX + 10, V_HEIGHT - 75);
        ctx.quadraticCurveTo(offsetX + 50, V_HEIGHT - 160, offsetX + 70, V_HEIGHT - 165);
        ctx.lineTo(offsetX + 110, V_HEIGHT - 150);
        ctx.quadraticCurveTo(offsetX + 140, V_HEIGHT - 140, offsetX + 180, V_HEIGHT - 75);
        ctx.fill();
      };
      
      // Infinite draw islands
      drawIsland(V_WIDTH / 2 - s.bgOffsetIslands);
      drawIsland(V_WIDTH / 2 - s.bgOffsetIslands + V_WIDTH);
      ctx.restore();

      // 3. Draw Back Waves Layer
      ctx.fillStyle = s.timeOfDay === 'day' ? '#1D4ED8' : s.timeOfDay === 'sunset' ? '#311042' : '#020617';
      ctx.beginPath();
      const waveAmp = 5;
      const waveFreq = 0.015;
      for (let x = 0; x <= V_WIDTH; x++) {
        const y = V_HEIGHT - 90 + Math.sin(x * waveFreq + s.frameCount * 0.04) * waveAmp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(V_WIDTH, V_HEIGHT);
      ctx.lineTo(0, V_HEIGHT);
      ctx.fill();

      // 4. Draw Collectibles (Fishes & Shields)
      s.collectibles.forEach((col) => {
        if (col.collected) return;
        const pulse = Math.sin(col.pulsePhase) * 3;

        ctx.save();
        ctx.translate(col.x, col.y + pulse);

        if (col.type === 'fish') {
          // Draw cute black-tailed gull's favorite anchovy (멸치)
          // Body
          ctx.fillStyle = '#94A3B8';
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          // Silver belly stripe
          ctx.fillStyle = '#E2E8F0';
          ctx.beginPath();
          ctx.ellipse(0, 2, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();

          // Tail fin
          ctx.fillStyle = '#64748B';
          ctx.beginPath();
          ctx.moveTo(-11, 0);
          ctx.lineTo(-17, -6);
          ctx.lineTo(-14, 0);
          ctx.lineTo(-17, 6);
          ctx.closePath();
          ctx.fill();

          // Eye
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(6, -1, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (col.type === 'shield') {
          // Draw glowing blue shield bubble with dynamic rotation
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#38BDF8';
          
          // Outer glass ring
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 13, 0, Math.PI * 2);
          ctx.stroke();

          // Inner glowing crystal
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.moveTo(0, -9);
          ctx.lineTo(8, -4);
          ctx.lineTo(8, 4);
          ctx.lineTo(0, 9);
          ctx.lineTo(-8, 4);
          ctx.lineTo(-8, -4);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(5, -2);
          ctx.lineTo(5, 2);
          ctx.lineTo(0, 6);
          ctx.lineTo(-5, 2);
          ctx.lineTo(-5, -2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      // 5. Draw Obstacles (Dokdo craggy rock pillars with sharp, jagged basalt formations!)
      s.obstacles.forEach((obs) => {
        ctx.save();

        // Rocks color: rich volcanic basalt gray with craggy highlights
        const rockBaseColor = s.timeOfDay === 'day' ? '#57534E' : s.timeOfDay === 'sunset' ? '#44403C' : '#1C1917';
        const rockShadowColor = s.timeOfDay === 'day' ? '#292524' : s.timeOfDay === 'sunset' ? '#1C1917' : '#0C0A09';
        const rockHighlightColor = s.timeOfDay === 'day' ? '#78716C' : s.timeOfDay === 'sunset' ? '#57534E' : '#292524';

        // Helper to generate sharp, craggy, jagged offsets for basalt rocks
        const getCraggyOffset = (seedVal: number) => {
          const wave1 = Math.sin(seedVal) * 15;
          const wave2 = Math.cos(seedVal * 2.8) * 8;
          // Absolute sine values create extremely sharp, needle-like cliff features (기암괴석)
          const sharpSpike = Math.abs(Math.sin(seedVal * 4.5)) * 8 - 4;
          return wave1 + wave2 + sharpSpike;
        };

        // TOP ROCK PILLAR
        ctx.fillStyle = rockBaseColor;
        ctx.strokeStyle = rockShadowColor;
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.moveTo(obs.x, 0);
        // craggy path generation based on seed (rockTypeTop)
        const topSegments = 6;
        for (let i = 0; i <= topSegments; i++) {
          const segmentY = (i / topSegments) * obs.topHeight;
          const seed = obs.rockTypeTop + i * 17;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === topSegments ? obs.x : obs.x + offset;
          ctx.lineTo(currentX, segmentY);
        }
        ctx.lineTo(obs.x + obs.width, obs.topHeight);
        for (let i = topSegments; i >= 0; i--) {
          const segmentY = (i / topSegments) * obs.topHeight;
          const seed = obs.rockTypeTop + i * 29 + 100;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === topSegments ? obs.x + obs.width : obs.x + obs.width + offset;
          ctx.lineTo(currentX, segmentY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw columnar joints (주상절리) vertical structural lines inside top rock
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 2;
        const columnCount = 2;
        for (let colIdx = 1; colIdx <= columnCount; colIdx++) {
          const innerXRatio = colIdx / (columnCount + 1);
          ctx.beginPath();
          for (let i = 0; i <= topSegments; i++) {
            const segmentY = (i / topSegments) * obs.topHeight;
            const seed = obs.rockTypeTop + i * 17 + colIdx * 50;
            const offset = getCraggyOffset(seed);
            const lineX = obs.x + obs.width * innerXRatio + offset * 0.7;
            if (i === 0) ctx.moveTo(lineX, segmentY);
            else ctx.lineTo(lineX, segmentY);
          }
          ctx.stroke();
        }

        // Draw craggy highlights on top rock
        ctx.strokeStyle = rockHighlightColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= topSegments; i++) {
          const segmentY = (i / topSegments) * obs.topHeight;
          const seed = obs.rockTypeTop + i * 17;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === topSegments ? obs.x : obs.x + offset;
          if (i === 0) ctx.moveTo(currentX, segmentY);
          else ctx.lineTo(currentX, segmentY);
        }
        ctx.stroke();

        // BOTTOM ROCK PILLAR
        const bottomYStart = V_HEIGHT - 75 - obs.bottomHeight;
        ctx.fillStyle = rockBaseColor;
        ctx.strokeStyle = rockShadowColor;
        ctx.lineWidth = 3.5;

        ctx.beginPath();
        ctx.moveTo(obs.x, V_HEIGHT - 75);
        const bottomSegments = 6;
        for (let i = 0; i <= bottomSegments; i++) {
          const segmentY = V_HEIGHT - 75 - (i / bottomSegments) * obs.bottomHeight;
          const seed = obs.rockTypeBottom + i * 31;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === bottomSegments ? obs.x : obs.x + offset;
          ctx.lineTo(currentX, segmentY);
        }
        ctx.lineTo(obs.x + obs.width, bottomYStart);
        for (let i = bottomSegments; i >= 0; i--) {
          const segmentY = V_HEIGHT - 75 - (i / bottomSegments) * obs.bottomHeight;
          const seed = obs.rockTypeBottom + i * 43 + 200;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === bottomSegments ? obs.x + obs.width : obs.x + obs.width + offset;
          ctx.lineTo(currentX, segmentY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw columnar joints (주상절리) vertical structural lines inside bottom rock
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 2;
        for (let colIdx = 1; colIdx <= columnCount; colIdx++) {
          const innerXRatio = colIdx / (columnCount + 1);
          ctx.beginPath();
          for (let i = 0; i <= bottomSegments; i++) {
            const segmentY = V_HEIGHT - 75 - (i / bottomSegments) * obs.bottomHeight;
            const seed = obs.rockTypeBottom + i * 31 + colIdx * 70;
            const offset = getCraggyOffset(seed);
            const lineX = obs.x + obs.width * innerXRatio + offset * 0.7;
            if (i === 0) ctx.moveTo(lineX, segmentY);
            else ctx.lineTo(lineX, segmentY);
          }
          ctx.stroke();
        }

        // Draw craggy highlights on bottom rock
        ctx.strokeStyle = rockHighlightColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i <= bottomSegments; i++) {
          const segmentY = V_HEIGHT - 75 - (i / bottomSegments) * obs.bottomHeight;
          const seed = obs.rockTypeBottom + i * 31;
          const offset = getCraggyOffset(seed);
          const currentX = i === 0 || i === bottomSegments ? obs.x : obs.x + offset;
          if (i === 0) ctx.moveTo(currentX, segmentY);
          else ctx.lineTo(currentX, segmentY);
        }
        ctx.stroke();

        // Draw lush Dokdo green moss / tiny pine tree clump on bottom rock flat ledge!
        if (s.timeOfDay !== 'night') {
          ctx.fillStyle = s.timeOfDay === 'day' ? '#15803D' : '#166534'; // beautiful deep green forest moss
          ctx.beginPath();
          ctx.arc(obs.x + obs.width / 2, bottomYStart + 2, 10, Math.PI, 0);
          ctx.arc(obs.x + obs.width / 2 - 8, bottomYStart + 3, 7, Math.PI, 0);
          ctx.arc(obs.x + obs.width / 2 + 8, bottomYStart + 3, 7, Math.PI, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      });

      // 6. Draw Gull (괭이갈매기 - Black-tailed Gull)
      ctx.save();
      // Translate to Gull location (Gull has constant virtual X of 100)
      ctx.translate(100, s.birdY);
      ctx.rotate(s.birdAngle);

      // Invincibility flashing feedback
      if (s.invincibilityFrames > 0 && Math.floor(s.invincibilityFrames / 3) % 2 === 0) {
        ctx.globalAlpha = 0.3;
      }

      // Draw active shield sphere surrounding the gull
      if (s.shieldActive) {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#38BDF8';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, s.birdRadius + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Dynamic skin coloring configurations
      const skinColor = s.selectedSkin.color;
      const beakColor = s.selectedSkin.beakColor;

      // Gull Wing (Back)
      ctx.fillStyle = s.selectedSkin.id === 'skin_default' ? '#64748B' : skinColor; // Grey wings on default
      ctx.save();
      ctx.translate(-5, -2);
      ctx.rotate(-s.wingAngle - 0.2);
      ctx.beginPath();
      ctx.ellipse(-12, -8, 22, 6, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Gull Tail (Typical black-tailed gull has a neat black band on its white tail!)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-26, -10);
      ctx.lineTo(-24, 6);
      ctx.closePath();
      ctx.fill();

      // Black band on the tail (Specific trait of 괭이갈매기!)
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.lineTo(-26, -10);
      ctx.lineTo(-24, 6);
      ctx.lineTo(-21, 2);
      ctx.closePath();
      ctx.fill();

      // Gull Body (Main plump body)
      ctx.fillStyle = '#FFFFFF';
      if (s.selectedSkin.id === 'skin_gold') ctx.fillStyle = '#FEF08A'; // Golden skin
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing (Front) - beautifully textured
      ctx.fillStyle = s.selectedSkin.id === 'skin_default' ? '#475569' : skinColor;
      ctx.save();
      ctx.translate(-3, 0);
      ctx.rotate(s.wingAngle);
      ctx.beginPath();
      ctx.ellipse(-8, -6, 20, 8, -Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Wing tips are typical black on black-tailed gull
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(-18, -10, 10, 4, -Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Gull Head (Cute round shape)
      ctx.fillStyle = s.selectedSkin.id === 'skin_gold' ? '#FEF08A' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(14, -6, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Cute Beak: Long yellow beak with a prominent RED dot on the tip (Highly biological detail of the black-tailed gull!)
      ctx.fillStyle = beakColor;
      ctx.beginPath();
      ctx.moveTo(21, -8);
      ctx.lineTo(33, -7);
      ctx.lineTo(20, -2);
      ctx.closePath();
      ctx.fill();

      // Black-tailed Gull beak details (Black band + Red tip)
      if (s.selectedSkin.id === 'skin_default' || s.selectedSkin.id === 'skin_guard') {
        // Red tip
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.moveTo(28, -7.5);
        ctx.lineTo(33, -7);
        ctx.lineTo(29, -4.5);
        ctx.closePath();
        ctx.fill();

        // Black stripe adjacent to red
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.moveTo(25, -7.8);
        ctx.lineTo(28, -7.5);
        ctx.lineTo(25, -4.2);
        ctx.closePath();
        ctx.fill();
      }

      // Eye (Black with shiny white speck)
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(14, -8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(15, -9, 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Red eye-ring (Typical of mature black-tailed gulls!)
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(14, -8, 2.5, 0, Math.PI * 2);
      ctx.stroke();

      // --- Draw Skin Accessories ---
      if (s.selectedSkin.accessory === 'sunglasses') {
        // Cool sunglasses
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.moveTo(10, -8);
        ctx.lineTo(19, -8);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(17, -7.5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glare on sunglasses
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, -9);
        ctx.lineTo(18, -7);
        ctx.stroke();
      } else if (s.selectedSkin.accessory === 'hat') {
        // Cute blue Dokdo guard cap (독도 의경 수호대 모자)
        ctx.fillStyle = '#1E3A8A'; // Navy blue guard hat
        ctx.beginPath();
        ctx.ellipse(12, -15, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Black visor/brim of the hat
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.ellipse(15, -14, 7, 1.5, Math.PI / 12, 0, Math.PI * 2);
        ctx.fill();

        // Little gold emblem/badge in center
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(12, -16, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (s.selectedSkin.accessory === 'crown') {
        // Golden royal crown
        ctx.fillStyle = '#FBBF24';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(7, -15);
        ctx.lineTo(6, -24);
        ctx.lineTo(11, -19);
        ctx.lineTo(14, -26);
        ctx.lineTo(17, -19);
        ctx.lineTo(22, -24);
        ctx.lineTo(21, -15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Small jewel beads
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(14, -26, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // 7. Draw Particles
      s.particles.forEach((part) => {
        ctx.save();
        ctx.globalAlpha = part.alpha;
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rotation);

        ctx.fillStyle = part.color;

        if (part.type === 'feather') {
          // Draw a curved elegant bird feather shape
          ctx.beginPath();
          ctx.ellipse(0, 0, part.size, part.size / 2.5, 0.2, 0, Math.PI * 2);
          ctx.fill();
          
          // Feather shaft line
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-part.size, 0);
          ctx.lineTo(part.size, 0);
          ctx.stroke();
        } else if (part.type === 'sparkle') {
          // 4-point glowing star
          ctx.beginPath();
          ctx.moveTo(0, -part.size);
          ctx.quadraticCurveTo(0, 0, part.size, 0);
          ctx.quadraticCurveTo(0, 0, 0, part.size);
          ctx.quadraticCurveTo(0, 0, -part.size, 0);
          ctx.quadraticCurveTo(0, 0, 0, -part.size);
          ctx.closePath();
          ctx.fill();
        } else if (part.type === 'splash' || part.type === 'bubble') {
          // Circular water splash or oxygen bubble
          ctx.beginPath();
          ctx.arc(0, 0, part.size, 0, Math.PI * 2);
          ctx.fill();

          if (part.type === 'bubble') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      // 8. Draw FRONT Waves (Faster parallax moving overlay)
      ctx.fillStyle = s.timeOfDay === 'day' ? '#2563EB' : s.timeOfDay === 'sunset' ? '#1D0E31' : '#020617';
      ctx.beginPath();
      const waveAmpFront = 8;
      const waveFreqFront = 0.02;
      for (let x = 0; x <= V_WIDTH; x++) {
        const y = V_HEIGHT - 75 + Math.sin(x * waveFreqFront + s.frameCount * 0.07) * waveAmpFront;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(V_WIDTH, V_HEIGHT);
      ctx.lineTo(0, V_HEIGHT);
      ctx.fill();

      // Foam tops on front wave
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      for (let x = 0; x <= V_WIDTH; x++) {
        const y = V_HEIGHT - 75 + Math.sin(x * waveFreqFront + s.frameCount * 0.07) * waveAmpFront;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y + 3);
      }
      ctx.lineTo(V_WIDTH, V_HEIGHT);
      ctx.lineTo(0, V_HEIGHT);
      ctx.fill();
    };

    const loop = () => {
      updatePhysics();
      drawGame();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, onScoreChange, onFishCollect, onGameOver, setShieldActive]);

  return (
    <div 
      ref={containerRef} 
      className="relative flex items-center justify-center w-full h-full select-none bg-slate-900 overflow-hidden"
    >
      <canvas
        id="game_canvas"
        ref={canvasRef}
        width={V_WIDTH}
        height={V_HEIGHT}
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
        }}
        className="block bg-slate-950 shadow-2xl rounded-lg touch-none outline-none border border-slate-700"
      />
    </div>
  );
};
export default GameCanvas;
