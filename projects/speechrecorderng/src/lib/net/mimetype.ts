export class MIMEType {

    public static readonly TEXT_PLAIN = new MIMEType('text', 'plain', 'txt');
    public static readonly AUDIO_WAVE = new MIMEType('audio', 'wav', 'wav');
    public static readonly VIDEO_MP4 = new MIMEType('video', 'mp4', 'mp4');
    public static readonly VIDEO_WEBM = new MIMEType('video', 'webm', 'webm');
    public static readonly VIDEO_MATROSKA = new MIMEType('video', 'x-matroska','mkv');

    public static readonly KNOWN_TYPES = [MIMEType.TEXT_PLAIN, MIMEType.AUDIO_WAVE, MIMEType.VIDEO_MP4,MIMEType.VIDEO_WEBM,MIMEType.VIDEO_MATROSKA];

    constructor(private _type: string, private _subType: string,private _extension?: string, private _parameters?:string[]) {
        if(!this._parameters){
            this._parameters=[];
        }
    }

    get type(): string {
        return this._type;
    }

    get subType(): string {
        return this._subType;
    }

    get parameters(): Array<string> {
        return this._parameters;
    }

    get extension():string{
        return this._extension;
    }

    isVideo(): boolean {
        return this._type.toLowerCase() === 'video';
    }

    isAudioPCM(): boolean {
        return this.equals(MIMEType.AUDIO_WAVE);
    }

    private static knownType(type: string, subType: string): MIMEType | null {
        for (let nti = 0; nti < MIMEType.KNOWN_TYPES.length; nti++) {
            let knownType = MIMEType.KNOWN_TYPES[nti];
            if (knownType.type === type && knownType.subType === subType) {
                return knownType;
            }
        }
        return null;
    }


    public static parse(mimeTypeString: string): MIMEType {
        let trimmedStr = mimeTypeString.trim();
        let mimeParamsSplit=trimmedStr.split(';');
        if(mimeParamsSplit.length<1) {
            throw new Error("Could not parse MIME type: "+mimeTypeString);
        }
        let splitStr = mimeParamsSplit[0].split('/');

        if (splitStr == null) {
            throw new Error("Could not parse MIME type: " + mimeTypeString);
        }

        let splitStrCmps = splitStr.length;
        if (splitStrCmps < 1 || splitStrCmps > 2) {
            throw new Error("Could not parse MIME type: " + mimeTypeString);
        } else {
            let type = splitStr[0];
            let subType = null;
            // sub type can be null
            if (splitStrCmps > 1) {
                subType = splitStr[1];
            }
            let mimeType:MIMEType=null;
            let prms=new Array<string>();
            for(let pi=1;pi<mimeParamsSplit.length;pi++) {
                prms.push(mimeParamsSplit[pi]);
            }
            let knownType = this.knownType(type, subType);
            if(knownType !=null && prms.length==0) {
                mimeType=knownType;
            }else {
                let ext:string=null;
                if(knownType!=null) {
                    ext=knownType.extension;
                }
                mimeType=new MIMEType(type,subType,ext,prms);
            }
            return mimeType;

        }
    }


    public static byExtension(extension:string):MIMEType{
        let mt:MIMEType=null;
        for (let nti = 0; nti < MIMEType.KNOWN_TYPES.length; nti++) {
            let knownType = MIMEType.KNOWN_TYPES[nti];
            if (knownType.extension.toLowerCase() === extension.toLowerCase()) {
                mt=knownType;
                break;
            }
        }
        return mt;
    }

    public equals(otherMimeType: MIMEType) {

        let typeEq = this.type === otherMimeType.type;
        if (!typeEq) {
            return false;
        }
        let otherSubType = otherMimeType.subType;
        // Note: * and */* are treated as NOT equal !
        let subTypeEq:boolean;
        if (this._subType == null) {
            subTypeEq=(otherSubType == null);
        } else {
            subTypeEq=(this._subType === otherSubType);
        }
        if(!subTypeEq) {
            return false;
        }

        let paramsEq=true;
        let otherPrms=otherMimeType.parameters;
        let prmsSize=this._parameters.length;
        if(prmsSize!=otherPrms.length) {
            return false;
        }
        for(let pi=0;pi<prmsSize;pi++) {
            let p=this._parameters[pi];
            let op=otherPrms[pi];
            if(p!==op) {
                paramsEq=false;
                break;
            }
        }
        if(!paramsEq) {
            return false;
        }
        return true;
    }

    public toHeaderString():string{
        let str=this._type+'/'+this._subType;
        for(let pi=0;pi<this._parameters.length;pi++){
            str=str.concat(';');
            let p=this._parameters[pi];
            let eqSignPos=p.indexOf("=");
            if(eqSignPos>0){
                let pk=p.substring(0,eqSignPos+1).trim();
                str=str.concat(pk);
                let pVal=p.substring(eqSignPos+1).trim();
                let pValStr=pVal;
                // If mime type contains a comma...
                let pValCommaPos=pVal.indexOf(",");
                if(pValCommaPos!==-1){
                    // ...check if already quoted...
                    if(! (pVal.startsWith('"') && pVal.endsWith('"'))){
                        // ... and if not, quote the parameter value string
                        pValStr = '"' + pVal + '"';
                    }
                }
                str=str.concat(pValStr);
            }else{
                str=str.concat(p);
            }
        }
        return str;
    }
}
