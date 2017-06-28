import {Component,Input} from '@angular/core'
import { Item } from './sessionmanager';


@Component({

  selector: 'app-sprprogress',

  template: `

      <table class="mat-typography">
          <thead>
          <tr>
              <th>#</th><!--<th>Code</th>-->
              <th>Prompt</th>
              <th>Status</th>
          </tr>
          </thead>
          <tbody>
          <ng-container *ngIf="items">
             
            <tr *ngFor="let item of items; let itIdx=index;"
                      [class.selRow]="itIdx===selectedItemIdx">
                      <td>{{itIdx}}</td>
                      <td>{{item.promptAsString}}</td>
                <td><md-icon *ngIf="item.recs && item.recs.length>0" >done</md-icon><span class="glyphicon" [class.glyphicon-unchecked]="!item.recs || item.recs.length===0" [class.glyphicon-check]="item.recs && item.recs.length>0"></span></td>
                  </tr>
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
  }`,`table {
          border-collapse: collapse;
      }

      table, th, td {
          border: 1px solid lightgrey;
          padding: 0.5em;
      }`,`
      .selRow{
          background: lightblue;
      }
      `]

})
export class Progress{
    @Input() items:Array<Item>;
    @Input() selectedItemIdx=0;
}
