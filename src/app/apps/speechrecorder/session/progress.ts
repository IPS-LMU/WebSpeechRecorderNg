import {Component, ViewChild, ViewChildDecorator} from '@angular/core'
import {Script,Section,PromptUnit} from "../script/script";

@Component({

  selector: 'app-sprprogress',

  template: `

      <table class="table table-bordered">
          <thead>
          <tr>
              <th>#</th><!--<th>Code</th>-->
              <th>Prompt</th>
              <th>Status</th>
          </tr>
          </thead>
          <tbody>
          <ng-container *ngIf="script">
              <ng-container *ngFor="let section of script.sections; let si = index;">
                  <tr *ngFor="let pu of section.promptUnits; let pi=index;"
                      [class.bg-info]="si===sectionIdx && pi===promptIndex">
                      <td>{{si}}:{{pi}}</td>
                      <td>{{pu.mediaitems[0].text}}</td>
                      <td><span class="glyphicon glyphicon-unchecked"></span></td>
                  </tr>
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
  sectionIdx=0;
  promptIndex=0;
  setSelected(sectionIdx:number,promptIndex:number){
    this.sectionIdx=sectionIdx;
    this.promptIndex=promptIndex;
  }
}
