import {Injectable} from '@angular/core';


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
      this.bundle=new Bundle(bundlename,lang,translationsArr);
    }

    load(lang:string,bundlename:string):Promise<Bundle>{
      return new Promise<Bundle>((resolve, reject)=>{
          resolve(this.bundle);
      })
    }
}

export class BundleI18nServiceFactory {
  static createBundleI18Service():BundleI18nService{
    return new BundleI18nService()
  }
}



// @Pipe({  name: 'tr',})
// export class I18nTranslatePipe implements PipeTransform {
//   private bundleI18nService: inject(BundleI18nService);
//   transform(value: string): string {
//     return ;
//   }
// }

type BundleEntry ={key:string,translation:string};

export class Bundle{
  get translations(): Array<BundleEntry> {
    return this._translations;
  }
  get name(): string {
    return this._name;
  }

  get lang(): string {
    return this._lang;
  }
  private translationsMap:Map<string,string>=new Map<string,string>();
  constructor(
    private _name:string,
    private _lang:string,
    private _translations:Array<BundleEntry>){
    for(let be of this._translations){
      this.translationsMap.set(be.key,be.translation);
    }
  }

  getTranslation(key:string):string|undefined{
    return this.translationsMap.get(key);
  }

}

@Injectable({
  providedIn: 'root'
})
export class BundleI18nService {
  private bundleProviders:Map<string,BundleI18nProvider>=new Map<string, BundleI18nProvider>();
  //private bundles:Map<BundleId,Bundle>=new Map<BundleId,Bundle>();
  private bundles:Map<string,BundlesMap>=new Map<string,BundlesMap>();

  private activeLang:string='en';
  constructor() {
    // Test
    // let b1m=new Map<string,string>();
    // b1m.set('test','Test (en)');
    // b1m.set('test2','Test2 (en)');
    // let b=new Bundle('testbundle','en',b1m);

    let ba=new Array<BundleEntry>();
    ba.push({key:'test',translation:'Test (en)'});
    ba.push({key:'test2',translation:'Test2 (en)'});
    //const bId={name:'testbundle',lang:'en'};
    let b=new Bundle('testbundle','en',ba);
    console.debug(JSON.stringify(b));
    const bm:BundlesMap=new Map<string,Bundle>();
    bm.set('en',b);
    this.bundles.set('testbundle',bm);

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
      lang=this.activeLang;
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
      lang=this.activeLang;
    }
    let tr = "[" + bundlename + ":" + key + "]";

    const bundle=this.getBundle(bundlename,lang);
    if (bundle) {
      const btr = bundle.getTranslation(key);
      if (btr) {
        tr = btr;
      }
    } else {
      // fetch to cache
      this.translateAsync(bundlename,key,lang);
    }
    return tr;
  }
  translateAsync(bundlename:string,key:string,lang?:string):Promise<string>{
    if(!lang){
      lang=this.activeLang;
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
