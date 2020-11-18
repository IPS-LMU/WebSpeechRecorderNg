export class MIMEType {
    public static readonly TEXT_PLAIN = new MIMEType('text', 'plain', 'txt');
    public static readonly AUDIO_WAVE = new MIMEType('audio', 'wav', 'wav');
    public static readonly VIDEO_MP4 = new MIMEType('video', 'mp4', 'mp4');
    public static readonly VIDEO_WEBM = new MIMEType('video', 'webm', 'webm');
    public static readonly VIDEO_MATROSKA = new MIMEType('video', 'x-matroska','mkv');

    public static readonly KNOWN_TYPES = [MIMEType.TEXT_PLAIN, MIMEType.AUDIO_WAVE, MIMEType.VIDEO_MP4,MIMEType.VIDEO_WEBM,MIMEType.VIDEO_MATROSKA];

    constructor(private _type: string, private _subType: string, private _extension?: string) {
    }

    get type(): string {
        return this._type;
    }

    get subType(): string {
        return this._subType;
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

        let splitStr = trimmedStr.split('/');

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

            let knownType = this.knownType(type, subType);
            return (knownType != null) ? knownType : new MIMEType(type, subType, null);
        }
    }

    public equals(otherMimeType: MIMEType) {

        let typeEq = this.type === otherMimeType.type;
        if (!typeEq) {
            return false;
        }
        let otherSubType = otherMimeType.subType;
        // Note: * and */* are treated as NOT equal !
        if (this._subType == null) {
            return (otherSubType == null);
        } else {
            return (this._subType === otherSubType);
        }
        return false;
    }

    public tostring():string{
        return this._type+'/'+this._subType;
    }
}
