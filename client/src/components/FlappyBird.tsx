import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================
// GAME CONSTANTS - Tunable physics & difficulty
// ============================================
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;

// Bird physics
const GRAVITY = 0.5;           // Pixels per frame squared
const FLAP_IMPULSE = -8;       // Upward velocity on flap
const TERMINAL_VELOCITY = 12;  // Max falling speed
const BIRD_X = 80;             // Fixed horizontal position
const BIRD_RADIUS = 15;        // Bird hitbox radius

// Pipe settings
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;          // Vertical gap between top and bottom pipes
const PIPE_SPEED = 3;          // Horizontal movement speed
const PIPE_SPAWN_INTERVAL = 1600; // Milliseconds between pipe spawns
const MIN_PIPE_HEIGHT = 80;    // Minimum pipe height from top/bottom

// Ground
const GROUND_HEIGHT = 80;

// Colors
const SKY_GRADIENT_TOP = '#87CEEB';
const SKY_GRADIENT_BOTTOM = '#E0F6FF';
const GROUND_COLOR = '#DEB887';
const GROUND_GRASS_COLOR = '#228B22';
const PIPE_COLOR = '#228B22';
const PIPE_CAP_COLOR = '#2E8B2E';
const BIRD_BODY_COLOR = '#FFD700';
const BIRD_WING_COLOR = '#FFA500';
const BIRD_EYE_COLOR = '#000000';
const BIRD_BEAK_COLOR = '#FF6347';

// ============================================
// TYPES
// ============================================
type GameState = 'ready' | 'playing' | 'gameover';

interface Bird {
  y: number;
  velocity: number;
  rotation: number;
}

interface Pipe {
  x: number;
  gapY: number; // Center of the gap
  passed: boolean;
  id: number;
}

// ============================================
// AUDIO MANAGER - Web Audio API sounds
// ============================================
class AudioManager {
  private audioContext: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    const savedMute = localStorage.getItem('flappybird_muted');
    this.isMuted = savedMute === 'true';
  }

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('flappybird_muted', String(this.isMuted));
    return this.isMuted;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (this.isMuted) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio playback failed:', e);
    }
  }

  playFlap() {
    this.playTone(400, 0.1, 'sine', 0.2);
  }

  playScore() {
    if (this.isMuted) return;
    
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // Two-tone ding
      [523.25, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.3, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.2);
      });
    } catch (e) {
      console.log('Audio playback failed:', e);
    }
  }

  playHit() {
    this.playTone(200, 0.15, 'square', 0.3);
  }

  playDie() {
    if (this.isMuted) return;
    
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // Descending tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.5);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      console.log('Audio playback failed:', e);
    }
  }
}

