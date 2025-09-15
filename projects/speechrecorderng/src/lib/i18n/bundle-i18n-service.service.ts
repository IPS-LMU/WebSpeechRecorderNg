import {Injectable} from '@angular/core';
import {resolve} from "@angular/compiler-cli";
import {Locale} from "./locale.utils";
import {QuoteParserService, TextPart} from "../utils/text/quote.parser.service";


export interface BundleI18nConfig {

}



export interface KeyId{
  bundle:string;
  key:string;
}

export type Params =Map<string, string>|Array<string>;

export  class LocalizableMessage{
    private constructor(
      readonly mlb:MultiLangBundleEntry|null=null,
      readonly keyId:KeyId|null=null,
      readonly standardMessage:string|null=null) {
    }
  static fromStandardMessage(standardMessage:string):LocalizableMessage{
    return new LocalizableMessage(null,null,standardMessage);
  }
    static fromMultiLangBundle(mlb:MultiLangBundleEntry):LocalizableMessage{
      return new LocalizableMessage(mlb);
    }
  static fromKeyId(keyid:KeyId):LocalizableMessage{
    return new LocalizableMessage(null,keyid);
  }
}


export type BundlesMap=Map<string,Bundle>;

export interface BundleI18nProvider {
    async:boolean;
    load(lang:string,bundlename:string):Promise<Bundle>;
}

export class BundleI18nMapProvider implements BundleI18nProvider{
    private bundle:Bundle;
    async=false;
    constructor(private bundlename:string,private lang:string,private translations:Map<string,string>) {
      const translationsArr=new Array<BundleEntry>();
      translations.forEach((val,key)=>{
        translationsArr.push({key:key,translation:val});
      })
      this.bundle=Bundle.fromBundleData(new BundleData(bundlename,lang,translationsArr));
    }

    load(lang:string,bundlename:string):Promise<Bundle>{
      return new Promise<Bundle>((resolve, reject)=>{
          resolve(this.bundle);
      })
    }
}

// export class BundleI18nServiceFactory {
//   static createBundleI18Service():BundleI18nService{
//     const bs=new BundleI18nService();
//
//     return bs;
//   }
//   static createBundleI18ServiceTest():BundleI18nService{
//     const bs=new BundleI18nService();
//     let ba=new Array<BundleEntry>();
//     ba.push({key:'test',translation:'Test (en)'});
//     ba.push({key:'test2',translation:'Test2 (en)'});
//     //const bId={name:'testbundle',lang:'en'};
//     const bd=new BundleData('testbundle','en',ba);
//     let b=Bundle.fromBundleData(bd);
//     console.debug(JSON.stringify(bd));
//     const bm:BundlesMap=new Map<string,Bundle>();
//     bm.set('en',b);
//     bs.putBundle(b);
//     //this.bundles.set('testbundle',bm);
//     return bs;
//   }
// }
//


// @Pipe({  name: 'tr',})
// export class I18nTranslatePipe implements PipeTransform {
//   private bundleI18nService: inject(BundleI18nService);
//   transform(value: string): string {
//     return ;
//   }
// }

export type BundleEntry ={key:string,translation:string};

export type TranslateValue={lang:string,translation:string};
export class MultiLangBundleEntry {
  constructor(readonly key:string,readonly translations:Array<TranslateValue>) {}

}



export class BundleData{
  constructor(
    public readonly name:string,
    public readonly lang:string,
    public readonly translations:Array<BundleEntry>){
  }

}

export class MultiLangBundleData{
  constructor(
    public readonly name:string,

    public readonly translations:Array<MultiLangBundleEntry>){
  }

}


export class Bundle{

  private translationsMap:Map<string,string>=new Map<string,string>();

  constructor(private _name:string,private _lang:string){
  }

  static fromBundleData(bundleData:BundleData):Bundle{
    const b=new Bundle(bundleData.name,bundleData.lang);
    for(let be of bundleData.translations){
      b.translationsMap.set(be.key,be.translation);
    }
    return b;
  }

