import {
    Component,
    ViewChild,
    ChangeDetectorRef,
    AfterViewInit, Input, AfterContentInit, OnInit, AfterContentChecked, AfterViewChecked, ElementRef,
} from '@angular/core'

import {AudioClip, Selection} from '../audio/persistor'
import {AudioPlayer, AudioPlayerListener, AudioPlayerEvent, EventType} from '../audio/playback/player'
import {ActivatedRoute, Params} from "@angular/router";
import {Action} from "../action/action";
import {AudioDisplayScrollPane} from "../audio/ui/audio_display_scroll_pane";
import {AudioContextProvider} from "../audio/context";
import {MIMEType} from "../net/mimetype";

@Component({

    selector: 'mediadisplayplayer',

    template: `
        <div class="mediaview">
            <video #videoEl class="videoView" [hidden]="!video"></video>
            <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
        </div>
        <audio-display-control [audioClip]="audioClip"
                               [playStartAction]="playStartAction"
                               [playSelectionAction]="playSelectionAction"
                               [playStopAction]="playStopAction"
                               [autoPlayOnSelectToggleAction]="ap?.autoPlayOnSelectToggleAction"
                               [zoomInAction]="zoomInAction"
                               [zoomOutAction]="zoomOutAction"
                               [zoomSelectedAction]="zoomSelectedAction"
                               [zoomFitToPanelAction]="zoomFitToPanelAction"></audio-display-control><p>{{status}}
    `,
    styles: [
            `:host {
            display: flex;
            flex-direction: column;
            position: absolute;
            bottom: 0px;
            height: 100%;
            width: 100%;
            overflow: hidden;
            padding: 20px;
            z-index: 5;
            box-sizing: border-box;
            background-color: rgba(0, 0, 0, 0.75)
        }`, `.mediaview {
            display: flex;
            flex-direction: row;
            flex: 3;
        }`,`audio-display-scroll-pane{
            flex: 3;
        }`,`.videoView{
            flex: 0;
            min-width: 30%;
            object-fit: contain;
        }
        `]

})
export class MediaDisplayPlayer implements AudioPlayerListener, OnInit, AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked {
    private _mediaUrl: string;

    parentE: HTMLElement;

    @ViewChild('videoEl') videoElRef: ElementRef;
    protected videoEl: HTMLVideoElement;
    video: boolean = false;
    private videoEndTime: number = null;


    @Input()
    playStartAction: Action<void>;
    @Input()
    playStopAction: Action<void>;
    @Input()
    playSelectionAction: Action<void>
    @Input()
    autoPlayOnSelectToggleAction: Action<boolean>

    zoomFitToPanelAction: Action<void>;
    zoomSelectedAction: Action<void>
    zoomInAction: Action<void>;
    zoomOutAction: Action<void>;

    protected _videoPlayStartAction: Action<void> = new Action('Play');
    protected _videoPlaySelectionAction: Action<void> = new Action('Play selection');
    protected _videoPlayPauseAction: Action<void> = new Action('Pause');
    protected _videoPlayStopAction: Action<void> = new Action('Stop');


    aCtx: AudioContext;
    private _audioClip: AudioClip = null;
    ap: AudioPlayer;
    status: string;

    currentLoader: XMLHttpRequest | null;

    audio: any;
    updateTimerId: any;


    @ViewChild(AudioDisplayScrollPane, {static: true})
    private audioDisplayScrollPane: AudioDisplayScrollPane;

    constructor(protected route: ActivatedRoute, protected ref: ChangeDetectorRef, protected eRef: ElementRef) {
        this.parentE = this.eRef.nativeElement;
        this.status = "Player created.";
    }

    ngOnInit() {

        this.zoomSelectedAction = this.audioDisplayScrollPane.zoomSelectedAction
        this.zoomFitToPanelAction = this.audioDisplayScrollPane.zoomFitToPanelAction;
        this.zoomOutAction = this.audioDisplayScrollPane.zoomOutAction;
        this.zoomInAction = this.audioDisplayScrollPane.zoomInAction;
        try {
            this.aCtx = AudioContextProvider.audioContextInstance();
            this.ap = new AudioPlayer(this.aCtx, this);
            this.playStartAction = this.ap.startAction;
            this.playStopAction = this.ap.stopAction;
            this.playSelectionAction = this.ap.startSelectionAction;

        } catch (err) {
            this.status = err.message;
        }
    }

