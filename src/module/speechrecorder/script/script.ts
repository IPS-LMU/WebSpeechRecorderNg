export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";


export interface Mediaitem {
  text: string;
}

export interface PromptUnit {
  itemcode?: string,
  prerecording: number,
  recduration?: number,
  postrecording: number,
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




