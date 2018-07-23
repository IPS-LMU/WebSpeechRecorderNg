
  import {Component, AfterContentInit, ChangeDetectorRef, Input} from '@angular/core'
  import {Action} from "../../action/action";


  @Component({

    selector: 'app-audiodisplaycontrol',

    template: `<button (click)="playStartAction.perform()" [disabled]="playStartAction.disabled">Start</button> <button (click)="playStopAction.perform()" [disabled]="playStopAction.disabled">Stop</button>
	<p>{{status}}</p>`,
    styles: [
        `:host {
        flex: 0;

      }`]

  })
	export class AudioDisplayControl implements AfterContentInit {
		private _audioUrl:string;
    @Input() playStartAction:Action;
    @Input() playStopAction:Action;

	   status:string;

		audio:any;
		updateTimerId:any;


		constructor(private ref: ChangeDetectorRef) {

		}

    ngAfterContentInit() {

		}


		error(){
			this.status = 'ERROR';
		}


    }

