
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

export interface InputPropertyConfiguration{
  id:number|string,
  propertyName: string,
  required:boolean,
  show:boolean
}

export interface FormConfiguration{
  id:number|string,
  owningProject?:string,
  defaultRequired:boolean,
  description?:string,
  displayName?:string,
  inputPropertyConfigurations:Array<InputPropertyConfiguration>
}

export interface Project {
  name: string,
  audioFormat?: AudioFormat,
  mediaCaptureFormat?: MediaCaptureFormat,
  audioDevices?: Array<AudioDevice>,
  speakerFormConfiguration:FormConfiguration
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



