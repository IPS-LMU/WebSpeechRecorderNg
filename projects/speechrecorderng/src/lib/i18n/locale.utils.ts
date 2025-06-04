export class Locale{

  constructor(private _lang:string,private _variant?:string) {}

  get lang(){
    return this._lang;
  }

  get variant(){
    return this._variant;
  }

  toString(){
    let str=this.lang;
    if(this.variant){
      str=str.concat('-');
      str=str.concat(this.variant);
    }
    return str;
  }

  static parseLocaleStr(localeStr:string):Locale{
    if(localeStr===''){
      throw new Error('Empty locale string');
    }
    let locStrSpl=localeStr.split('-');
    if(locStrSpl.length===1){
      return new Locale(locStrSpl[0]);
    }else if(locStrSpl.length===2){
      return new Locale(locStrSpl[0],locStrSpl[1]);
    }else{
      throw new Error('Could not parse locale string: '+localeStr);
    }
  }
}
