import { useState } from 'react';
import { type UserProfile, type UnitSystem } from '../data/profile';

interface ProfileScreenProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}

export default function ProfileScreen({ profile, onSave, onClose }: ProfileScreenProps) {
  const [name, setName] = useState(profile.name);
  const [units, setUnits] = useState<UnitSystem>(profile.units);
  const [leftHanded, setLeftHanded] = useState(profile.leftHanded);

  const handleSave = () => {
    onSave({ name: name.trim(), units, leftHanded });
    onClose();
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-dark-text tracking-widest uppercase">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full bg-dark-card border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-dark-text/50 outline-none focus:border-gold/50 transition-colors"
        />
      </div>

      {/* Units */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-dark-text tracking-widest uppercase">
          Units
        </label>
        <div className="flex rounded-lg overflow-hidden border border-dark-border">
          <button
            onClick={() => setUnits('imperial')}
            className={`flex-1 py-2.5 text-xs tracking-wider transition-colors cursor-pointer ${
              units === 'imperial'
                ? 'bg-gold/20 text-gold'
                : 'bg-dark-card text-dark-text'
            }`}
          >
            Yards / MPH
          </button>
          <button
            onClick={() => setUnits('metric')}
            className={`flex-1 py-2.5 text-xs tracking-wider transition-colors cursor-pointer ${
              units === 'metric'
                ? 'bg-gold/20 text-gold'
                : 'bg-dark-card text-dark-text'
            }`}
          >
            Metres / KM/H
          </button>
        </div>
        <div className="text-[10px] text-dark-text/60">
          {units === 'imperial'
            ? 'Distances in yards, speeds in mph'
            : 'Distances in metres, speeds in km/h'}
        </div>
      </div>

      {/* Handedness */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-dark-text tracking-widest uppercase">
          Swing
        </label>
        <div className="flex rounded-lg overflow-hidden border border-dark-border">
          <button
            onClick={() => setLeftHanded(false)}
            className={`flex-1 py-2.5 text-xs tracking-wider transition-colors cursor-pointer ${
              !leftHanded
                ? 'bg-gold/20 text-gold'
                : 'bg-dark-card text-dark-text'
            }`}
          >
            Right-Handed
          </button>
          <button
            onClick={() => setLeftHanded(true)}
            className={`flex-1 py-2.5 text-xs tracking-wider transition-colors cursor-pointer ${
              leftHanded
                ? 'bg-gold/20 text-gold'
                : 'bg-dark-card text-dark-text'
            }`}
          >
            Left-Handed
          </button>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full py-3 bg-gold/20 border border-gold/40 rounded-lg text-gold text-sm font-semibold tracking-wider uppercase hover:bg-gold/30 transition-colors cursor-pointer"
      >
        Save
      </button>
    </div>
  );
}
