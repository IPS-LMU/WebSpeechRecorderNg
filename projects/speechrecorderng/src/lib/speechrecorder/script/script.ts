
export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";

export type Order = 'SEQUENTIAL' | 'RANDOM' | 'RANDOMIZED';

export interface Recinstructions{
  recinstructions:string;
}
export interface Mediaitem {
  text?: string,
  src?: string,
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

export interface Script {
  sections: Array<Section>;
}




