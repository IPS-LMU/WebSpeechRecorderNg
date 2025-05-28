import {Injectable} from '@angular/core';
import {resolve} from "@angular/compiler-cli";
import {Locale} from "./locale.utils";


export interface BundleI18nConfig {

}



export interface KeyId{
  bundle:string;
  key:string;
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
export type MultiLangBundleEntry ={key:string,translations:Array<TranslateValue>};



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

@Injectable({
  providedIn: 'root'
})
export class BundleI18nService {
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
  translate(bundlename:string,key:string,lang?:string):string {
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
    return tr;
  }
  translateAsync(bundlename:string,key:string,lang?:string):Promise<string>{
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

}