    ngAfterContentInit() {
        //console.log("AfterContentInit: "+this.ac);
    }

    ngAfterContentChecked() {
        //console.log("AfterContentChecked: "+this.ac);
    }

    ngAfterViewInit() {
        this.videoEl = this.videoElRef.nativeElement;
        if (this.aCtx && this.ap) {

        }
        this.layout();
        let heightListener = new MutationObserver((mrs: Array<MutationRecord>, mo: MutationObserver) => {
            mrs.forEach((mr: MutationRecord) => {
                if ('attributes' === mr.type && ('class' === mr.attributeName || 'style' === mr.attributeName)) {
                    this.layout();
                }
            })
        });
        heightListener.observe(this.parentE, {attributes: true, childList: true, characterData: true});
        this.route.queryParams.subscribe((params: Params) => {
            if (params['url']) {
                this.mediaUrl = params['url'];
            }
        });

        this._videoPlayStartAction.disabled = true;
        this._videoPlayStartAction.onAction = () => {
            this.videoEl.currentTime = 0;
            this.videoEl.play();
        }
        this._videoPlaySelectionAction.onAction = () => {
            let ac = this.audioClip;
            if (ac) {
                if (this.audioClip.buffer) {
                    let sr = this.audioClip.buffer.sampleRate;
                    let sel = this.audioClip.selection;
                    if (sel) {
                        let startTime = sel.leftFrame / sr;
                        this.videoEndTime = sel.rightFrame / sr;
                        this.videoEl.currentTime = startTime;
                        this.videoEl.play();
                    }
                }
            }
        }
        this.videoEl.oncanplay = () => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
        }
        this.videoEl.onplaying = () => {
            this._videoPlayStartAction.disabled = true;
            this._videoPlayPauseAction.disabled = false;
            this._videoPlayStopAction.disabled = false;
            this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
        }
        this.videoEl.onpause = () => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = false;
            window.clearInterval(this.updateTimerId);
        }
        this.videoEl.onended = () => {
            this._videoPlayStartAction.disabled = false;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            window.clearInterval(this.updateTimerId);
        }
        this.videoEl.onerror = () => {
            this._videoPlayStartAction.disabled = true;
            this._videoPlayPauseAction.disabled = true;
            this._videoPlayStopAction.disabled = true;
            window.clearInterval(this.updateTimerId);
        }
        this._videoPlayStopAction.disabled = true;
        this._videoPlayStopAction.onAction = () => {
            this.videoEl.pause();
            this.videoEl.currentTime = 0;
        }
    }


    ngAfterViewChecked() {
        //console.log("AfterViewChecked: "+this.ac);
    }

    layout() {
        this.audioDisplayScrollPane.layout();
    }

    get mediaUrl(): string {
        return this._mediaUrl;
    }

    set mediaUrl(value: string) {
        this.ap.stop();
        this._mediaUrl = value;
        this.load();
    }

    started() {
        this.status = 'Playing...';
    }

    private load() {

        if (this.currentLoader) {
            this.currentLoader.abort();
            this.currentLoader = null;
        }
        //this.statusMsg.innerHTML = 'Connecting...';
        this.currentLoader = new XMLHttpRequest();
        this.currentLoader.open("GET", this._mediaUrl, true);
        this.currentLoader.responseType = "arraybuffer";
        this.currentLoader.onload = (e) => {
            if (this.currentLoader) {

                var data = this.currentLoader.response; // not responseText
                //console.debug("Received data ", data.byteLength);

                // try to get MIME type
                let mt: MIMEType = null;
                let url = this.currentLoader.responseURL;
                let ct = this.currentLoader.getResponseHeader('Content-type');
                if (ct === null) {
                    // guess by extension
                    let dotIdx = url.lastIndexOf('.');
                    if (dotIdx >= 0) {
                        let extStr = url.substring(dotIdx);
                        mt = MIMEType.byExtension(extStr);
                    }
                } else {
                    mt = MIMEType.parse(ct);
                }
                this.currentLoader = null;
                this.loaded(data, mt);
            }
        }
        this.currentLoader.onerror = (e) => {
            console.error("Error downloading ...");
            //this.statusMsg.innerHTML = 'Error loading audio file!';
            this.currentLoader = null;
        }
        //this.statusMsg.innerHTML = 'Loading...';

        this.currentLoader.send();

    }

    private loaded(data: ArrayBuffer, mimeType?: MIMEType) {
        //console.debug("Loaded");
        this.status = 'Audio file loaded.';
        //console.debug("Received data ", data.byteLength);
        this.video = false;
        if (mimeType) {
            this.video = mimeType.isVideo();
        }

        if (this.video) {
            this.playStartAction = this._videoPlayStartAction;
            this.playSelectionAction = this._videoPlaySelectionAction;
            this.playStopAction = this._videoPlayStopAction;
        } else {
            this.playStartAction = this.ap.startAction;
            this.playSelectionAction = this.ap.startSelectionAction;
            this.playStopAction = this.ap.stopAction;
        }

        if (this.video) {
            let mBlob = new Blob([data], {type: mimeType.toHeaderString()});
            let mbUrl = URL.createObjectURL(mBlob);
            this.videoEl.src = mbUrl;
        }
        // Do not use Promise version, which does not work with Safari 13
        this.aCtx.decodeAudioData(data, (audioBuffer) => {
            //console.debug("Audio Buffer Samplerate: ", audioBuffer.sampleRate)
            this.audioClip = new AudioClip(audioBuffer)
            if (this.video) {
                this._audioClip.addSelectionObserver((ac) => {
                    this.playSelectionAction.disabled = false;
                });
            }
        });
    }

    @Input()
    set audioData(audioBuffer: AudioBuffer) {
        console.debug("Audio Buffer Samplerate: ", audioBuffer.sampleRate)
        this.audioDisplayScrollPane.audioData = audioBuffer;
        if (audioBuffer) {
            let clip = new AudioClip(audioBuffer);
            if (this.ap) {
                this.ap.audioClip = clip;
            }
        } else {
            if (this.ap) {
                this.ap.audioClip = null;
            }
        }
    }

    startSelectionDisabled() {
        return !(this._audioClip && this.ap != null && !this.playStartAction.disabled && this._audioClip.selection)
    }

    @Input()
    set audioClip(audioClip: AudioClip | null) {
        this._audioClip = audioClip
        let audioData: AudioBuffer = null;
        let sel: Selection = null;
        if (audioClip) {
            audioData = audioClip.buffer;
            sel = audioClip.selection;
        }
        if (audioData) {
            console.debug("Audio Buffer Samplerate: ", audioData.sampleRate)
            this.playStartAction.disabled = (!this.ap)
        }
        this.audioDisplayScrollPane.audioClip = audioClip
        this.ap.audioClip = audioClip
    }

    get audioClip(): AudioClip | null {
        return this._audioClip
    }

    updatePlayPosition() {
        if (this.video) {
            let mediaTime = this.videoEl.currentTime;
            if (this.videoEndTime) {
                if (this.videoEndTime <= mediaTime) {
                    this.videoEl.pause();
                }
            }
            this.audioDisplayScrollPane.playTimePosition = mediaTime;
        } else if (this.ap && this.ap.playPositionFrames) {
            this.audioDisplayScrollPane.playFramePosition = this.ap.playPositionFrames;
        }
    }

    audioPlayerUpdate(e: AudioPlayerEvent) {
        if (EventType.STARTED === e.type) {
            this.status = 'Playback...';
            this.updateTimerId = window.setInterval(e => this.updatePlayPosition(), 50);
        } else if (EventType.ENDED === e.type) {
            this.status = 'Ready.';
            window.clearInterval(this.updateTimerId);
        }
        this.ref.detectChanges();
    }

    error() {
        this.status = 'ERROR';
    }

}

