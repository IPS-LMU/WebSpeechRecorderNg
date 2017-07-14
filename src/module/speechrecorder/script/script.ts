
  export class Mediaitem{

    text:string;
  }



    export class PromptUnit {
      itemcode:string;
      prerecording:number;
      recduration: number;
      postrecording:number;
      mediaitems:Array<Mediaitem>;


      toString():string {
        if (this.mediaitems && this.mediaitems.length > 0) {
          // TODO (real) media items (image,audio,video) not supported yet
          return this.mediaitems[0].text;
        } else{
          return ''
        }

      }
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


