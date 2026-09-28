import {DOCUMENT} from '@angular/common';
import {APP_INITIALIZER, LOCALE_ID, Provider} from '@angular/core';
import {registerLocaleData} from '@angular/common';
import localeSv from '@angular/common/locales/sv';
import localeEn from '@angular/common/locales/en';
import {TranslocoService} from '@jsverse/transloco';
import {SPEECHRECORDER_STRINGS} from '../../../projects/speechrecorderng/src/lib/i18n/translate';

export const LANGUAGE_STORAGE_KEY = 'spr.lang';
export const LANGUAGES = ['en', 'sv'] as const;
export type Language = typeof LANGUAGES[number];

/** Persisted choice, else the browser's, else Swedish — the application's default. */
export function initialLanguage(): Language {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (LANGUAGES as readonly string[]).includes(stored)) {
      return stored as Language;
    }
  }
  if (typeof navigator !== 'undefined') {
    const preferred = (navigator.language || 'sv').slice(0, 2).toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(preferred)) {
      return preferred as Language;
    }
  }
  return 'sv';
}

/** Catalogue of one language, flattened to the dotted keys the recorder uses. */
function flattenCatalogue(catalogue: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof catalogue !== 'object' || catalogue === null) {
    return out;
  }
  for (const [key, value] of Object.entries(catalogue as Record<string, unknown>)) {
    const path = prefix ? prefix + '.' + key : key;
    if (typeof value === 'string') {
      out[path] = value;
    } else {
      flattenCatalogue(value, path, out);
    }
  }
  return out;
}

/**
 * The recorder reads its strings through `SPEECHRECORDER_STRINGS`. Transloco owns the
 * catalogues, so the token gets a view onto the active language — with the *raw* values: the
 * library interpolates its `{{placeholders}}` itself, and a value read through
 * `transloco.translate()` without parameters comes back with every placeholder emptied.
 * A key the catalogue does not define comes back `undefined`, so the library falls back to its
 * own English text.
 */
export function speechRecorderStringsFromTransloco(transloco: TranslocoService): Record<string, string> {
  let cachedLanguage: string | null = null;
  let cachedStrings: Record<string, string> = {};
  const strings = (): Record<string, string> => {
    const language = transloco.getActiveLang();
    if (language !== cachedLanguage) {
      cachedStrings = flattenCatalogue(transloco.getTranslation(language));
      cachedLanguage = language;
    }
    return cachedStrings;
  };
  return new Proxy({} as Record<string, string>, {
    get: (_target, property) => {
      if (typeof property !== 'string') {
        return undefined;
      }
      return strings()[property];
    },
    has: () => true,
    ownKeys: () => [],
  });
}

/** Providers for the shell: catalogues, the recorder bridge, and the locale for date/number formats. */
export function provideI18n(): Provider[] {
  const language = initialLanguage();
  registerLocaleData(localeSv);
  registerLocaleData(localeEn);

  return [
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [TranslocoService, DOCUMENT],
      useFactory: (transloco: TranslocoService, document: Document) => () => {
        const lang = initialLanguage();
        document.documentElement.setAttribute('lang', lang);
        // A missing catalogue must not stop the application from booting: the library falls
        // back to its own English strings and the key text.
        return transloco.load(lang).toPromise()
          .catch(() => undefined)
          .then(() => transloco.setActiveLang(lang));
      },
    },
    {
      provide: LOCALE_ID,
      useValue: language,
    },
    {
      provide: SPEECHRECORDER_STRINGS,
      deps: [TranslocoService],
      useFactory: speechRecorderStringsFromTransloco,
    },
  ];
}
