import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params} from "@angular/router";
import {ScriptService} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service";
import {
    Group,
    Mediaitem, PromptItem,
    Script,
    Section
} from "../../../projects/speechrecorderng/src/lib/speechrecorder/script/script";

import {BehaviorSubject, Observable} from "rxjs";
import {NestedTreeControl} from "@angular/cdk/tree";
import {CollectionViewer} from "@angular/cdk/collections";
import {merge} from "rxjs/index";
import {map} from "rxjs/operators";
import {MatTreeNestedDataSource} from "@angular/material/tree";

interface ScriptTreeNode {
    name: string;
    type: string;
    //isExpanded: boolean;
    prompt?: string;
    children?: ScriptTreeNode[];
    section?: Section;
    group?:Group;
    promptItem?:PromptItem;
}

export class ScriptTreeDataSource extends MatTreeNestedDataSource<ScriptTreeNode>{
    dataChange = new BehaviorSubject<ScriptTreeNode[]>([]);

    constructor(private _treeControl: NestedTreeControl<ScriptTreeNode>) {
        super()
    }

    get data(): ScriptTreeNode[] { return this.dataChange.value; }
    set data(value: ScriptTreeNode[]) {
        this._treeControl.dataNodes = value;

        this.dataChange.next(value);
    }
    connect(collectionViewer: CollectionViewer): Observable<ScriptTreeNode[]> {
        // this._treeControl.expansionModel.onChange.subscribe(change => {
        //     if ((change as SelectionChange<DynamicFlatNode>).added ||
        //         (change as SelectionChange<DynamicFlatNode>).removed) {
        //         this.handleTreeControl(change as SelectionChange<DynamicFlatNode>);
        //     }
        // });
        //
        // return merge(collectionViewer.viewChange, this.dataChange).pipe(map(() => this.data));

        return merge(collectionViewer.viewChange,this.dataChange).pipe(map(()=>this.data))
    }
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
    dataSource:ScriptTreeDataSource=new ScriptTreeDataSource(this.treeControl)

  constructor(private route: ActivatedRoute,private scriptService:ScriptService,private changeDetectorRef: ChangeDetectorRef) { }

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
            //this.dataSource.data=this.scriptDataSource()
            let dataSrcTmp=this.dataSource.data;
            //this.dataSource.data=null;
            //this.dataSource.data=dataSrcTmp;
            this.dataSource.dataChange.next(dataSrcTmp)
            //this.changeDetectorRef.detectChanges()

        }
    }

}


export class ScriptTreeFlatComponent{

}
