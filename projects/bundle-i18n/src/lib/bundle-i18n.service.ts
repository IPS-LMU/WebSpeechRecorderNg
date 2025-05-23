import {Inject, Injectable} from '@angular/core';
import {Pipe, PipeTransform} from '@angular/core';

export interface BundleI18nConfig {

}



export interface KeyId{
  bundle:string;
  key:string;
}

export interface BundleI18nLoader {
    load(lang:string,bundlename:string):Map<string,string>;
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
  private translationsMap:Map<string,string>=new Map<string,string>();
  constructor(
    private name:string,
    private lang:string,
    private translations:Array<BundleEntry>){
    for(let be of this.translations){
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

  private bundles:Map<string,Bundle>=new Map<string,Bundle>();
  constructor() {
    // Test
    // let b1m=new Map<string,string>();
    // b1m.set('test','Test (en)');
    // b1m.set('test2','Test2 (en)');
    // let b=new Bundle('testbundle','en',b1m);

    let ba=new Array<BundleEntry>();
    ba.push({key:'test',translation:'Test (en)'});
    ba.push({key:'test2',translation:'Test2 (en)'});
    let b=new Bundle('testbundle','en',ba);
    console.debug(JSON.stringify(b));
    this.bundles.set('testbundle',b);

  }

  translate(bundlename:string,key:string,lang:string|null=null):string{
    let tr="["+bundlename+":"+key+"]";
    const bundle=this.bundles.get(bundlename);
    if(bundle){
      const btr=bundle.getTranslation(key);
      if(btr){
        tr=btr;
      }
    }
    return tr;
  }

}
