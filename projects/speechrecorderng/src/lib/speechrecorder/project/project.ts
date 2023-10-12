import {SampleSize} from "../../audio/impl/wavwriter";

export interface AudioFormat {
  channels: number;
}

export interface MediaCaptureFormat {
  audioChannelCount: number;
}

export interface AudioDevice {
  name : string,
  playback : boolean,
  regex : boolean
}


export enum ConstraintType {Exact='EXACT',Ideal='IDEAL'};

export enum Platform {Linux='LINUX',macOS='MACOS',Windows='WINDOWS',Android='ANDROID'}
export enum BrowserBase {Chromium='CHROMIUM'};
export enum Browser {Firefox='FIREFOX',Chromium='CHROMIUM',Chrome='CHROME',Edge='EDGE',Opera='OPERA'}

export enum AudioStorageType {
  MEM_ENTIRE='MEM_ENTIRE',
  MEM_CHUNKED='MEM_CHUNKED',
  DB_CHUNKED='DB_CHUNKED',
  NET_CHUNKED='NET_CHUNKED',
  MEM_ENTIRE_AUTO_NET_CHUNKED='MEM_ENTIRE_AUTO_NET_CHUNKED',
  MEM_CHUNKED_AUTO_NET_CHUNKED='MEM_CHUNKED_AUTO_NET_CHUNKED'
}

export interface AudioStorageFormat {
  sampleSizeInBits?: SampleSize;
}

export class AudioConfigUtils{
  static audioConfigToConstrainBoolean(audioCfg:AudioConfig|null):ConstrainBoolean|undefined{
    if(audioCfg){
      if(audioCfg.constraintType){
          if(audioCfg.constraintType==='IDEAL'){
            return {ideal:audioCfg.value};
          }else if(audioCfg.constraintType==='EXACT'){
            return {exact:audioCfg.value};
          }else{
            throw Error("Unknown constraint type: "+audioCfg.constraintType);
          }
      }else{
        return audioCfg.value;
      }
    }else{
      return undefined;
    }
  }
}

export interface AudioConfig {
    value: boolean,
    constraintType? : ConstraintType|null,
    platform: Platform|null
}

export interface AutoGainControlConfig extends AudioConfig{}

export interface NoiseSuppressionConfig  extends AudioConfig{}

export interface EchoCancellationConfig  extends AudioConfig{}

export interface Project {

  name: string,
  recordingDeviceWakeLock?:boolean,
  audioFormat?: AudioFormat,
  mediaCaptureFormat?: MediaCaptureFormat,
  autoGainControlConfigs?:Array<AutoGainControlConfig>,
  noiseSuppressionConfigs?:Array<NoiseSuppressionConfig>,
  echoCancellationConfigs?:Array<EchoCancellationConfig>,
  audioDevices?: Array<AudioDevice>,
  audioCaptureDeviceId?:string,
  chunkedRecording?: boolean,
  clientAudioStorageType?:AudioStorageType,
  clientAudioStorageFormat?:AudioStorageFormat,
  showSessionCompleteMessage?:boolean;
}


export class ProjectUtil {

  public static readonly DEFAULT_AUDIO_CHANNEL_COUNT=2;

  static audioChannelCount(project:Project): number{
    let chs=ProjectUtil.DEFAULT_AUDIO_CHANNEL_COUNT;
    if(project.mediaCaptureFormat){
      chs=project.mediaCaptureFormat.audioChannelCount;
    }else if(project.audioFormat){
      chs=project.audioFormat.channels;
    }
    return chs;
  }

}



