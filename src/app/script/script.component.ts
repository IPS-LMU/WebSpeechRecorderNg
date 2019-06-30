import { Component, OnInit } from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {
    Group,
    Mediaitem, PromptItem,
    Script,
    Section
} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";
import {MatTreeNestedDataSource} from "@angular/material";
import {Observable} from "rxjs";
import {NestedTreeControl} from "@angular/cdk/tree";

interface ScriptTreeNode {
    name: string;
    type: string;
    prompt?: string;
    children?: ScriptTreeNode[];
    section?: Section;
    group?:Group;
    promptItem?:PromptItem;
}

@Component({
  selector: 'app-script',
  templateUrl: './script.component.html',
  styleUrls: ['./script.component.css']
})
export class ScriptComponent implements OnInit {

    private projectName:string;
    private script:Script;
    treeControl = new NestedTreeControl<ScriptTreeNode>(node => node.children);
    dataSource:MatTreeNestedDataSource<ScriptTreeNode>=new MatTreeNestedDataSource<ScriptTreeNode>()

  constructor(private route: ActivatedRoute,private scriptService:ScriptService) { }

    ngOnInit() {
        this.route.params.subscribe((params: Params) => {
            this.projectName = params['projectName'];
            this.fetchScript(params['scriptId']);
        })
    }

    hasChild = (_: number, node: ScriptTreeNode) => !!node.children && node.children.length > 0;

  fetchScript(scriptId:number|string){
      let scr:Script=null
      this.scriptService.scriptObservable(scriptId).subscribe((value)=>{
          scr=value;
      },error =>{

      },()=>{
          this.script=scr;
          this.dataSource.data=this.scriptDataSource()
      })
  }


  // scriptDataSource():Observable<ScriptTreeNode>{
  //
  //     new Observable((subscriber)=>{
  //        this.script
  //     })
  // }

    scriptDataSource():ScriptTreeNode[]{

      let sectionsNodes=new Array<ScriptTreeNode>()
       for(let i=0;i<this.script.sections.length;i++){
           let sect=this.script.sections[i];

           let grNodes=new Array<ScriptTreeNode>()
           for(let j=0;j<sect.groups.length;j++){
               let gr=sect.groups[j];
               let piNodes=new Array<ScriptTreeNode>()
               for(let k=0;k<gr.promptItems.length;k++) {
                   let pi=gr.promptItems[k]
                   let mis=pi.mediaitems;
                   let pr=''
                   if(mis && mis.length>0){
                       pr=mis[0].text
                   }
                   let piNode={name:pi.itemcode,type:pi.type,prompt:pr,promptItem:pi}
                   piNodes.push(piNode)
               }
               let grNode={name:j.toString(),type:'Group',children:piNodes,group:gr}
               grNodes.push(grNode)
           }
           let sectNm='[section]';
           // if(sect.name){
           //     sectNm=sect[i].name
           // }
           let secNode={name:sectNm,type:'Section',children:grNodes,section:sect}
           sectionsNodes.push(secNode)
       }

        let sectionsScriptNode={name:'Sections',type:'Script',children: sectionsNodes}
      let scriptDataSource=new Array<ScriptTreeNode>()
        scriptDataSource.push(sectionsScriptNode)
        return scriptDataSource
    }

    addNewNode(parentNode:ScriptTreeNode){
        console.info("New: "+parentNode.type)
        if(parentNode.type === 'Group'){
            let mis=new Array<Mediaitem>()
            mis.push({text:'Bla bla'})
            //let newRecNode={name:'XXX',type:'Recording',prompt:'Bla Bla'}
            //parentNode.children.push(newRecNode);
            let pi={itemcode:'XXX',mediaitems:mis} as PromptItem;
            parentNode.group.promptItems.push(pi);
            //parent.children.push({item: name} as TodoItemNode);
            //this.dataChange.next(this.data);
            this.dataSource.data=this.scriptDataSource()
        }
    }

}
