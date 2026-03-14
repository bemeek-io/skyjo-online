import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../store';
import styles from './MusicPlayer.module.css';

// Original 8-bit style chiptune music generator
function createChiptuneMusic(audioContext: AudioContext, masterGain: GainNode): { start: () => void; stop: () => void } {
  let isRunning = false;
  let schedulerId: number | null = null;
  
  // Note frequencies
  const N: Record<string, number> = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50,
  };
  
  // Section A - Upbeat and bouncy
  const melodyA = [
    'G4', null, 'A4', 'B4', 'D5', null, 'B4', null,
    'A4', null, 'G4', null, 'E4', null, 'D4', null,
    'E4', null, 'G4', null, 'A4', null, 'B4', 'A4',
    'G4', null, null, null, 'D4', null, null, null,
  ];
  
  // Section B - Rising tension
  const melodyB = [
    'E5', null, 'D5', null, 'C5', null, 'B4', null,
    'C5', null, 'D5', null, 'E5', null, 'G5', null,
    'A5', null, 'G5', null, 'E5', null, 'D5', null,
    'C5', 'B4', 'A4', 'B4', 'C5', null, null, null,
  ];
  
  // Section C - Funky groove
  const melodyC = [
    'D5', 'D5', null, 'E5', 'D5', null, 'B4', null,
    'G4', null, 'A4', null, 'B4', null, 'D5', null,
    'E5', null, 'D5', 'C5', 'B4', null, 'A4', null,
    'G4', null, 'B4', null, 'D5', null, null, null,
  ];
  
  // Section D - Calm bridge
  const melodyD = [
    'G5', null, null, 'E5', null, null, 'C5', null,
    null, null, 'D5', null, 'E5', null, null, null,
    'F5', null, null, 'D5', null, null, 'B4', null,
    null, null, 'C5', null, 'D5', null, null, null,
  ];
  
  const melodies = [melodyA, melodyA, melodyB, melodyC, melodyA, melodyB, melodyD, melodyC];
  
  // Bass patterns
  const bassA = ['G3', null, null, null, 'G3', null, 'D3', null, 'E3', null, null, null, 'E3', null, 'B3', null,
                 'C4', null, null, null, 'C4', null, 'G3', null, 'D3', null, null, null, 'D3', null, null, null];
  const bassB = ['C4', null, null, null, 'G3', null, null, null, 'A3', null, null, null, 'E3', null, null, null,
                 'F3', null, null, null, 'C4', null, null, null, 'G3', null, 'A3', null, 'B3', null, 'C4', null];
  const bassC = ['G3', null, 'G3', null, 'G3', null, null, null, 'E3', null, 'E3', null, 'G3', null, null, null,
                 'A3', null, 'A3', null, 'G3', null, null, null, 'D3', null, 'E3', null, 'G3', null, null, null];
  const bassD = ['C4', null, null, null, null, null, null, null, 'G3', null, null, null, null, null, null, null,
                 'F3', null, null, null, null, null, null, null, 'G3', null, null, null, null, null, null, null];
  
  const basses = [bassA, bassA, bassB, bassC, bassA, bassB, bassD, bassC];
  
  // Arpeggios for each section
  const arpA = ['G4', 'B4', 'D5', 'B4'];
  const arpB = ['C5', 'E5', 'G5', 'E5'];
  const arpC = ['G4', 'B4', 'D5', 'G5'];
  const arpD = ['C5', 'E5', 'G5', 'C6'];
  
  const arps = [arpA, arpA, arpB, arpC, arpA, arpB, arpD, arpC];
  
  let step = 0;
  let section = 0;
  let arpStep = 0;
  const tempo = 128;
  const stepTime = (60 / tempo) / 4;
  
  const playNote = (type: OscillatorType, freq: number, duration: number, volume: number, startTime: number) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.setValueAtTime(volume * 0.7, startTime + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    osc.connect(gain);
    gain.connect(masterGain); // Connect to master gain instead of destination
    
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  };
  
  const playNoise = (duration: number, volume: number, startTime: number, highpass: number) => {
    const bufferSize = audioContext.sampleRate * duration;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpass, startTime);
    
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain); // Connect to master gain instead of destination
    
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    noise.start(startTime);
    noise.stop(startTime + duration);
  };

  const scheduleNotes = () => {
    const currentTime = audioContext.currentTime;
    const nextTime = currentTime + 0.05;
    
    const melody = melodies[section];
    const bass = basses[section];
    const arp = arps[section];
    const localStep = step % 32;
    
    // Melody
    const melodyNote = melody[localStep];
    if (melodyNote && N[melodyNote]) {
      playNote('square', N[melodyNote], stepTime * 0.85, 0.07, nextTime);
    }
    
    // Bass
    const bassNote = bass[localStep];
    if (bassNote && N[bassNote]) {
      playNote('triangle', N[bassNote], stepTime * 1.8, 0.1, nextTime);
    }
    
    // Arpeggio (every other step, quieter)
    if (localStep % 2 === 0) {
      const arpNote = arp[arpStep % arp.length];
      if (N[arpNote]) {
        playNote('square', N[arpNote], stepTime * 0.25, 0.02, nextTime);
      }
      arpStep++;
    }
    
    // Drums - kick on 1 and 3, hi-hat on 2 and 4
    if (localStep % 8 === 0) {
      // Kick drum
      const kickOsc = audioContext.createOscillator();
      const kickGain = audioContext.createGain();
      kickOsc.connect(kickGain);
      kickGain.connect(masterGain); // Connect to master gain instead of destination
      kickOsc.frequency.setValueAtTime(150, nextTime);
      kickOsc.frequency.exponentialRampToValueAtTime(40, nextTime + 0.1);
      kickGain.gain.setValueAtTime(0.15, nextTime);
      kickGain.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.15);
      kickOsc.start(nextTime);
      kickOsc.stop(nextTime + 0.15);
    }
    
    if (localStep % 4 === 2) {
      // Snare-ish
      playNoise(0.08, 0.05, nextTime, 3000);
    }
    
    if (localStep % 2 === 1) {
      // Hi-hat
      playNoise(0.03, 0.02, nextTime, 8000);
    }
    
    step++;
    
    // Change section every 32 steps
    if (step % 32 === 0) {
      section = (section + 1) % melodies.length;
      arpStep = 0;
    }
  };

  return {
    start: () => {
      if (isRunning) return;
      isRunning = true;
      step = 0;
      section = 0;
      arpStep = 0;
      
      schedulerId = window.setInterval(scheduleNotes, stepTime * 1000);
    },
    stop: () => {
      isRunning = false;
      if (schedulerId !== null) {
        clearInterval(schedulerId);
        schedulerId = null;
      }
    }
  };
}

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const musicRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  
  // Get game state to check if we're in a game
  const view = useGameStore(state => state.view);
  const gamePhase = useGameStore(state => state.gameState?.phase);
  
  // Lower music volume during gameplay
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const isInGame = view === 'game' && gamePhase && gamePhase !== 'waiting';
      const targetVolume = isInGame ? 0.25 : 1.0; // 25% volume during game
      
      // Smooth transition
      masterGainRef.current.gain.setTargetAtTime(
        targetVolume, 
        audioContextRef.current.currentTime, 
        0.3 // Time constant for smooth transition
      );
    }
  }, [view, gamePhase]);

  const startMusic = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      
      // Create master gain node
      masterGainRef.current = audioContextRef.current.createGain();
      masterGainRef.current.connect(audioContextRef.current.destination);
      masterGainRef.current.gain.value = 1.0;
      
      musicRef.current = createChiptuneMusic(audioContextRef.current, masterGainRef.current);
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    musicRef.current?.start();
    setIsPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      musicRef.current?.stop();
      setIsPlaying(false);
    } else {
      startMusic();
    }
  }, [isPlaying, startMusic]);

  // Auto-start music on first user interaction with the page
  useEffect(() => {
    if (hasStarted) return;
    
    const handleFirstInteraction = () => {
      if (!hasStarted) {
        setHasStarted(true);
        startMusic();
        // Remove listeners after first interaction
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
      }
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [hasStarted, startMusic]);

  useEffect(() => {
    return () => {
      musicRef.current?.stop();
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className={styles.container}>
      <button 
        className={`${styles.musicBtn} ${isPlaying ? styles.playing : ''}`}
        onClick={togglePlay}
        title={isPlaying ? 'Pause music' : 'Play music'}
      >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="currentColor"
        >
          {isPlaying ? (
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          ) : (
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          )}
        </svg>
      </button>
    </div>
  );
}
