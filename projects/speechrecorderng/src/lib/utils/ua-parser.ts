export class UserAgentComponent{
  constructor(public name:string,public version:string|null,public comment?:string) {

  }

  toString():string{
    let s='['+this.name+']';
    if(this.version){
      s=s+' ['+this.version+']';
    }
    if(this.comment){
      s=s+' ['+this.comment+']';
    }
    return s;
  }
}
export const NAME_FIREFOX='Firefox';
export const NAME_CHROME='Chrome';
export const NAME_SAFARI='Safari';
export const NAME_EDGE='Edge';



export enum Browser {Firefox='Firefox',Chrome='Chrome',Safari='Safari',Edge='Edge'}

export const OS_WINDOWS='Windows';
export const OS_ANDROID='Android';

export enum Platform {Windows='Windows',Android='Android',macOS='MAC OS X'}

export class UserAgent{


  constructor(private _detectedPlatform:Platform|null,private _detectedBrowser:Browser|null,private _detectedBrowserVersion:string|null=null) {
  }

  get detectedBrowser(): Browser | null {
    return this._detectedBrowser;
  }

  get detectedBrowserVersion(): string | null {
    return this._detectedBrowserVersion;
  }

  get detectedPlatform(): Platform | null {
    return this._detectedPlatform;
  }

}

export class UserAgentBuilder {
  static instance:UserAgentBuilder|undefined=undefined;
  private comps:Array<UserAgentComponent>=new Array<UserAgentComponent>();
  private userAgent!:UserAgent;

  private build() {

    // // @ts-ignore
    // if(navigator.userAgentData){
    //   // maybe we can use this in  the future
    //   console.info("Browser provides userAgentData:");
    //
    //   console.info("Brands:");
    //   // @ts-ignore
    //   navigator.userAgentData.brands.forEach((br=>{
    //     console.info(br.brand +" "+br.version);
    //   }))
    //   // @ts-ignore
    //   console.info("Platform: "+navigator.userAgentData.platform);
    //   // @ts-ignore
    //   console.info("Mobile:"+navigator.userAgentData.mobile);
    //   // @ts-ignore
    //   //console.info(navigator.userAgentData.toJSON());
    // }else {
    //   console.info("Browser does not provide userAgentData.");
    // }

    let ua=navigator.userAgent;
    console.debug("User agent: "+ua);
    this.comps = new Array<UserAgentComponent>();

    let pp = 0;
    while (pp < ua.length) {
      //parse name/version
      let name: string | null = null
      let version: string | null = null;
      let comment: string | undefined;

      let blPos = ua.indexOf(' ', pp);
      let prt: string;
      // TODO Replace substr with substring (?)
      // https://stackoverflow.com/questions/52640271/why-is-string-prototype-substr-deprecated
      if (blPos == -1) {
        prt = ua.substr(pp);
        pp += prt.length;
      } else {
        prt = ua.substr(pp, blPos - pp);
        pp = blPos + 1;
      }
      let sepPos = prt.indexOf('/');
      if (sepPos > 0) {
        name = prt.substr(0, sepPos);
        version = prt.substr(sepPos + 1);
      } else {
        name = prt;
      }
      while (ua[pp] === ' ' && pp < ua.length) {
        pp++;
      }
      if (ua[pp] === '(') {
        pp++;
        let commEnd = ua.indexOf(')', pp);
        comment = ua.substr(pp, commEnd - pp);
        pp = commEnd + 1;
      }
      while (ua[pp] === ' ' && pp < ua.length) {
        pp++;
      }
      const uac=new UserAgentComponent(name, version, comment);
      console.debug("user agent comp: "+uac);
      this.comps.push(uac);
    }

    let detPlatf:Platform|null=null;
    if(this.runsOnOS(Platform.Android)){
      detPlatf=Platform.Android;
    }else if(this.runsOnOS(Platform.Windows)){
      detPlatf=Platform.Windows;
    }else if(this.runsOnOS(Platform.macOS)){
      detPlatf=Platform.macOS;
    }


  let detBr:Browser|null=null;
    if(this.matchesBrowser(Browser.Firefox)){
      detBr=Browser.Firefox;
    }else if(this.matchesBrowser(Browser.Chrome)){
      detBr=Browser.Chrome;
    }else if(this.matchesBrowser(Browser.Safari)){
      detBr=Browser.Safari;
    }
    let detBrVers =null;
    if(detBr) {
     detBrVers=this.browserVersion(detBr);
    }
    this.userAgent=new UserAgent(detPlatf,detBr,detBrVers);

  }

  private matchesBrowser(browserName:string){
    for(let ci=0;ci<this.comps.length;ci++){
      let bn=this.comps[ci].name
      let bnRe=new RegExp(browserName,'i');
      if(bn.match(bnRe)){
        return true;
      }
    }
    return false;
  }

  private browserVersion(browserName:string):string|null{
    for(let ci=0;ci<this.comps.length;ci++){
      const comp=this.comps[ci];
      const bn=comp.name;
      const bnRe=new RegExp(browserName,'i');
      if(bn.match(bnRe)){
        return comp.version;
      }
    }
    return null;
  }

  private runsOnOS(os:string):boolean{
    for(let ci=0;ci<this.comps.length;ci++){
      let cc=this.comps[ci].comment
      if(cc){
        var osRe = new RegExp(os,'i');
        if(cc.match(osRe)){
          return true;
        }
      }
    }
    return false;
  }

  static userAgent():UserAgent{
      if(!this.instance){
        this.instance=new UserAgentBuilder();
      }
      this.instance.build();
      return this.instance.userAgent;

  }

}
