import {MissingTranslationHandler} from "@ngx-translate/core";
import {Translation} from "@ngx-translate/core";
import {Observable} from "rxjs";
import {MissingTranslationHandlerParams} from "@ngx-translate/core";



export class SprMissingTranslationHandler extends MissingTranslationHandler{
  private _pass=true;

  handle(params: MissingTranslationHandlerParams): Translation | Observable<Translation>{
    console.debug("Spr: Missing translation for key: "+params.key+" "+params.interpolateParams);
    if(this._pass){
      const serv=params.translateService;
      const defLang=serv.defaultLang;
      const defLangTransls=serv.translations[defLang];
      const defLangTransl=defLangTransls[params.key];
      return defLangTransl;
    }else {
      return '--['+params.key+']--';
    }
  }
}
