import {BehaviorSubject} from "rxjs";
import {WAKE_LOCK_VIDEO_MP4_URI} from "./wake_lock_media";
import {Browser, UserAgent, UserAgentBuilder} from "./ua-parser";

/**
 * Utility to prevent devices from screen lock.
 * If supported uses the HTML5 wake lock API, if not, plays an invisible video.
 *
 * Note: I've used the GitHub project richtr/nosleep.js for that. The worked in most cases, but failed sometimes on an
 *   Android smartphone.
 */
export class WakeLockManager {
  get behaviorSubject(): BehaviorSubject<boolean> {
    return this._behaviorSubject;
  }

  // @ts-ignore
  private wakeLockSentinel:WakeLockSentinel;
  private mp4VideoElement?:HTMLVideoElement;
  private wakeLockApiSupported=false;
  private wakeLockRetryCount=0;
  private userAgent?:UserAgent;
  private randomSeekRequired=false;

  private _behaviorSubject:BehaviorSubject<boolean>=new BehaviorSubject<boolean>(false);

  private readonly VIDEO_LENGTH=10;

  constructor() {
    this.wakeLockApiSupported=('wakeLock' in navigator);
    console.debug("Wake lock API supported: "+this.wakeLockApiSupported);
    this.userAgent=UserAgentBuilder.userAgent();
    this.randomSeekRequired=(this.userAgent?.detectedBrowser===Browser.Safari);
  }

  enableWakeLock(){
      if(this.wakeLockApiSupported) {
          //@ts-ignore
          navigator.wakeLock.request('screen').then((wls)=>{
            this.wakeLockSentinel=wls;
            this.wakeLockRetryCount=0;
            console.debug('Wake lock screen request successful.');
            this._behaviorSubject.next(true);
          }).catch((reason:any)=>{
            console.error('Wakelock failed: '+reason)
            this._behaviorSubject.error(reason);

          });

      }else {
        if (!this.mp4VideoElement) {
          this.mp4VideoElement = document.createElement('video');

          this.mp4VideoElement.loop = !this.randomSeekRequired;
          this.mp4VideoElement.playsInline = true;

          this.mp4VideoElement.src=WAKE_LOCK_VIDEO_MP4_URI;

          this.mp4VideoElement.addEventListener('play', (ev) => {
            console.debug('Wake lock video playing...');
            this._behaviorSubject.next(true);
          })
          this.mp4VideoElement.addEventListener('ended', (ev) => {
            console.debug('Wake lock video ended.');
            this._behaviorSubject.next(false);
          })
          this.mp4VideoElement.addEventListener('pause', (ev) => {

            console.debug('Wake lock video pause.');
            this._behaviorSubject.next(false);
          })
          if(this.randomSeekRequired){
            this.mp4VideoElement.addEventListener('timeupdate', (ev) => {
              if(this.randomSeekRequired && this.mp4VideoElement) {
                let thirdVideoLen=this.VIDEO_LENGTH/3;
               if (this.mp4VideoElement.currentTime > thirdVideoLen*2) {
                    let newPos=(thirdVideoLen*Math.random());
                    //console.debug('Wake lock random seek to '+newPos+'s');
                    this.mp4VideoElement.currentTime=newPos;
                  }
              }
            });
          }
          this.mp4VideoElement.addEventListener('error', (ev) => {
            console.debug('Wake lock video error: '+ev.message);
            this._behaviorSubject.error(ev.error);
          })
          console.debug('Added listeners to wake lock video.');
        }
        this.startWakeLockVideo();
      }
    }

  private startWakeLockVideo(){
    if(this.mp4VideoElement){
      this.mp4VideoElement.play().then(()=>{
        this.wakeLockRetryCount=0;
      }).catch((err)=> {
        console.debug('Failed starting wake lock video!');
        if (this.wakeLockRetryCount < 1) {
          window.setTimeout(() => {
            this.wakeLockRetryCount++;
            console.debug('Retry wake lock video #' + this.wakeLockRetryCount);
            this.startWakeLockVideo();
          }, 4000)
        }else{
          console.debug('Giving up to try to start wake lock video.');
        }
      });
    }
  }


  disableWakeLock(){
    if(this.wakeLockApiSupported) {
        this.wakeLockSentinel.release().then(()=>{
          console.debug('Wake lock release successful.');
          this._behaviorSubject.next(false);
        }).catch((reason:any)=>{
          console.error('Wakelock release failed: '+reason)
          this._behaviorSubject.error(reason);
        });
    }else {
      if (this.mp4VideoElement) {
        this.mp4VideoElement.pause();
      }
    }
  }

}
