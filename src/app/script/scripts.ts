import {AfterViewInit, ChangeDetectorRef, Component, Inject, OnInit, ViewChild} from '@angular/core';
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
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {Session} from "../../../projects/speechrecorderng/src/lib/speechrecorder/session/session";

interface HTMLInputEvent extends Event {
  target: HTMLInputElement & EventTarget;
}

@Component({
  selector: 'app-scripts',
  templateUrl: 'scripts.html',
  styleUrls: ['../../speechrecorder_mat.scss']
})
export class ScriptsComponent implements  OnInit {

  projectName:string;
  scripts:Array<Script>
  //scriptForm:FormGroup;
  //newScript:Script;
  importFileList:FileList=null;
  @ViewChild('scriptFileInput', { static: true }) scriptFileInput:HTMLInputElement;
  uploading=false;

  displayedColumns: string[] = ['scriptId','id','action'];
  constructor(private route: ActivatedRoute, private chDetRef:ChangeDetectorRef,private scriptService:ScriptService) {
  }



  ngOnInit() {
    // this.scriptForm = new FormGroup({
    //   'name': new FormControl(this.newScript.id)
    // });
    this.route.params.subscribe((params: Params) => {
      this.projectName = params['projectName'];
        this.fetchScripts()
    })
  }

  //get nameField() { return this.scriptForm.get('name'); }

  fetchScripts(){
      if (this.projectName) {
          this.scriptService.projectScriptsObserver(this.projectName).subscribe(scrs=>{
              console.info("List " + scrs.length + " scripts")
              this.scripts=scrs;

              //this.chDetRef.detectChanges()
          })
      }
  }
  // addNewScript(){
  //   this.newScript.id=this.nameField.value;
  //   // this.scriptService.scriptAddObservable(this.projectName,this.newScript).subscribe((n)=>{
  //   //
  //   // },(err)=>{
  //   //   // TODO
  //   // },()=>{
  //   //   this.scriptForm.reset()
  //   //   this.fetchScripts()
  //   // })
  // }


  uploadScriptFiles(){
    this.uploading=true;
    //console.log("Uploading ...")
    //this.scriptFileInput.click()
  }

  importFileChanged(event: Event){
    let et=event.target;

    if(et instanceof HTMLInputElement)
    {
      let files = et.files;
      this.uploading = false
      // for(let i=0;i<files.length;i++) {
      //   console.debug(files[i].name+": "+files[i].type);
      // }
      this.importFileList = files;
    }
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
      //console.log(pi.itemcode)
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

  addNewScript(){

        let ns: Script = {scriptId: UUID.generate(), project: this.projectName,sections:new Array<Section>()}
        this.scriptService.addProjectScript(ns.project, ns).subscribe((s) => {
              //console.log("Scripts: NEXT (push) "+s.sessionId)
              //mat-table does not update here !!
              this.scripts.push(s);
            }, (err) => {
              // TODO err
              console.error("Scripts: ERROR")
            },
            () => {
              //console.debug("Scripts: COMPLETE")
              // refresh table
              this.fetchScripts()
            })
  }


  importScript(){
    console.debug("Import script!");
    let xmlParser=new DOMParser();
    let fileReader=new FileReader()
    if(this.importFileList) {
      for (let i = 0; i < this.importFileList.length; i++) {
        let importFile = this.importFileList[i]
        fileReader.readAsText(importFile);
        fileReader.onload = (pe) => {
          //console.debug(fileReader.result)
          let xmlSrc = <string>fileReader.result;
          let doc = xmlParser.parseFromString(xmlSrc, <SupportedType>importFile.type);
          let s: Script = {scriptId: UUID.generate(), sections: new Array<Section>()};

          let scrEl = doc.documentElement;
          let idAttr=scrEl.getAttribute('id')
          if(idAttr){
            s.id=idAttr
          }
          let sctEls = scrEl.getElementsByTagName('section')
          for (let si = 0; si < sctEls.length; si++) {
            let sct = sctEls[si];
            //console.log("parse section " + si)


            let section: Section = {mode: "MANUAL", promptphase: "IDLE", training: false, groups: new Array<Group>()};
            // TODO apply attributes

            // get groups or prompt item elements
            let grsOrPis = sct.childNodes;
            for (let gi = 0; gi < grsOrPis.length; gi++) {
              let grOrPi = grsOrPis[gi];
              if (grOrPi instanceof Element) {
                let grOrPiEl = <Element>grOrPi;
                if (grOrPiEl.tagName === 'group') {
                  // TODO !!!
                } else if (grOrPiEl.tagName === 'recording' || grOrPiEl.tagName === 'nonrecording') {
                  let pi = this.parsePromptItem(grOrPiEl);
                  let grPis = new Array<PromptItem>()
                  grPis.push(pi);
                  let gr: Group = {promptItems: grPis};
                  section.groups.push(gr);
                }
              }
            }

            s.sections.push(section)
          }
          s.project = this.projectName
          let addedScr: Script;
          this.scriptService.addProjectScript(this.projectName, s).subscribe((ns) => {
            //addedScr=ns;
          }, (err) => {
            // TODO
            this.uploading=false
            this.importFileList=null
            this.fetchScripts()
          }, () => {
            // if(addedScr) {
            //   this.scripts.push(addedScr)
            // }
            this.uploading=false
            this.importFileList=null
            this.fetchScripts()

          })
        }
      }
    }

  }

}
