import {BehaviorSubject} from "rxjs";
import {WAKE_LOCK_VIDEO_MP4_URI} from "./wake_lock_media";
import {Browser, UserAgent, UserAgentBuilder} from "./ua-parser";
import {SprLogger} from "./logger";

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

  private wakeLockSentinel:WakeLockSentinel|null = null;
  /** A request is in flight; the API rejects when the document is hidden or the lock is denied. */
  private wakeLockRequestPending=false;
  /** Whether a caller currently wants the lock, so a late grant can be released again. */
  private wakeLockWanted=false;
  private mp4VideoElement?:HTMLVideoElement;
  private wakeLockApiSupported=false;
  private wakeLockRetryCount=0;
  private userAgent?:UserAgent;
  private randomSeekRequired=false;

  private _behaviorSubject:BehaviorSubject<boolean>=new BehaviorSubject<boolean>(false);

  private readonly VIDEO_LENGTH=10;

  constructor() {
    this.wakeLockApiSupported=('wakeLock' in navigator);
    SprLogger.debug("Wake lock API supported: "+this.wakeLockApiSupported);
    this.userAgent=UserAgentBuilder.userAgent();
    this.randomSeekRequired=(this.userAgent?.detectedBrowser===Browser.Safari);
  }

  /**
   * Asks the browser for the screen wake lock.
   *
   * A rejected request (permission policy, hidden document, low power) is a normal answer, not an
   * error of the stream: the indicator goes off and the next take asks again. The state subject is
   * therefore never completed — `error` would terminate it and the indicator could never turn on
   * again in that session (the video fallback below keeps its own error handling).
   *
   * One lock per manager: a take that starts while the previous lock is still held (for example
   * before the upload of the last one finished) must not request a second sentinel, or the first
   * one would be left released by nobody.
   */
  enableWakeLock(){
      if(this.wakeLockApiSupported) {
          this.wakeLockWanted=true;
          if (this.wakeLockSentinel !== null || this.wakeLockRequestPending) {
            return;
          }
          this.wakeLockRequestPending=true;
          navigator.wakeLock.request('screen').then((wls)=>{
            this.wakeLockRequestPending=false;
            if (!this.wakeLockWanted) {
              // The take was stopped while the browser was deciding: do not hold a lock nobody wants.
              this.releaseSentinel(wls);
              return;
            }
            this.wakeLockSentinel=wls;
            // The browser revokes the lock itself when the document becomes hidden; the indicator
            // must not keep claiming that the screen is locked.
            wls.addEventListener('release', () => {
              if (this.wakeLockSentinel === wls) {
                this.wakeLockSentinel=null;
                this._behaviorSubject.next(false);
              }
            });
            this.wakeLockRetryCount=0;
            SprLogger.debug('Wake lock screen request successful.');
            this._behaviorSubject.next(true);
          }).catch((reason:any)=>{
            this.wakeLockRequestPending=false;
            SprLogger.warn('Wake lock screen request failed: '+reason)
            this._behaviorSubject.next(false);

          });

      }else {
        if (!this.mp4VideoElement) {
          this.mp4VideoElement = document.createElement('video');

          this.mp4VideoElement.loop = !this.randomSeekRequired;
          this.mp4VideoElement.playsInline = true;

          this.mp4VideoElement.src=WAKE_LOCK_VIDEO_MP4_URI;

          this.mp4VideoElement.addEventListener('play', (ev) => {
            SprLogger.debug('Wake lock video playing...');
            this._behaviorSubject.next(true);
          })
          this.mp4VideoElement.addEventListener('ended', (ev) => {
            SprLogger.debug('Wake lock video ended.');
            this._behaviorSubject.next(false);
          })
          this.mp4VideoElement.addEventListener('pause', (ev) => {

            SprLogger.debug('Wake lock video pause.');
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
            SprLogger.debug('Wake lock video error: '+ev.message);
            this._behaviorSubject.error(ev.error);
          })
          SprLogger.debug('Added listeners to wake lock video.');
        }
        this.startWakeLockVideo();
      }
    }

  private startWakeLockVideo(){
    if(this.mp4VideoElement){
      this.mp4VideoElement.play().then(()=>{
        this.wakeLockRetryCount=0;
      }).catch((err)=> {
        SprLogger.debug('Failed starting wake lock video!');
        if (this.wakeLockRetryCount < 1) {
          window.setTimeout(() => {
            this.wakeLockRetryCount++;
            SprLogger.debug('Retry wake lock video #' + this.wakeLockRetryCount);
            this.startWakeLockVideo();
          }, 4000)
        }else{
          SprLogger.debug('Giving up to try to start wake lock video.');
        }
      });
    }
  }


  /**
   * Releases the lock, if one is held. Called between takes and on destroy, so it must also be
   * safe when the browser never granted the lock (the denied case) — the sentinel is `null` then
   * and there is nothing to release.
   */
  disableWakeLock(){
    if(this.wakeLockApiSupported) {
        this.wakeLockWanted=false;
        const sentinel=this.wakeLockSentinel;
        this.wakeLockSentinel=null;
        if (sentinel === null) {
          // Never granted, already revoked by the browser, or a request that is still in flight
          // (that one releases itself when it arrives).
          this._behaviorSubject.next(false);
          return;
        }
        sentinel.release().then(()=>{
          SprLogger.debug('Wake lock release successful.');
          this._behaviorSubject.next(false);
        }).catch((reason:any)=>{
          SprLogger.warn('Wake lock release failed: '+reason)
          this._behaviorSubject.next(false);
        });
    }else {
      if (this.mp4VideoElement) {
        this.mp4VideoElement.pause();
      }
    }
  }

  private releaseSentinel(sentinel:WakeLockSentinel){
    sentinel.release().catch((reason:any)=>{
      SprLogger.warn('Wake lock release failed: '+reason);
    });
  }

}
