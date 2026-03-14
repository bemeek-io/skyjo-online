// Sound effects using Web Audio API - no external files needed

type SoundType = 
  | 'cardFlip' 
  | 'cardDraw' 
  | 'cardSwap' 
  | 'columnClear' 
  | 'turnStart' 
  | 'roundEnd' 
  | 'gameOver'
  | 'error'
  | 'reaction'
  | 'lastRoundTrigger';

let audioContext: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  if (!soundEnabled) return;
  
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available
  }
}

function playSequence(notes: { freq: number; dur: number; delay: number }[], type: OscillatorType = 'sine', volume = 0.3) {
  notes.forEach(({ freq, dur, delay }) => {
    setTimeout(() => playTone(freq, dur, type, volume), delay * 1000);
  });
}

export function playSound(sound: SoundType) {
  switch (sound) {
    case 'cardFlip':
      // Quick pop sound
      playTone(800, 0.08, 'square', 0.15);
      setTimeout(() => playTone(1200, 0.05, 'square', 0.1), 30);
      break;
      
    case 'cardDraw':
      // Swoosh-like sound
      playTone(400, 0.1, 'triangle', 0.2);
      setTimeout(() => playTone(600, 0.08, 'triangle', 0.15), 50);
      break;
      
    case 'cardSwap':
      // Double click
      playTone(600, 0.06, 'square', 0.15);
      setTimeout(() => playTone(800, 0.06, 'square', 0.12), 60);
      break;
      
    case 'columnClear':
      // Celebratory ascending notes
      playSequence([
        { freq: 523, dur: 0.1, delay: 0 },    // C5
        { freq: 659, dur: 0.1, delay: 0.08 }, // E5
        { freq: 784, dur: 0.1, delay: 0.16 }, // G5
        { freq: 1047, dur: 0.2, delay: 0.24 } // C6
      ], 'triangle', 0.25);
      break;
      
    case 'turnStart':
      // Attention-getting chime
      playTone(880, 0.15, 'sine', 0.2);
      setTimeout(() => playTone(1100, 0.12, 'sine', 0.18), 100);
      break;
      
    case 'roundEnd':
      // Fanfare
      playSequence([
        { freq: 392, dur: 0.15, delay: 0 },    // G4
        { freq: 523, dur: 0.15, delay: 0.12 }, // C5
        { freq: 659, dur: 0.15, delay: 0.24 }, // E5
        { freq: 784, dur: 0.3, delay: 0.36 }   // G5
      ], 'triangle', 0.3);
      break;
      
    case 'gameOver':
      // Victory fanfare
      playSequence([
        { freq: 523, dur: 0.2, delay: 0 },     // C5
        { freq: 659, dur: 0.2, delay: 0.15 },  // E5
        { freq: 784, dur: 0.2, delay: 0.3 },   // G5
        { freq: 1047, dur: 0.4, delay: 0.45 }, // C6
      ], 'triangle', 0.35);
      break;
      
    case 'error':
      // Low buzz
      playTone(200, 0.15, 'sawtooth', 0.2);
      break;
      
    case 'reaction':
      // Soft pop
      playTone(600, 0.06, 'sine', 0.15);
      break;
      
    case 'lastRoundTrigger':
      // Dramatic warning sound - descending then ascending
      playSequence([
        { freq: 880, dur: 0.15, delay: 0 },     // A5
        { freq: 784, dur: 0.15, delay: 0.12 },  // G5
        { freq: 659, dur: 0.15, delay: 0.24 },  // E5
        { freq: 784, dur: 0.2, delay: 0.4 },    // G5
        { freq: 880, dur: 0.3, delay: 0.55 },   // A5
      ], 'square', 0.25);
      break;
  }
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function getSoundEnabled(): boolean {
  return soundEnabled;
}

// Initialize audio context on first user interaction
export function initAudio() {
  const ctx = getAudioContext();
  // Resume context if suspended (required by browsers)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