  static fromMultiLangBundleData(multiLangBundleData:MultiLangBundleData):Map<string,Bundle>{
    const bundleMap=new Map<string,Bundle>();
    const mlTransls=multiLangBundleData.translations;
    mlTransls.forEach(mlBe=>{
        const key=mlBe.key;
        mlBe.translations.forEach(trans=>{
          const ln=trans.lang;
          let bdl=bundleMap.get(ln);
          if(!bdl){
            bdl=new Bundle(multiLangBundleData.name,ln);
            bundleMap.set(ln,bdl);
          }
          bdl.translationsMap.set(key,trans.translation);
        });
    });

    return bundleMap;
  }

  get name():string{
    return this._name;
  }

  get lang():string{
    return this._lang;
  }

  getTranslation(key:string):string|undefined{
    return this.translationsMap.get(key);
  }

}

export interface MessagePartI18n{
  message:string;
  paramName:null|string;
}

export interface BundleI18nService {
  get name(): string;

  set name(value: string);

  set fallBackLanguage(value: string | null);

  get navigatorLang(): string | null;

  get activeLang(): string;

  set activeLang(value: string);

  putBundleData(bd: BundleData): void;

  putMultiLangBundleData(mlbd: MultiLangBundleData): void;

  putBundle(b: Bundle): void;

  putBundleProvider(bundleName: string, bundleProvider: BundleI18nProvider): void;

  getBundle(bundlename: string, lang: string): Bundle | undefined;

  fetchBundle(bundlename: string, lang?: string): Promise<Bundle | null>;

  m(bundlename: string, key: string, params?:Params, lang?: string): string;

  mLm(lm:LocalizableMessage,params?:Params, lang?: string):string;

  mAsync(bundlename: string, key: string, params?:Params, lang?: string): Promise<string>;

  //mLmAsync(lm:LocalizableMessage,params?:Params, lang?: string):Promise<string>;

  mps(bundlename: string, key: string, params?:Params, lang?: string): MessagePartI18n[];
}

