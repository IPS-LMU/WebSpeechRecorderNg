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
  float?:boolean;
  sampleSizeInBits?: SampleSize;
}

export interface AutoGainControlConfig {
  value: boolean,
  //constraintType : ConstraintType,
  platform: Platform,
  //browserBase:BrowserBase,
  //browser:Browser
}

export interface Project {
  name: string,
  recordingDeviceWakeLock?:boolean,
  audioFormat?: AudioFormat,
  mediaCaptureFormat?: MediaCaptureFormat,
  autoGainControlConfigs?:Array<AutoGainControlConfig>,
  allowEchoCancellation?:boolean,
  audioDevices?: Array<AudioDevice>,
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



