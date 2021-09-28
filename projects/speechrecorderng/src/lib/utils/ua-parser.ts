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

export const OS_ANDROID='Android';

export class UserAgent{

  constructor(public components:Array<UserAgentComponent>) {
  }

  isBrowser(browserName:string){
    for(let ci=0;ci<this.components.length;ci++){
      let bn=this.components[ci].name
        let bnRe=new RegExp(browserName,'i');
        if(bn.match(bnRe)){
          return true;
        }

    }
    return false;
  }

  runsOnOS(os:string):boolean{
    for(let ci=0;ci<this.components.length;ci++){
      let cc=this.components[ci].comment
      if(cc){
        var osRe = new RegExp(os,'i');
        if(cc.match(osRe)){
          return true;
        }
      }
    }
    return false;
  }

}

export class UserAgentParser {
  static parse(ua:string): UserAgent {
    let comps = new Array<UserAgentComponent>();

    let pp = 0;
    while (pp < ua.length) {
      //parse name/version
      let name:string|null=null
      let version:string|null=null;
      let comment:string|undefined;

      let blPos=ua.indexOf(' ',pp);
      let prt:string;
      if(blPos==-1){
        prt=ua.substr(pp);
        pp+=prt.length;
      }else {
        prt = ua.substr(pp, blPos - pp);
        pp=blPos+1;
      }
      let sepPos=prt.indexOf('/');
      if(sepPos>0) {
          name=prt.substr(0,sepPos);
          version=prt.substr(sepPos+1);
      }else {
        name=prt;
      }
      while(ua[pp]===' ' && pp<ua.length){
        pp++;
      }
      if(ua[pp]==='(') {
        pp++;
        let commEnd=ua.indexOf(')',pp);
        comment=ua.substr(pp,commEnd-pp);
        pp=commEnd+1;
      }
      while(ua[pp]===' '  && pp<ua.length){
        pp++;
      }
      comps.push(new UserAgentComponent(name,version,comment));
    }

    return new UserAgent(comps);
  }
}
