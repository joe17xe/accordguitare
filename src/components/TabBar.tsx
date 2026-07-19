import { Search, Layers, AudioLines, Mic, MoreHorizontal } from 'lucide-react';
import type { Lang } from '../i18n';
import { t } from '../i18n';

// Onglet actif de la nav basse mobile.
export type MobileTab = 'chords' | 'progressions' | 'scales' | 'tuner' | 'more';

interface TabItem {
  id: MobileTab;
  labelKey: string;
  Icon: typeof Search;
}

const TABS: TabItem[] = [
  { id: 'chords', labelKey: 'nav.chords', Icon: Search },
  { id: 'progressions', labelKey: 'nav.progressions', Icon: Layers },
  { id: 'scales', labelKey: 'nav.scales', Icon: AudioLines },
  { id: 'tuner', labelKey: 'nav.tuner', Icon: Mic },
  { id: 'more', labelKey: 'nav.more', Icon: MoreHorizontal },
];

interface TabBarProps {
  active: MobileTab;
  lang: Lang;
  onSelect: (tab: MobileTab) => void;
  className?: string;
}

/**
 * Barre de navigation basse fixe (mobile, < 768px).
 * Traitement Android : pastille émeraude derrière l'icône active.
 * Respecte env(safe-area-inset-bottom).
 */
export function TabBar({ active, lang, onSelect, className = '' }: TabBarProps) {
  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-[rgba(10,12,11,0.92)] backdrop-blur-xl ${className}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
        {TABS.map(({ id, labelKey, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-1 cursor-pointer flex-col items-center gap-1 py-1 transition-transform active:scale-95"
            >
              <span
                className={`flex items-center justify-center rounded-2xl px-3.5 py-1 transition-colors ${
                  isActive ? 'bg-guitar/18' : 'bg-transparent'
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={2}
                  color={isActive ? '#10B981' : '#6B726F'}
                />
              </span>
              <span
                className={`text-[9px] leading-none ${
                  isActive ? 'font-bold text-guitar' : 'font-semibold text-ink-4'
                }`}
              >
                {t(lang, labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
