import { Injectable } from '@angular/core';
import {BundleI18nServiceImpl} from "./bundle-i18n-service.service";

import commonBundle from "./common.json";
import sprAudioBundle from "./spr.audio.json";
import sprBundle from "./spr.json";

@Injectable()
export class SprBundleService extends BundleI18nServiceImpl{

  constructor() {
    super();
    this.name='Spr-Module-Bundle-Service';
    this.putMultiLangBundleData(commonBundle);
    this.putMultiLangBundleData(sprAudioBundle);
    this.putMultiLangBundleData(sprBundle);
    this.fallBackLanguage='en';
  }
}
