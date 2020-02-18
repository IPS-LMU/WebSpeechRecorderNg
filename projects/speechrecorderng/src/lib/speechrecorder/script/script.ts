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




