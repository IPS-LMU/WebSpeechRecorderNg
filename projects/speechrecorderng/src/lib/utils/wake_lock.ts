import {BehaviorSubject, Observable} from "rxjs";
import {WAKE_LOCK_VIDEO_MP4_URI} from "./wake_lock_media";


export class WakeLockManager {
  get behaviorSubject(): BehaviorSubject<boolean> {
    return this._behaviorSubject;
  }

  // @ts-ignore
  private wakeLockSentinel:WakeLockSentinel;
  private mp4VideoElement?:HTMLVideoElement;
  private wakeLockApiSupported=false;

  private _behaviorSubject:BehaviorSubject<boolean>=new BehaviorSubject<boolean>(false);

  constructor() {
    this.wakeLockApiSupported=('wakeLock' in navigator);
  }

  enableWakeLock(){
      if(this.wakeLockApiSupported) {
          //@ts-ignore
          navigator.wakeLock.request('screen').then((wls)=>{
            this.wakeLockSentinel=wls;
            this._behaviorSubject.next(true);
          }).catch((reason:any)=>{
            console.error('Wakelock failed: '+reason)
            this._behaviorSubject.error(reason);
          });

      }else {
        if (!this.mp4VideoElement) {
          this.mp4VideoElement = document.createElement('video');
          this.mp4VideoElement.loop = true;
          this.mp4VideoElement.playsInline = true;

          this.mp4VideoElement.src=WAKE_LOCK_VIDEO_MP4_URI;

          this.mp4VideoElement.addEventListener('play', (ev) => {
            console.debug("Wake lock video playing...")
            this._behaviorSubject.next(true);
          })
          this.mp4VideoElement.addEventListener('ended', (ev) => {
            console.debug("Wake lock video ended.")
            this._behaviorSubject.next(false);
          })
          this.mp4VideoElement.addEventListener('pause', (ev) => {

            console.debug("Wake lock video pause.")
            this._behaviorSubject.next(false);
          })
          this.mp4VideoElement.addEventListener('error', (ev) => {
            console.debug("Wake lock video error: "+ev.message)
            this._behaviorSubject.error(ev.error);

          })
          console.debug("Added listeners to wake lock video.")
        }
        this.mp4VideoElement.play();
      }
    }


  disableWakeLock(){
    if(this.wakeLockApiSupported) {
        this.wakeLockSentinel.release().then(()=>{
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
