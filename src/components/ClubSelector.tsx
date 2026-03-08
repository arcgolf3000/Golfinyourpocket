import { CLUBS, type ClubData } from '../data/clubs';

interface ClubSelectorProps {
  selected: string;
  onSelect: (key: string) => void;
}

export default function ClubSelector({ selected, onSelect }: ClubSelectorProps) {
  return (
    <div className="flex gap-1.5 flex-wrap justify-center">
      {CLUBS.map((club: ClubData) => (
        <button
          key={club.key}
          onClick={() => onSelect(club.key)}
          className={`px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-all cursor-pointer
            ${selected === club.key
              ? 'bg-gold text-dark-bg shadow-[0_0_12px_rgba(255,204,51,0.3)]'
              : 'bg-dark-card text-dark-text border border-dark-border hover:border-gold-dim hover:text-white'
            }`}
        >
          {club.name}
        </button>
      ))}
    </div>
  );
}
