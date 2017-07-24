import {Injectable, InjectionToken} from "@angular/core";

export let SPEECHRECORDER_CONFIG = new InjectionToken<Config>('app.config');


@Injectable()
export class Config{
  constructor(){
    this.apiEndPoint="blafasel/byconstr"
  }
  apiEndPoint: string;
}

export const SPR_CFG: Config = {
  apiEndPoint: 'test'
};
