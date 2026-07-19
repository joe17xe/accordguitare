import type { Lang } from '../i18n';

interface AppBarProps {
  lang: Lang;
  subtitle: string;
  onChangeLang: (lang: Lang) => void;
  className?: string;
}

/**
 * Barre d'application mobile (< 768px) : wordmark FRETBYW00D (OO émeraude),
 * sous-titre contextuel et pastille bilingue FR | EN.
 */
export function AppBar({ lang, subtitle, onChangeLang, className = '' }: AppBarProps) {
  return (
    <header
      className={`flex h-13 items-center justify-between ${className}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex flex-col">
        <span className="text-[17px] font-extrabold tracking-[0.3px] text-ink">
          FRETBYW<span className="text-guitar">OO</span>D
        </span>
        <span className="text-[9px] font-medium tracking-[0.3px] text-ink-4">{subtitle}</span>
      </div>

      <div
        className="flex rounded-full border border-white/9 bg-white/6 p-0.5"
        role="group"
        aria-label="Langue / Language"
      >
        {(['fr', 'en'] as Lang[]).map((code) => {
          const isActive = lang === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => onChangeLang(code)}
              aria-pressed={isActive}
              className={`cursor-pointer rounded-full px-2 py-[3px] text-[10px] font-bold uppercase transition-colors ${
                isActive ? 'bg-guitar text-guitar-ink' : 'text-ink-4'
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>
    </header>
  );
}
