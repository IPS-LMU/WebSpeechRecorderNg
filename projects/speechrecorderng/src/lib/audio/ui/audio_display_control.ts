import {Component, AfterContentInit, ChangeDetectorRef, Input, ViewChild} from '@angular/core'
import {Action} from "../../action/action";
import {MatCheckbox, MatCheckboxChange} from "@angular/material/checkbox";
import {AudioClip} from "../persistor";


  @Component({

    selector: 'audio-display-control',

    template: `
        <div #controlPanel style="display:flex;flex-direction: row;">
            <fieldset>

                <legend>Play</legend>

                <button (click)="playStartAction?.perform()" [disabled]="playStartAction?.disabled"
                        [style.color]="playStartAction?.disabled ? 'grey' : 'green'" matTooltip="Play all">
                    <mat-icon>play_arrow</mat-icon>
                </button>
                <button (click)="playSelectionAction?.perform()" [disabled]="playSelectionAction?.disabled"
                        [style.color]="playSelectionAction?.disabled ? 'grey' : 'green'" matTooltip="Play selection">
                    <mat-icon>play_circle_outline</mat-icon>
                </button>
                <button (click)="playStopAction?.perform()" [disabled]="playStopAction?.disabled"
                        [style.color]="playStopAction?.disabled ? 'grey' : 'yellow'">
                    <mat-icon>stop</mat-icon>
                </button>&nbsp;
                <mat-checkbox #autoplaySelectionCheckbox (change)="autoPlaySelectionChange($event)">Autoplay on select
                </mat-checkbox>
            </fieldset>
            <fieldset>

                <legend>Zoom</legend>
                <button (click)="zoomFitToPanelAction?.perform()"
                        [disabled]="zoomFitToPanelAction?.disabled">{{zoomFitToPanelAction?.name}}</button>
                <button (click)="zoomOutAction?.perform()"
                        [disabled]="zoomOutAction?.disabled">{{zoomOutAction?.name}}</button>
                <button (click)="zoomInAction?.perform()"
                        [disabled]="zoomInAction?.disabled">{{zoomInAction?.name}}</button>
                <button (click)="zoomSelectedAction?.perform()"
                        [disabled]="zoomSelectedAction?.disabled">{{zoomSelectedAction?.name}}</button>
            </fieldset>
            <fieldset>
                <legend>Selection</legend>
                {{audioClip?.selection?.leftFrame}} <span
                    *ngIf="audioClip?.selection">to</span> {{audioClip?.selection?.rightFrame}}
                <button (click)="clearSelection()" [disabled]="audioClip?.selection==null"
                        [style.color]="hasSelection() ? 'red' : 'grey'" matTooltip="Clear selection">
                    <mat-icon>clear</mat-icon>
                </button>

            </fieldset>
        </div>`,
    styles: [
        `:host {
        flex: 0;

      }`]

  })
	export class AudioDisplayControl implements AfterContentInit {

    @Input() audioClip: AudioClip|null=null;

    @ViewChild(MatCheckbox, { static: true })
    private autoplaySelectedCheckbox: MatCheckbox|null=null;
    @Input() playStartAction: Action<void>|undefined;
    @Input() playSelectionAction: Action<void>|undefined;
    @Input() playStopAction: Action<void>|undefined;
    @Input() zoomInAction: Action<void>|null=null;
    @Input() zoomOutAction: Action<void>|null=null;
    @Input() zoomFitToPanelAction: Action<void>|undefined;
    @Input() zoomSelectedAction: Action<void>|undefined;
    @Input() autoPlayOnSelectToggleAction: Action<boolean>|undefined;
	   status:string|null=null;

		audio:any;

		constructor(private ref: ChangeDetectorRef) {

		}

    ngAfterContentInit() {

		}

    clearSelection(){
        if(this.audioClip!=null){
            this.audioClip.selection=null
        }
    }

      hasSelection():boolean{
          let hs=false;
          if(this.audioClip){
              hs=(this.audioClip.selection!=null);
          }
          return hs;
      }

    autoPlaySelectionChange(ch: MatCheckboxChange) {
        if (this.autoPlayOnSelectToggleAction) {
            this.autoPlayOnSelectToggleAction.perform(ch.checked)
        }
    }

		error(){
			this.status = 'ERROR';
		}


    }

