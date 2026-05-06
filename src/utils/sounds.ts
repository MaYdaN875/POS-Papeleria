import { getGlobalSettings } from '../services/settingsService';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export const playBeep = async () => {
  const settingsRes = await getGlobalSettings();
  if (settingsRes.ok && settingsRes.settings && !settingsRes.settings.enableSounds) {
    return;
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // 800Hz beep
  
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
};

export const playCashSound = async () => {
  const settingsRes = await getGlobalSettings();
  if (settingsRes.ok && settingsRes.settings && !settingsRes.settings.enableSounds) {
    return;
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  // A very synthesized version of a "Cha-ching" using two oscillators
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc1.type = 'square';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(1200, audioCtx.currentTime);
  osc1.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
  
  osc2.frequency.setValueAtTime(1500, audioCtx.currentTime + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc1.start(audioCtx.currentTime);
  osc1.stop(audioCtx.currentTime + 0.1);
  
  osc2.start(audioCtx.currentTime + 0.1);
  osc2.stop(audioCtx.currentTime + 0.4);
};
