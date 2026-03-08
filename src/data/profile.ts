export type UnitSystem = 'imperial' | 'metric';

export interface UserProfile {
  name: string;
  units: UnitSystem;
  leftHanded: boolean;
}

const STORAGE_KEY = 'arc-profile';

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  units: 'imperial',
  leftHanded: false,
};

export function loadProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PROFILE, ...parsed };
    }
  } catch { /* ignore */ }

  // Migrate legacy leftHanded setting
  const legacyLH = localStorage.getItem('arc-left-handed');
  if (legacyLH === 'true') {
    const profile = { ...DEFAULT_PROFILE, leftHanded: true };
    saveProfile(profile);
    localStorage.removeItem('arc-left-handed');
    return profile;
  }

  return DEFAULT_PROFILE;
}

export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch { /* ignore quota */ }
}

// Unit conversion helpers
const YARDS_TO_METRES = 0.9144;
const MPH_TO_KMH = 1.60934;

export function distStr(yards: number, units: UnitSystem): string {
  if (units === 'metric') {
    return String(Math.round(yards * YARDS_TO_METRES));
  }
  return String(yards);
}

export function distUnit(units: UnitSystem): string {
  return units === 'metric' ? 'm' : 'yds';
}

export function speedStr(mph: number, units: UnitSystem): string {
  if (units === 'metric') {
    return (mph * MPH_TO_KMH).toFixed(1);
  }
  return mph.toFixed(1);
}

export function speedUnit(units: UnitSystem): string {
  return units === 'metric' ? 'km/h' : 'mph';
}

export function setupDistStr(feet: number, units: UnitSystem): string {
  if (units === 'metric') {
    return `${(feet * 0.3048).toFixed(1)} m`;
  }
  return `${feet} ft`;
}
