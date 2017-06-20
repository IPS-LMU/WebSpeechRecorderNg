import {Component, ViewChild, ViewChildDecorator} from '@angular/core'
import {Script} from "../script/script";

@Component({

  selector: 'app-sprprogress',

  template: `
    
    <table class="table table-bordered">
      <thead><tr><th>#</th><!--<th>Code</th>-->
      <th>Prompt</th>
        <th>Status</th></tr></thead>
      <tbody>
      <ng-container *ngIf="script">
    <ng-container *ngFor="let section of script.sections; let si = index;">
      <tr *ngFor="let promptUnit of section.promptUnits; let pi=index;" [class.bg-info]="si===0 && pi===1"><td>{{si}}:{{pi}}</td><td>{{promptUnit.mediaitems[0].text}}</td><td><span class="glyphicon glyphicon-unchecked"></span></td></tr>
    </ng-container>
      </ng-container>
      </tbody>
    </table>
  `,
  styles: [`:host {
    overflow-x: auto;
    overflow-y: scroll;
  // display: flex;
  // flex-direction: column;
    background: white;
    padding: 10pt;
    flex: 1;
    min-height: 1px;
  // height: 100 px;
  }`,
    `table{
    min-height: 1px;
    height: 100%;
  }`]

})
export class Progress{
  script: Script;
  sectionIdx:number;
  promptIndex:number
  setSelected(sectionIdx:number,promptIndex:number){
    this.sectionIdx=sectionIdx;
    this.promptIndex=promptIndex;
  }
}
