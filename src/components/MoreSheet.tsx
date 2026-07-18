import { BookOpen, Timer, FileText, X } from 'lucide-react';
import type { Lang } from '../i18n';
import { t } from '../i18n';

// Destinations accessibles depuis l'onglet « Plus ».
export type MoreDestination = 'songbook' | 'metronome' | 'sheet';

interface MoreSheetProps {
  lang: Lang;
  onSelect: (dest: MoreDestination) => void;
  onClose: () => void;
}

interface Entry {
  id: MoreDestination;
  labelKey: string;
  descKey: string;
  Icon: typeof BookOpen;
}

const ENTRIES: Entry[] = [
  { id: 'songbook', labelKey: 'more.songbook', descKey: 'more.songbook.desc', Icon: BookOpen },
  { id: 'metronome', labelKey: 'more.metronome', descKey: 'more.metronome.desc', Icon: Timer },
  { id: 'sheet', labelKey: 'more.sheet', descKey: 'more.sheet.desc', Icon: FileText },
];

/**
 * Feuille de débordement « Plus » (mobile). Donne accès aux outils
 * complémentaires (Chansonnier, Métronome). Restylée/étendue en PR 4.
 */
export function MoreSheet({ lang, onSelect, onClose }: MoreSheetProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60 backdrop-blur-sm md:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'more.title')}
    >
      <div
        className="rounded-t-3xl border-t border-white/8 bg-[rgba(16,18,17,0.98)] px-4 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

        <div className="mb-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-base font-extrabold text-ink">{t(lang, 'more.title')}</span>
            <span className="text-[11px] font-medium text-ink-4">{t(lang, 'more.subtitle')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'more.close')}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/6 text-ink-3 transition active:scale-95"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {ENTRIES.map(({ id, labelKey, descKey, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-guitar/12 text-guitar">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold text-ink">{t(lang, labelKey)}</span>
                <span className="text-[11px] font-medium text-ink-4">{t(lang, descKey)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
