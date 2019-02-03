import {AfterViewInit, ChangeDetectorRef, Component, Inject} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";

import {UUID} from "../../../projects/speechrecorderng/src/lib/utils/utils";
import {ProjectService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {
  Group, Mediaitem,
  PromptItem,
  Script,
  Section
} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

@Component({
  selector: 'app-scripts',
  templateUrl: 'scripts.html',
  styles:[]
})
export class ScriptsComponent implements  AfterViewInit {

  projectName:string;
  scripts:Array<Script>
  importFileList:FileList=null;
  constructor(private route: ActivatedRoute, private chDetRef:ChangeDetectorRef,private scriptService:ScriptService) {
  }



  ngAfterViewInit() {
    this.route.params.subscribe((params: Params) => {
      this.projectName = params['projectName'];
      if (this.projectName) {
        this.scriptService.projectScriptsObserver(this.projectName).subscribe(scrs=>{
          console.info("List " + scrs.length + " scripts")
          this.scripts=scrs;

          this.chDetRef.detectChanges()
        })
      }
    })
  }

  importFileChanged(event: HTMLInputEvent){
    let et=event.target;
    let files=et.files;
    for(let i=0;i<files.length;i++) {
      console.log(files[i].name+": "+files[i].type);
    }
    this.importFileList=files;
  }

  isImportable(){
    let importable=true;
    if(this.importFileList) {
      for (let i = 0; i < this.importFileList.length; i++) {
        let importFile=this.importFileList[i]
        let importFileType=importFile.type;
        if(!(importFileType === 'application/xml' || importFileType === 'text/xml')){
          importable=false;
        }
      }
    }else{
      importable=false;
    }
    return importable
  }

  private parsePromptItem(piEl:Element):PromptItem{
    let pi:PromptItem={mediaitems:new Array<Mediaitem>()};
    if(piEl.tagName==='recording'){
      pi.itemcode=piEl.getAttribute('itemcode');
      console.log(pi.itemcode)
    }else if(piEl.tagName==='nonrecording'){
        //TODO
    }
    let recPromptEls=piEl.getElementsByTagName('recprompt')
    let rpEl=recPromptEls[0]
    let miEls=rpEl.getElementsByTagName('mediaitem')
    for(let mii=0;mii<miEls.length;mii++){
      // TODO text mediaitems only
      let mi:Mediaitem={text:miEls[mii].textContent}
      pi.mediaitems.push(mi)
    }
    return pi;
  }

  importScript(){
    console.log("Import script!");
    let xmlParser=new DOMParser();
    let fileReader=new FileReader()
    for (let i = 0; i < this.importFileList.length; i++) {
      let importFile=this.importFileList[i]
      fileReader.readAsText(importFile);
      fileReader.onload = (pe)=>{
        console.log(fileReader.result)
        let xmlSrc=<string>fileReader.result;
        let doc=xmlParser.parseFromString(xmlSrc, <SupportedType>importFile.type);
        let s:Script={scriptId:UUID.generate(),sections:new Array<Section>()};
        let scrEl=doc.documentElement;
        let sctEls=scrEl.getElementsByTagName('section')
        for(let si=0;si<sctEls.length;si++){
          let sct=sctEls[si];
          console.log("parse section "+si)


          let section:Section={mode:"MANUAL",promptphase:"IDLE",training:false,groups:new Array<Group>()};
          // TODO apply attributes

          // get groups or prompt item elements
          let grsOrPis=sct.childNodes;
          for(let gi=0;gi<grsOrPis.length;gi++){
              let grOrPi=grsOrPis[gi];
              if(grOrPi instanceof Element){
                let grOrPiEl=<Element>grOrPi;
                if(grOrPiEl.tagName === 'group'){
                    // TODO !!!
                }else if(grOrPiEl.tagName === 'recording' || grOrPiEl.tagName === 'nonrecording'){
                    let pi=this.parsePromptItem(grOrPiEl);
                    let grPis=new Array<PromptItem>()
                     grPis.push(pi);
                    let gr:Group={promptItems:grPis};
                    section.groups.push(gr);
                }
              }
          }
        }
        let addedScr:Script;
        this.scriptService.addEntityObserver(s,s.scriptId,'bla').subscribe((ns)=>{
            addedScr=ns;
        },(err)=>{
          // TODO
        },()=>{
          if(addedScr) {
            this.scripts.push(addedScr)
          }
        })
      }
    }

  }

}
