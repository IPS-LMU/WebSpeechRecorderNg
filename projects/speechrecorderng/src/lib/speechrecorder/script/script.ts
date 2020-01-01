import {Recinstructions} from "../session/prompting";

export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";

export type Decoration ='underline'
export type Style ='italic' | 'normal'
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
  style?: Style,
  text : string | Text;
}

export interface Block {
  type: BlockType,
  texts: Array<Text>
}

export interface Mediaitem {
  text?: string,
  src?: string,
  blocks?: Array<Block>,
  mimetype?:string
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

export interface Script {
  sections: Array<Section>;
}