// ============================================
// FLAPPY BIRD COMPONENT
// ============================================
export default function FlappyBird() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState>('ready');
  const birdRef = useRef<Bird>({ y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(0);
  const groundOffsetRef = useRef(0);
  const lastPipeSpawnRef = useRef(0);
  const pipeIdRef = useRef(0);
  const audioRef = useRef<AudioManager | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const hasHitRef = useRef(false);

  const [, forceUpdate] = useState({});
  const [isMuted, setIsMuted] = useState(false);
  const [scale, setScale] = useState(1);

  // Initialize
  useEffect(() => {
    audioRef.current = new AudioManager();
    setIsMuted(audioRef.current.getMuted());
    
    const savedBest = localStorage.getItem('flappybird_best');
    if (savedBest) {
      bestScoreRef.current = parseInt(savedBest, 10);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Handle window resize for responsive scaling
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const scaleX = containerWidth / CANVAS_WIDTH;
        const scaleY = containerHeight / CANVAS_HEIGHT;
        setScale(Math.min(scaleX, scaleY, 1.5));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset game state
  const resetGame = useCallback(() => {
    birdRef.current = { y: CANVAS_HEIGHT / 2, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    scoreRef.current = 0;
    groundOffsetRef.current = 0;
    lastPipeSpawnRef.current = 0;
    pipeIdRef.current = 0;
    hasHitRef.current = false;
  }, []);

  // Flap action
  const flap = useCallback(() => {
    if (gameStateRef.current === 'ready') {
      gameStateRef.current = 'playing';
      resetGame();
      lastTimeRef.current = performance.now();
      forceUpdate({});
    }
    
    if (gameStateRef.current === 'playing') {
      birdRef.current.velocity = FLAP_IMPULSE;
      audioRef.current?.playFlap();
    }
    
    if (gameStateRef.current === 'gameover') {
      gameStateRef.current = 'ready';
      resetGame();
      forceUpdate({});
    }
  }, [resetGame]);

  // Handle input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        flap();
      }
    };

    const handleClick = () => {
      flap();
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      flap();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('touchstart', handleTouch, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [flap]);

  // Check collision between bird and pipes/ground
  const checkCollision = useCallback((bird: Bird, pipes: Pipe[]): boolean => {
    const birdTop = bird.y - BIRD_RADIUS;
    const birdBottom = bird.y + BIRD_RADIUS;
    const birdLeft = BIRD_X - BIRD_RADIUS;
    const birdRight = BIRD_X + BIRD_RADIUS;

    // Check ground collision
    if (birdBottom >= CANVAS_HEIGHT - GROUND_HEIGHT) {
      return true;
    }

    // Check ceiling collision
    if (birdTop <= 0) {
      return true;
    }

    // Check pipe collisions
    for (const pipe of pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;

      // Check if bird is within pipe's horizontal range
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        const gapTop = pipe.gapY - PIPE_GAP / 2;
        const gapBottom = pipe.gapY + PIPE_GAP / 2;

        // Check if bird is outside the gap
        if (birdTop < gapTop || birdBottom > gapBottom) {
          return true;
        }
      }
    }

    return false;
  }, []);

  // Draw functions
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D) => {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT - GROUND_HEIGHT);
    gradient.addColorStop(0, SKY_GRADIENT_TOP);
    gradient.addColorStop(1, SKY_GRADIENT_BOTTOM);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const drawCloud = (x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.arc(x + size, y - size * 0.3, size * 0.8, 0, Math.PI * 2);
      ctx.arc(x + size * 1.8, y, size * 0.9, 0, Math.PI * 2);
      ctx.fill();
    };
    drawCloud(50, 100, 25);
    drawCloud(250, 60, 20);
    drawCloud(350, 120, 22);
  }, []);

  const drawGround = useCallback((ctx: CanvasRenderingContext2D) => {
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
    
    // Grass strip
    ctx.fillStyle = GROUND_GRASS_COLOR;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, 15);

    // Ground
    ctx.fillStyle = GROUND_COLOR;
    ctx.fillRect(0, groundY + 15, CANVAS_WIDTH, GROUND_HEIGHT - 15);

    // Scrolling ground pattern
    ctx.strokeStyle = '#C4A574';
    ctx.lineWidth = 2;
    const offset = groundOffsetRef.current % 40;
    for (let x = -offset; x < CANVAS_WIDTH + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 30);
      ctx.lineTo(x + 20, groundY + 50);
      ctx.stroke();
    }
  }, []);

  const drawPipe = useCallback((ctx: CanvasRenderingContext2D, pipe: Pipe) => {
    const gapTop = pipe.gapY - PIPE_GAP / 2;
    const gapBottom = pipe.gapY + PIPE_GAP / 2;
    const capHeight = 25;
    const capOverhang = 5;

    // Top pipe body
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(pipe.x, 0, PIPE_WIDTH, gapTop - capHeight);

    // Top pipe cap
    ctx.fillStyle = PIPE_CAP_COLOR;
    ctx.fillRect(pipe.x - capOverhang, gapTop - capHeight, PIPE_WIDTH + capOverhang * 2, capHeight);

    // Top pipe highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(pipe.x + 5, 0, 10, gapTop - capHeight);

    // Bottom pipe body
    ctx.fillStyle = PIPE_COLOR;
    ctx.fillRect(pipe.x, gapBottom + capHeight, PIPE_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT - gapBottom - capHeight);

    // Bottom pipe cap
    ctx.fillStyle = PIPE_CAP_COLOR;
    ctx.fillRect(pipe.x - capOverhang, gapBottom, PIPE_WIDTH + capOverhang * 2, capHeight);

    // Bottom pipe highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(pipe.x + 5, gapBottom + capHeight, 10, CANVAS_HEIGHT - GROUND_HEIGHT - gapBottom - capHeight);
  }, []);

  const drawBird = useCallback((ctx: CanvasRenderingContext2D, bird: Bird) => {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rotation);

    // Body
    ctx.fillStyle = BIRD_BODY_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, BIRD_RADIUS, BIRD_RADIUS * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = BIRD_WING_COLOR;
    ctx.beginPath();
    ctx.ellipse(-3, 3, BIRD_RADIUS * 0.5, BIRD_RADIUS * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(6, -4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BIRD_EYE_COLOR;
    ctx.beginPath();
    ctx.arc(7, -4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = BIRD_BEAK_COLOR;
    ctx.beginPath();
    ctx.moveTo(BIRD_RADIUS - 2, -2);
    ctx.lineTo(BIRD_RADIUS + 10, 2);
    ctx.lineTo(BIRD_RADIUS - 2, 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }, []);

  const drawScore = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    const scoreText = String(scoreRef.current);
    ctx.strokeText(scoreText, CANVAS_WIDTH / 2, 60);
    ctx.fillText(scoreText, CANVAS_WIDTH / 2, 60);
  }, []);

  const drawReadyScreen = useCallback((ctx: CanvasRenderingContext2D) => {
    // Title
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText('Flappy Bird', CANVAS_WIDTH / 2, 150);
    ctx.fillText('Flappy Bird', CANVAS_WIDTH / 2, 150);

    // Instructions
    ctx.font = 'bold 20px Arial';
    ctx.lineWidth = 2;
    ctx.strokeText('Tap or Press Space to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
    ctx.fillText('Tap or Press Space to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);

    // Draw bird preview
    drawBird(ctx, { y: CANVAS_HEIGHT / 2 - 30, velocity: 0, rotation: 0 });
  }, [drawBird]);

  const drawGameOver = useCallback((ctx: CanvasRenderingContext2D) => {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Game Over panel
    ctx.fillStyle = '#DEB887';
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    const panelX = CANVAS_WIDTH / 2 - 120;
    const panelY = CANVAS_HEIGHT / 2 - 100;
    ctx.fillRect(panelX, panelY, 240, 200);
    ctx.strokeRect(panelX, panelY, 240, 200);

    // Game Over text
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', CANVAS_WIDTH / 2, panelY + 45);

    // Score
    ctx.fillStyle = 'black';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Score: ' + scoreRef.current, CANVAS_WIDTH / 2, panelY + 90);

    // Best score
    ctx.fillText('Best: ' + bestScoreRef.current, CANVAS_WIDTH / 2, panelY + 120);

    // Restart instruction
    ctx.font = '16px Arial';
    ctx.fillText('Tap or Press Space to Retry', CANVAS_WIDTH / 2, panelY + 170);
  }, []);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    ctx.scale(dpr, dpr);

    const gameLoop = (currentTime: number) => {
      const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 16.67 : 1;
      lastTimeRef.current = currentTime;

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background
      drawBackground(ctx);

      // Update and draw based on game state
      if (gameStateRef.current === 'playing') {
        // Update ground scroll
        groundOffsetRef.current += PIPE_SPEED * deltaTime;

        // Update bird physics
        const bird = birdRef.current;
        bird.velocity += GRAVITY * deltaTime;
        bird.velocity = Math.min(bird.velocity, TERMINAL_VELOCITY);
        bird.y += bird.velocity * deltaTime;

        // Update bird rotation based on velocity
        const targetRotation = Math.min(Math.max(bird.velocity * 0.05, -0.5), Math.PI / 2);
        bird.rotation += (targetRotation - bird.rotation) * 0.1;

        // Spawn pipes
        if (currentTime - lastPipeSpawnRef.current > PIPE_SPAWN_INTERVAL) {
          const minGapY = MIN_PIPE_HEIGHT + PIPE_GAP / 2;
          const maxGapY = CANVAS_HEIGHT - GROUND_HEIGHT - MIN_PIPE_HEIGHT - PIPE_GAP / 2;
          const gapY = minGapY + Math.random() * (maxGapY - minGapY);
          
          pipesRef.current.push({
            x: CANVAS_WIDTH,
            gapY,
            passed: false,
            id: pipeIdRef.current++
          });
          lastPipeSpawnRef.current = currentTime;
        }

        // Update pipes
        const pipes = pipesRef.current;
        for (let i = pipes.length - 1; i >= 0; i--) {
          const pipe = pipes[i];
          pipe.x -= PIPE_SPEED * deltaTime;

          // Check if bird passed the pipe
          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            scoreRef.current++;
            audioRef.current?.playScore();

            // Update best score
            if (scoreRef.current > bestScoreRef.current) {
              bestScoreRef.current = scoreRef.current;
              localStorage.setItem('flappybird_best', String(bestScoreRef.current));
            }
          }

          // Remove off-screen pipes
          if (pipe.x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
          }
        }

        // Check collision
        if (!hasHitRef.current && checkCollision(bird, pipes)) {
          hasHitRef.current = true;
          audioRef.current?.playHit();
          setTimeout(() => {
            audioRef.current?.playDie();
            gameStateRef.current = 'gameover';
            forceUpdate({});
          }, 100);
        }

        // Draw pipes
        for (const pipe of pipes) {
          drawPipe(ctx, pipe);
        }

        // Draw bird
        drawBird(ctx, bird);

        // Draw score
        drawScore(ctx);
      } else if (gameStateRef.current === 'ready') {
        // Draw ready screen
        drawReadyScreen(ctx);
      } else if (gameStateRef.current === 'gameover') {
        // Draw final state
        for (const pipe of pipesRef.current) {
          drawPipe(ctx, pipe);
        }
        drawBird(ctx, birdRef.current);
        drawGameOver(ctx);
      }

      // Draw ground (always on top of pipes)
      drawGround(ctx);

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawBackground, drawGround, drawPipe, drawBird, drawScore, drawReadyScreen, drawGameOver, checkCollision]);

  // Toggle mute
  const handleMuteToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      const newMuted = audioRef.current.toggleMute();
      setIsMuted(newMuted);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: CANVAS_WIDTH * scale,
          height: CANVAS_HEIGHT * scale,
          imageRendering: 'pixelated',
          borderRadius: 8,
          boxShadow: '0 0 30px rgba(0,0,0,0.5)'
        }}
      />
      <button
        onClick={handleMuteToggle}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
