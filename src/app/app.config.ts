

import {InjectionToken} from "@angular/core";

export class AppConfig {
  apiEndpoint: string;
  title: string;
}

export let APP_CONFIG = new InjectionToken<AppConfig>('app.config');

export const HERO_DI_CONFIG: AppConfig = {
  apiEndpoint: 'api.heroes.com',
  title: 'Dependency Injection'
};


