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
import {VideoPlayer} from "./video_player";

@Component({

    selector: 'mediadisplayplayer',

    template: `
        <div class="mediaview">
            <videoplayer [hidden]="!hasVideo() || hideVideo" [selection]="audioClip?.selection"></videoplayer>
            <audio-display-scroll-pane #audioDisplayScrollPane></audio-display-scroll-pane>
        </div>
        <audio-display-control [audioClip]="audioClip"
                               [playStartAction]="playStartAction"
                               [playSelectionAction]="playSelectionAction"
                               [playStopAction]="playStopAction"
                               [autoPlayOnSelectToggleAction]="autoPlayOnSelectToggleAction"
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
        }`,`videoplayer{
            flex: 0;
            min-width: 30%;
            object-fit: contain;
        }
        `]

})
export class MediaDisplayPlayer implements AudioPlayerListener, OnInit, AfterViewInit {
    private _mediaUrl: string|undefined;

    parentE: HTMLElement;

    @ViewChild(VideoPlayer) videoPlayer!: VideoPlayer;

    protected mimeType:MIMEType|null=null;

    @Input()
    playStartAction: Action<void>|undefined;
    @Input()
    playStopAction: Action<void>|undefined;
    @Input()
    playSelectionAction: Action<void>|undefined;
    @Input()
    autoPlayOnSelectToggleAction: Action<boolean>=new Action<boolean>('Autoplay on select');

    @Input()
    hideVideo:boolean=false;

    zoomFitToPanelAction!: Action<void>;
    zoomSelectedAction!: Action<void>;
    zoomInAction!: Action<void>;
    zoomOutAction!: Action<void>;

    aCtx: AudioContext|null=null;
    private _audioClip: AudioClip|null = null;
    ap: AudioPlayer|null=null;
    status: string;

    currentLoader: XMLHttpRequest | null=null;

    audio: any;
    updateTimerId: any;


    @ViewChild(AudioDisplayScrollPane, {static: true})
    private audioDisplayScrollPane!: AudioDisplayScrollPane;

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
            if (this.aCtx) {
                this.ap = new AudioPlayer(this.aCtx, this);
                this.playStartAction = this.ap.startAction;
                this.playStopAction = this.ap.stopAction;
                this.playSelectionAction = this.ap.startSelectionAction;
            }
        } catch (err) {
            this.status = err.message;
        }
    }

    ngAfterViewInit() {

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
    }

    layout() {
        this.audioDisplayScrollPane.layout();
    }

    get mediaUrl(): string|undefined {
        return this._mediaUrl;
    }

    set mediaUrl(value: string|undefined) {
        this.ap?.stop();
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
        if(this._mediaUrl) {
            this.currentLoader = new XMLHttpRequest();
            this.currentLoader.open("GET", this._mediaUrl, true);
            this.currentLoader.responseType = "arraybuffer";
            this.currentLoader.onload = (e) => {
                if (this.currentLoader) {

                    var data = this.currentLoader.response; // not responseText
                    //console.debug("Received data ", data.byteLength);

                    // try to get MIME type
                    let mt: MIMEType|null = null;
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
                    this.mimeType = mt;
                    this.configure();
                    this.currentLoader = null;
                    this.loaded(data);
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
    }

    hasVideo():boolean {
        return(this.mimeType!==null && this.mimeType.isVideo());
    }

    protected configure() {
        if (this.mimeType && this.mimeType.isVideo()) {
            this.playStartAction = this.videoPlayer.startAction;
            this.playSelectionAction = this.videoPlayer.startSelectionAction;
            this.playStopAction = this.videoPlayer.stopAction;
            this.autoPlayOnSelectToggleAction=this.videoPlayer.autoPlayOnSelectToggleAction;
            this.videoPlayer.onplaying=(ev:Event)=>{
                this.updateTimerId = window.setInterval(() => this.updatePlayPosition(), 50);
            }
            this.videoPlayer.onpause=(ev:Event)=>{
                window.clearInterval(this.updateTimerId);
            }
            this.videoPlayer.onended=(ev:Event)=>{
                window.clearInterval(this.updateTimerId);
            }
            this.videoPlayer.onerror=(ev:string|Event)=>{
                window.clearInterval(this.updateTimerId);
            }
        } else {
            if(this.ap) {
                this.playStartAction = this.ap.startAction;
                this.playSelectionAction = this.ap.startSelectionAction;
                this.playStopAction = this.ap.stopAction;
                this.autoPlayOnSelectToggleAction = this.ap.autoPlayOnSelectToggleAction;
            }
        }
    }

    private loaded(data: ArrayBuffer) {
        //console.debug("Loaded");
        this.status = 'Audio file loaded.';
        //console.debug("Received data ", data.byteLength);
        if (this.hasVideo()) {
           let blobType=this.mimeType?this.mimeType.toHeaderString():undefined;
            let mBlob = new Blob([data], {type: blobType});
            this.videoPlayer.mediaBlob=mBlob;
        }
        // Do not use Promise version, which does not work with Safari 13
        if(this.aCtx) {
            this.aCtx.decodeAudioData(data, (audioBuffer) => {
                //console.debug("Audio Buffer Samplerate: ", audioBuffer.sampleRate)
                this.audioClip = new AudioClip(audioBuffer)
            });
        }
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
        let playStartActionDisabled=false;
        if(this.playStartAction){
            playStartActionDisabled=this.playStartAction.disabled;
        }
        return !(this._audioClip && !playStartActionDisabled && this._audioClip.selection)
    }

    @Input()
    set audioClip(audioClip: AudioClip | null) {
        this._audioClip = audioClip
        let audioData: AudioBuffer|null = null;
        let sel: Selection|null = null;
        if (audioClip) {
            audioData = audioClip.buffer;
            sel = audioClip.selection;
        }
        if (audioData) {
            console.debug("Audio Buffer Samplerate: ", audioData.sampleRate)
            if(this.playStartAction) {
                this.playStartAction.disabled = (!this.ap);
            }
        }
        this.audioDisplayScrollPane.audioClip = audioClip
        if(this.ap) {
            this.ap.audioClip = audioClip
        }
    }

    get audioClip(): AudioClip | null {
        return this._audioClip
    }

    updatePlayPosition() {
        if (this.hasVideo()) {
            let mediaTime = this.videoPlayer.currentTime;
            if (this.videoPlayer.videoEndTime) {
                if (this.videoPlayer.videoEndTime <= mediaTime) {
                    this.videoPlayer.pause();
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
            this.updateTimerId = window.setInterval(() => this.updatePlayPosition(), 50);
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

