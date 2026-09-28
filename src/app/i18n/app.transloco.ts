import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {provideTransloco, Translation, TranslocoLoader} from '@jsverse/transloco';

/** Loads `assets/i18n/<lang>.json`; the same catalogues hold the shell's and the recorder's keys. */
@Injectable({providedIn: 'root'})
export class TranslocoHttpLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {
  }

  getTranslation(lang: string) {
    const code = lang.replace(/-.*/g, '');
    return this.http.get<Translation>(`assets/i18n/${code}.json`);
  }
}

/** Same shape as the sibling application's Transloco setup, so both read the same catalogues. */
export function provideAppTransloco() {
  return provideTransloco({
    config: {
      availableLangs: ['en', 'sv'],
      // Swedish is the application's default; English stays the fallback for a missing key.
      defaultLang: 'sv',
      fallbackLang: 'en',
      missingHandler: {
        useFallbackTranslation: true,
      },
      reRenderOnLangChange: true,
    },
    loader: TranslocoHttpLoader,
  });
}
