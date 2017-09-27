import {Recinstructions} from "../session/prompting";

export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";


export interface Recinstructions{
  recinstructions:string;
}
export interface Mediaitem {
  text: string;
}

export interface PromptUnit {
  itemcode?: string,
  prerecording: number,
  recduration?: number,
  postrecording: number,
  recinstructions?: Recinstructions,
  mediaitems: Array<Mediaitem>
}

export interface Section {
  mode: Mode;
  promptphase: PromptPhase;
  training: boolean;
  promptUnits: Array<PromptUnit>;
}

export interface Script {
  sections: Array<Section>;
}