@Injectable()
export class BundleI18nServiceImpl implements BundleI18nService{
  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
  }

  private _name:string='(default)';
  get fallBackLanguage(): string | null {
    return this._fallBackLanguage;
  }

  set fallBackLanguage(value: string | null) {
    this._fallBackLanguage = value;
  }
  get navigatorLang(): string | null {
    return this._navigatorLang;
  }
  get activeLang(): string {
    return this._activeLang;
  }

  set activeLang(value: string) {
    this._activeLang = value;
  }
  private bundleProviders:Map<string,BundleI18nProvider>=new Map<string, BundleI18nProvider>();
  //private bundles:Map<BundleId,Bundle>=new Map<BundleId,Bundle>();
  private bundles:Map<string,BundlesMap>=new Map<string,BundlesMap>();

  private _activeLang:string='en';
  private _navigatorLang:string|null=null;

  private _fallBackLanguage:string|null=null;

  constructor() {
    const nl=navigator.language;
    if(nl){
      const loc=Locale.parseLocaleStr(nl);
      if(loc){
        // Set navigator language
        this._navigatorLang=loc.lang;
        // ... and use as default active language
        this.activeLang=this._navigatorLang;
      }
    }
  }

  putBundleData(bd:BundleData):void{
    const b=Bundle.fromBundleData(bd);
    this.putBundle(b);
  }

  putMultiLangBundleData(mlbd:MultiLangBundleData):void{
    const bm=Bundle.fromMultiLangBundleData(mlbd)
    bm.forEach((value)=>{
      this.putBundle(value);
    });
  }

  putBundle(b:Bundle):void{
    const bundlesMap=this.bundles.get(b.name);
    if (bundlesMap){
      bundlesMap.set(b.lang,b);
    }else{
      const bm=new Map<string,Bundle>();
      bm.set(b.lang,b);
      this.bundles.set(b.name,bm);
    }
  }

  putBundleProvider(bundleName:string,bundleProvider:BundleI18nProvider){
    this.bundleProviders.set(bundleName,bundleProvider);
  }

  getBundle(bundlename:string,lang:string):Bundle|undefined{
    let b=undefined;
    const bundlesMap = this.bundles.get(bundlename);
    if(bundlesMap){
      b=bundlesMap.get(lang);
    }
   return b;
  }

  fetchBundle(bundlename:string,lang?:string):Promise<Bundle|null>{
    if(!lang){
      lang=this._activeLang;
    }
    return new Promise<Bundle|null>((resolve, reject) => {
      //const reqBundleId:BundleId={name:bundlename,lang:lang};
      const bundlesMap = this.bundles.get(bundlename);
      const bundle=bundlesMap?.get(lang);
      if (bundle) {
          resolve(bundle);
      } else {
        // load bundle
        const bp = this.bundleProviders.get(bundlename);
        if (bp) {

          bp.load(lang, bundlename).then(
            (bundle) => {
              // cache
              this.putBundle(bundle);
              resolve(bundle);
            }
          ).catch(
            () => {
              resolve(null);
            }
          )
        } else {
          resolve(null);
        }
      }

    });
  }

  private toMessageParts(textParts:TextPart[],params:Params|undefined):MessagePartI18n[] {
    let mps:MessagePartI18n[] = [];
    for(let tp of textParts) {
      const tpMps=this.textPartToMessageParts(tp,params);
      mps=mps.concat(tpMps);
    }
    return mps;
  }

  private messageParts(translation:string,params:Params|undefined):MessagePartI18n[]{
    let repTxt='';

    const tps=QuoteParserService.parseTextOneQuoteChar(translation,"\'",'\\',true);
    return this.toMessageParts(tps,params);
  }

  private textPartToMessageParts(textPart:TextPart,params:Params|undefined):Array<MessagePartI18n>{
    const mps:MessagePartI18n[] = [];
    const t=textPart.text;
    if(textPart.quoted){
      // Text part is quoted (with single quotes) and has to be handled literally
      mps.push({message:t,paramName:null});
    }else{
      // Divide to plain text and parameter placeholder parts
      const tps=QuoteParserService.parseText(t,'{','}',null,true);
      for(let tp of tps){
        if(tp.quoted) {
          // Text part is a parameter placeholder
          if (params) {
            const paramName = tp.text.trim();
            let paramValue;
            if(params instanceof Map){
              // If params is a map lookup param by name
              paramValue = params.get(paramName);
            }else if(params instanceof Array){
              // If params is an array lookup param by index
              const paramIdx=parseInt(paramName);
              paramValue = params[paramIdx];
            }
            if (paramValue) {
              // Replace placeholder with param value
              mps.push({message:paramValue,paramName:paramName});
            } else {
              // No param value, fallback: do not replace
              // handle error ?
              mps.push({message:tp.text,paramName:null});
            }
          } else {
            // No params given, fallback: do not replace
            mps.push({message:tp.text,paramName:null});
          }
        }else{
          // No placeholder, pass text through, no replacement
          mps.push({message:tp.text,paramName:null});
        }
      }
    }
    return mps;
  }

  private replaceParamsInTextPart(textPart:TextPart,params:Params|undefined):string{
    let repTxt='';
    const t=textPart.text;
    if(textPart.quoted){
      repTxt=t;
    }else{
      const tps=QuoteParserService.parseText(t,'{','}',null,true);
      for(let tp of tps){
        if(tp.quoted) {
          if (params) {
            const paramName = tp.text.trim();
            let paramValue;
            if(params instanceof Map){
              paramValue = params.get(paramName);
            }else if(params instanceof Array){
              const paramIdx=parseInt(paramName);
              paramValue = params[paramIdx];
            }

            if (paramValue) {
              repTxt = repTxt.concat(paramValue);
            } else {
              // handle error ?
              repTxt = repTxt.concat(tp.text);
            }
          } else {
            repTxt = repTxt.concat(tp.text);
          }
        }else{
          repTxt = repTxt.concat(tp.text);
        }
      }
    }
    return repTxt
  }

  private replaceParamsInTextParts(textParts:TextPart[],params:Params|undefined):string {
    let repTxt='';
      for(let tp of textParts) {
        const partTxt=this.replaceParamsInTextPart(tp,params);
        repTxt=repTxt.concat(partTxt);
      }
      return repTxt;
  }

  private replaceParams(translation:string,params:Params|undefined):string {
    let repTxt='';

    const tps=QuoteParserService.parseTextOneQuoteChar(translation,"\'",'\\',true);
    return this.replaceParamsInTextParts(tps,params);
  }

  m(bundlename:string, key:string, params?:Params, lang?:string):string {
    if(!lang){
      lang=this._activeLang;
    }
    let tr = "[" + bundlename + ":" + key + "]";

    const bundle=this.getBundle(bundlename,lang);
    if (bundle) {
      const btr = bundle.getTranslation(key);
      if (btr) {
        tr = btr;
      }
    } else {
      if(this._fallBackLanguage){
        const fbBundle=this.getBundle(bundlename,this._fallBackLanguage);
        if(fbBundle) {
          const fbBtr = fbBundle.getTranslation(key);
          if (fbBtr) {
            tr = fbBtr;
          }
        }
      }

      // Prevent Loop
      // fetch to cache
      //this.translateAsync(bundlename,key,lang);
    }
    const resTxt=this.replaceParams(tr,params);
    return resTxt;
  }

  mLm(lm: LocalizableMessage,params?:Params, lang?: string): string {

    if(!lang){
      lang=this._activeLang;
    }
    let tr:string|null = "[]";
    let resTxt:string|null=null

    if(lm.mlb){
      const trValMatch=lm.mlb.translations.find((value:TranslateValue)=>(value.lang===lang));
      if (trValMatch) {
        tr = trValMatch.translation;
      }else{
        if(this._fallBackLanguage){
          const trValFbMatch=lm.mlb.translations.find((value:TranslateValue)=>(value.lang===this._fallBackLanguage));
          if (trValFbMatch) {
            tr = trValFbMatch.translation;
          }
        }
      }
    } else {
      if (lm.keyId) {
        let b = this.getBundle(lm.keyId.bundle, lang);
        if (!b && this._fallBackLanguage) {
          let b = this.getBundle(lm.keyId.bundle, this._fallBackLanguage);
        }
        if (b) {
          const btr = b.getTranslation(lm.keyId.key);
          if (btr) {
            tr = btr;
          }
        }else{
          tr='['+lm.keyId.bundle+'.'+lm.keyId.key+']';
        }
      }else if(lm.standardMessage) {
        tr=null;
        resTxt=lm.standardMessage;
      }
    }
    if(tr) {
      resTxt = this.replaceParams(tr, params);
    }else{
      if(!resTxt){
        resTxt='[]';
      }
    }
    return resTxt;
  }

  /**
   *
   * @param bundlename
   * @param key
   * @param params
   * @param lang
   */
  mps(bundlename:string, key:string, params?:Params, lang?:string):Array<MessagePartI18n> {
    if(!lang){
      lang=this._activeLang;
    }
    let tr = "[" + bundlename + ":" + key + "]";

    const bundle=this.getBundle(bundlename,lang);
    if (bundle) {
      const btr = bundle.getTranslation(key);
      if (btr) {
        tr = btr;
      }
    } else {
      if(this._fallBackLanguage){
        const fbBundle=this.getBundle(bundlename,this._fallBackLanguage);
        if(fbBundle) {
          const fbBtr = fbBundle.getTranslation(key);
          if (fbBtr) {
            tr = fbBtr;
          }
        }
      }

      // Prevent Loop
      // fetch to cache
      //this.translateAsync(bundlename,key,lang);
    }
    const resMps=this.messageParts(tr,params);
    return resMps;
  }

  mAsync(bundlename:string, key:string, params?:Params, lang?:string):Promise<string>{
    if(!lang){
      lang=this._activeLang;
    }
    return new Promise<string>((resolve, reject) => {

      let tr = "[" + bundlename + ":" + key + "]";
      const bundle=this.getBundle(bundlename,lang);
      if (bundle) {
        const btr = bundle.getTranslation(key);
        if (btr) {
          tr = btr;
          resolve(tr);
        }
      } else {
        // load bundle
        this.fetchBundle(bundlename,lang).then(
            (bundle) => {
              // cache
              if(bundle) {
                this.putBundle(bundle);
                const btr = bundle.getTranslation(key);
                if(btr){
                  tr=btr;
                }
              }
            }
          ).finally(()=>resolve(tr));
        }
    });
  }

  mLmAsync(lm: LocalizableMessage,params?:Params, lang?: string): Promise<string> {

      return new Promise<string>((resolve, reject) => {
        // Not implemnted yet
      });

  }
}
