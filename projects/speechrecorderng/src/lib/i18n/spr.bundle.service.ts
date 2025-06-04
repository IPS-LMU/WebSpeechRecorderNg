import { Injectable } from '@angular/core';
import {BundleI18nService} from "./bundle-i18n.service";

import commonBundle from "./common.json";
import sprAudioBundle from "./spr.audio.json";

@Injectable()
export class SprBundleService extends BundleI18nService{

  constructor() {
    super();
    this.name='Spr-Module-Bundle-Service';
    this.putMultiLangBundleData(commonBundle);
    this.putMultiLangBundleData(sprAudioBundle);
    this.fallBackLanguage='en';
  }
}
