import {MIMEType} from "./mimetype";

export class ContentType{

    get mimeType(): MIMEType {
        return this._mimeType;
    }

    get parameters(): Array<string> {
        return this._parameters;
    }

    constructor(private _mimeType:MIMEType,private _parameters:Array<string>) {
    }

    public static parse(contentTypeStr:string):ContentType{
        let ts=contentTypeStr.trim();
        let tks=ts.split(';');
        let splitStrCmps = tks.length;
        if(splitStrCmps==0){
            let mt=MIMEType.parse(ts);
            return new ContentType(mt,new Array<string>());
        } else {
            let mt=MIMEType.parse(tks[0]);
            let prs=new Array<string>();
            for(let tpi=1;tpi<tks.length;tpi++){
                let pr=tks[tpi].trim();
                prs.push(pr);
            }
            return new ContentType(mt,prs);
        }
    }
}
