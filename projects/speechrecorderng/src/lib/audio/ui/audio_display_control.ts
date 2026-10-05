import {Component, Input, ViewChild} from '@angular/core'
import {Action} from "../../action/action";
import {MatCheckbox, MatCheckboxChange} from "@angular/material/checkbox";
import {AudioClip} from "../persistor";
import {SprTranslator} from "../../i18n/translate";


  @Component({
    selector: 'audio-display-control',
    template: `
        <div #controlPanel style="display:flex;flex-direction: row;">
          <fieldset>

            <legend>{{i18n.t('spr.audio.play')}}</legend>

            <button (click)="playStartAction?.perform()" [disabled]="playStartAction?.disabled"
              [style.color]="playStartAction?.disabled ? 'var(--spr-ink-subtle, #6D7C98)' : 'var(--spr-ok, #73A790)'" [matTooltip]="i18n.t('spr.audio.playAll')" [attr.aria-label]="i18n.t('spr.audio.playAll')">
              <mat-icon>play_arrow</mat-icon>
            </button>
            <button (click)="playSelectionAction?.perform()" [disabled]="playSelectionAction?.disabled"
              [style.color]="playSelectionAction?.disabled ? 'var(--spr-ink-subtle, #6D7C98)' : 'var(--spr-ok, #73A790)'" [matTooltip]="i18n.t('spr.audio.playSelection')" [attr.aria-label]="i18n.t('spr.audio.playSelection')">
              <mat-icon>play_circle_outline</mat-icon>
            </button>
            <button (click)="playStopAction?.perform()" [disabled]="playStopAction?.disabled"
              [style.color]="playStopAction?.disabled ? 'var(--spr-ink-subtle, #6D7C98)' : 'var(--spr-caution, #D7B17C)'" [attr.aria-label]="i18n.t('spr.audio.stopPlayback')">
            <mat-icon>stop</mat-icon>
            </button>&nbsp;
            <mat-checkbox #autoplaySelectionCheckbox (change)="autoPlaySelectionChange($event)">{{i18n.t('spr.audio.autoplayOnSelect')}}
            </mat-checkbox>
          </fieldset>
          <fieldset>

            <legend>{{i18n.t('spr.audio.zoom')}}</legend>
            <button (click)="zoomFitToPanelAction?.perform()"
            [disabled]="zoomFitToPanelAction?.disabled">{{i18n.t('spr.audio.fitToPanel')}}</button>
            <button (click)="zoomOutAction?.perform()"
            [disabled]="zoomOutAction?.disabled">{{i18n.t('spr.audio.zoomOut')}}</button>
            <button (click)="zoomInAction?.perform()"
            [disabled]="zoomInAction?.disabled">{{i18n.t('spr.audio.zoomIn')}}</button>
            <button (click)="zoomSelectedAction?.perform()"
            [disabled]="zoomSelectedAction?.disabled">{{i18n.t('spr.audio.selected')}}</button>
          </fieldset>
          <fieldset>
            <legend>{{i18n.t('spr.audio.selection')}}</legend>
            {{audioClip?.selection?.leftFrame}} @if (audioClip?.selection) {
            <span>to</span>
            } {{audioClip?.selection?.rightFrame}}
            <button (click)="clearSelection()" [disabled]="audioClip?.selection==null"
              [style.color]="hasSelection() ? 'var(--spr-chrome, #2A4765)' : 'var(--spr-ink-subtle, #6D7C98)'" [matTooltip]="i18n.t('spr.audio.clearSelection')" [attr.aria-label]="i18n.t('spr.audio.clearSelection')">
              <mat-icon>clear</mat-icon>
            </button>

          </fieldset>
        </div>`,
    styles: [
        `:host {
                 flex: 0;
                 display: block;
                 padding: 6px 8px;
                 background: var(--spr-canvas, #0E1A26);
                 color: var(--spr-canvas-ink, #FFFFFF);
                 font-size: var(--spr-type-caption, 13.6px);
               }

        /* Plain HTML buttons, so the browser default chrome has to go. */
        button {
          display: inline-grid;
          place-items: center;
          min-width: 40px;
          height: 40px;
          padding: 0 8px;
          border: none;
          border-radius: var(--spr-r-md, 12px);
          background: transparent;
          color: var(--spr-canvas-ink, #FFFFFF);
          font-family: inherit;
          font-size: var(--spr-type-caption, 13.6px);
          cursor: pointer;
        }

        button:hover:not([disabled]) {
          background: var(--spr-chrome-tint, rgba(255, 255, 255, 0.14));
        }

        button[disabled] {
          cursor: default;
        }

        fieldset {
          border: 1px solid var(--spr-canvas-grid, #24497E);
          border-radius: var(--spr-r-sm, 6px);
          color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
        }

        legend {
          padding: 0 6px;
          color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
        }

        /* Material renders the checkbox label itself, so the ink and the box state come
           from its tokens. The control sits on the dark canvas surface. */
        mat-checkbox {
          --mat-checkbox-label-text-color: var(--spr-canvas-ink, #FFFFFF);
          --mat-checkbox-unselected-icon-color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
          --mat-checkbox-selected-icon-color: var(--spr-ok, #73A790);
          --mat-checkbox-selected-checkmark-color: var(--spr-ok-ink, #000000);
          --mat-checkbox-selected-hover-state-layer-color: var(--spr-canvas-ink, #FFFFFF);
          --mat-checkbox-selected-focus-state-layer-color: var(--spr-canvas-ink, #FFFFFF);
          --mat-checkbox-unselected-hover-state-layer-color: var(--spr-canvas-ink, #FFFFFF);
          --mat-checkbox-disabled-label-color: var(--spr-canvas-ink-muted, rgba(255, 255, 255, 0.78));
          color: var(--spr-canvas-ink, #FFFFFF);
        }`
    ],
    standalone: false
})
	export class AudioDisplayControl {

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

		constructor(public readonly i18n: SprTranslator) {}

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
            this.autoPlayOnSelectToggleAction.perform(ch.checked);
        }
    }

		error(){
			this.status = 'ERROR';
		}


    }

