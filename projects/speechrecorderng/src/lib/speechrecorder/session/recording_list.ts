import {Component} from "@angular/core";
import {RecordingFile} from "../recording";

@Component({

  selector: 'app-recordinglist',

  template: `
    <h2>Recording list</h2>
    <ol>
      <li *ngFor="let rf of recordingList">{{rf.uuid}}</li>
    </ol>
  `,
  styles: [`:host {
    position: relative;
    margin: 0;
    padding: 0;
    background: lightgrey;
    width: 100%; /* use all horizontal available space */
    flex: 1; /* ... and fill rest of vertical available space (other components have flex 0) */

    /* Workaround for Firefox
    If the progress table gets long (script with many items) FF increases the height of the overflow progressContainer and
    the whole app does not fit into the page anymore. The app overflows and shows a vertical scrollbar for the whole app.
    See http://stackoverflow.com/questions/28636832/firefox-overflow-y-not-working-with-nested-flexbox
    */
    min-height: 0px;

    display: flex; /* flex container: left traffic light, right prompter (container) */
    flex-direction: row;
    flex-wrap: nowrap; /* wrap could completely destroy the layout */
  }`]

})
export class RecordingList{
  recordingList:Array<RecordingFile>=new Array<RecordingFile>();

}
