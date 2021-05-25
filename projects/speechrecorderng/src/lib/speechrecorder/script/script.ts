
export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";

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
  autoplay?:boolean,
  modal?:boolean,
  defaultVirtualViewBox?:VirtualViewBox,
  alt?:string
}

export interface PromptItem {
  type?:string;
  rectype?: string,
  itemcode?: string,
  prerecording: number,
  recduration?: number,
  postrecording: number,
  recinstructions?: Recinstructions,
  blocked?:boolean,
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
      let mimeType = mi.mimetype;
      if (!mimeType) {
        mimeType = 'text/plain';
      }
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


