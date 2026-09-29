
export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "PRERECORDINGONLY" | "RECORDING";

export type Order = 'SEQUENTIAL' | 'RANDOM' | 'RANDOMIZED';

export type Decoration ='underline'
export type Style ='italic' | 'normal'
export type FontWeight='normal' | 'bold'
export type BlockType='p';
export type TextType='text' | 'font';

export interface Recinstructions{
  recinstructions:string;
}

export interface Text {
  type: TextType,
  color? : string,
  decoration? : Decoration,
  size?: string,
  weight?: FontWeight,
  style?: Style,
  text : string | Text;
}

export interface Block {
  type: BlockType,
  texts: Array<Text>
}
export interface Body{
  blocks?: Array<Block>,
}

export interface PromptDoc{
  body?: Body
}

export interface Mediaitem {
  text?: string,
  src?: string,
  promptDoc?: PromptDoc,
  mimetype?:string,
  defaultVirtualViewBox?:VirtualViewBox,
  alt?:string,
  /**
   * Start this media item (only audio is played) when its prompt is presented. A script that
   * sets `false` leaves the sound to the operator's play action. Default: true.
   */
  autoplay?: boolean
}

/**
 * How a media item is presented. The `mimetype` decides: `text/plain` is plain text,
 * `text/x-prompt` is a decorated prompt document, `image/*` an image and `audio/*` a sound
 * that is played as the prompt. Anything else is not rendered (and logged by the stage).
 */
export type MediaitemKind = 'text' | 'prompt' | 'image' | 'audio' | 'unsupported';

export interface PromptItem {
  type?:string;
  itemcode?: string,
  prerecdelay?: number,
  prerecording?: number,
  recduration?: number,
  duration?:number,
  postrecording?: number,
  postrecdelay?: number,
  recinstructions?: Recinstructions,
  mediaitems: Array<Mediaitem>
}

export interface Group {
  order?:Order;
  promptItems: Array<PromptItem>;
  _shuffledPromptItems: Array<PromptItem>;
}

export interface Section {
  mode: Mode;
  promptphase: PromptPhase;
  order?: Order;
  training: boolean;
  groups: Array<Group>;
  _shuffledGroups: Array<Group>;
}

export interface VirtualViewBox{
  height:number;
}

export interface Script {
  virtualViewBox?:VirtualViewBox;
  sections: Array<Section>;
}

export class PromptDocUtil{

  static toPlainTextString(promptDoc:PromptDoc):string{
    let pt="";
    let b=promptDoc.body;
    if(b!=null) {
      let blks=b.blocks
      if(blks) {
        for(let bli=0;bli<blks.length;bli++){
          let blk=blks[bli];
          let txts=blk.texts;
          for(let ti=0;ti<txts.length;ti++){
              let txtEl=txts[ti];
              let txt =txtEl.text;
            if( txtEl.type === 'font'){
              if(typeof txt === 'string'){
                pt = pt.concat(<string>txt);
              }else{
                let subTxtEl=<Text>txt;
                let subTxt=subTxtEl.text;
                if(typeof subTxt === 'string') {
                  pt=pt.concat(subTxt);
                }
              }
            }else if(typeof txt === 'string'){
              pt = pt.concat(<string>txt);
            }
          }
        }
      }
    }
    return pt;
  }
}

export class MediaitemUtil {
  /** Mimetype of a media item, normalised; a missing one means plain text (the script default). */
  static mimeType(mediaitem: Mediaitem|null|undefined): string {
    const mimetype = mediaitem?.mimetype;
    return (mimetype === null || mimetype === undefined || mimetype.trim() === '') ? 'text/plain' : mimetype.trim();
  }

  static kind(mediaitem: Mediaitem|null|undefined): MediaitemKind {
    if (mediaitem === null || mediaitem === undefined) {
      return 'unsupported';
    }
    const mimetype = MediaitemUtil.mimeType(mediaitem);
    if (mimetype === 'text/plain') {
      return 'text';
    }
    if (mimetype === 'text/x-prompt') {
      return 'prompt';
    }
    if (mimetype.startsWith('image')) {
      return 'image';
    }
    if (mimetype.startsWith('audio')) {
      return 'audio';
    }
    return 'unsupported';
  }

  /** An audio media item that is played when its prompt is presented (unless `autoplay: false`). */
  static isAutoplayedAudio(mediaitem: Mediaitem|null|undefined): boolean {
    return MediaitemUtil.kind(mediaitem) === 'audio' && mediaitem?.autoplay !== false;
  }

  static toPlainTextString(mediaitem: Mediaitem): string|null {

    let txt = mediaitem.text;
    let pd = mediaitem.promptDoc;
    if (txt == null) {
      let pt = null;
      if (pd != null) {
        pt = PromptDocUtil.toPlainTextString(pd);
      }
      return pt;
    } else {
      return txt;
    }
  }

  static description(mi: Mediaitem): string {
    let description = "";

    if (mi.alt != null) {
      description = description.concat(mi.alt)
    } else {
      let src = mi.src;
      let mimeType = MediaitemUtil.mimeType(mi);
      if (mimeType.startsWith("image")) {
        description = description.concat("IMAGE: ");
      } else if (mimeType.startsWith("audio")) {
        description = description.concat("AUDIO: ");
      } else if (mimeType.startsWith("video")) {
        description = description.concat("VIDEO: ");
      }
      let promptText = MediaitemUtil.toPlainTextString(mi);
      if (promptText != null) {
        description = description.concat(promptText);
      } else if (src != null) {
        let srcPn;
        try {
          let srcUrl = new URL(src);
          srcPn=srcUrl.pathname;
        }catch{
          srcPn=src;
        }

        // Get filename without extension
        let srcFnM=srcPn.match(/([^\/]*)$/);
        if(srcFnM && srcFnM.length==2){
          let srcFn=srcFnM[1];
          let srcFnNm=srcFn.replace(/[\.][^\.]*/,'');
          description = description.concat(srcFnNm);
        }
      }
    }
    return description;
  }
}

export class PromptitemUtil {
  /**
   * The first audio media item of a prompt, played or not — the play control offers it.
   *
   * A prompt carries one media item today; scanning the list keeps the stage working when a
   * script ships a text and a sound item side by side.
   */
  static audioitem(promptItem: PromptItem|null|undefined): Mediaitem|null {
    return PromptitemUtil.firstOfKind(promptItem, (mediaitem) => MediaitemUtil.kind(mediaitem) === 'audio');
  }

  /** The audio media item a take starts with, or `null` (`autoplay: false` leaves it to the operator). */
  static autoplayAudioitem(promptItem: PromptItem|null|undefined): Mediaitem|null {
    return PromptitemUtil.firstOfKind(promptItem, (mediaitem) => MediaitemUtil.isAutoplayedAudio(mediaitem));
  }

  private static firstOfKind(promptItem: PromptItem|null|undefined, matches: (mediaitem: Mediaitem) => boolean): Mediaitem|null {
    const mediaitems = promptItem?.mediaitems;
    if (!mediaitems) {
      return null;
    }
    for (const mediaitem of mediaitems) {
      if (matches(mediaitem)) {
        return mediaitem;
      }
    }
    return null;
  }

  static toPlainTextString(promptItem: PromptItem): string {

    let mis = promptItem.mediaitems;
    let description = "";
    if (mis) {

      let misSize = mis.length;
      for (let i = 0; i < misSize; i++) {
        let mi = mis[i];
        description = description.concat(MediaitemUtil.description(mi));
        if (i + 1 < misSize) {
          // not last item
          description = description.concat(", ");
        }
      }
    }
    return description;
  }
}


