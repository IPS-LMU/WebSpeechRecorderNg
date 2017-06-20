
  export class Mediaitem{

    text:string;
  }
    export class PromptUnit {
      itemcode:string;
      prerecording:number;
      recduration: number;
      postrecording:number;
      mediaitems:Array<Mediaitem>;
  }

  export type Mode = "MANUAL" | "AUTOPROGRESS" | "AUTORECORDING";
  export type PromptPhase = "IDLE" | "PRERECORDING" | "RECORDING";

  export class Section {

    mode:Mode;
    promptphase:PromptPhase;
      training: boolean;
      promptUnits: Array<PromptUnit>;

  }


  export class Script {

    sections:Array<Section>;


  }


