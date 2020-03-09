
export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";

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
  defaultVirtualViewBox?:VirtualViewBox
}

export interface PromptItem {
  type?:string;
  itemcode?: string,
  prerecording: number,
  recduration?: number,
  postrecording: number,
  recinstructions?: Recinstructions,
  mediaitems: Array<Mediaitem>
}

export interface Group {
  promptItems: Array<PromptItem>;
}

export interface Section {
  mode: Mode;
  promptphase: PromptPhase;
  training: boolean;
  groups: Array<Group>;
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
              let txt=txtEl.text;
              if( txtEl.type === 'font' && txt instanceof Text){
                let tfo:Text=<Text>txt;
                if(typeof tfo.text ==='string') {
                  pt = pt.concat(<string>tfo.text);
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
  static toPlainTextString(mediaitem:Mediaitem):string{

    let txt=mediaitem.text;
    let pd=mediaitem.promptDoc;
    if (txt==null){
      let pt="";
      if(pd!=null) {
        let pdPStr=PromptDocUtil.toPlainTextString(pd);
        pt=pt.concat(pdPStr);
      }
      return pt;
    }else{
      return txt;
    }
  }
}

export class PromptitemUtil {
   static toPlainTextString(promptItem:PromptItem):string {
     let pt = "";

     if (promptItem.mediaitems && promptItem.mediaitems.length > 0) {
       let mi = promptItem.mediaitems[0];
       pt = MediaitemUtil.toPlainTextString(mi);
     }
     return pt;
   }
}


