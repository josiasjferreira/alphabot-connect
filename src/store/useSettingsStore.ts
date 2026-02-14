import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  maxSpeed: number;
  ttsVolume: number;
  ttsRate: number;
  darkMode: boolean;
  setMaxSpeed: (v: number) => void;
  setTtsVolume: (v: number) => void;
  setTtsRate: (v: number) => void;
  setDarkMode: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      maxSpeed: 50,
      ttsVolume: 0.8,
      ttsRate: 1.0,
      darkMode: false,
      setMaxSpeed: (maxSpeed) => set({ maxSpeed }),
      setTtsVolume: (ttsVolume) => set({ ttsVolume }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setDarkMode: (darkMode) => set({ darkMode }),
    }),
    { name: 'alphabot-settings' }
  )
);
