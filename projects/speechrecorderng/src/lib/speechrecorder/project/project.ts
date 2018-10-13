
export interface AudioFormat {
  channels: number;
}

export interface AudioDevice {
  name : string,
  playback : boolean,
  regex : boolean
}

export interface Project {
  name: string,
  audioFormat?: AudioFormat,
  audioDevices?: Array<AudioDevice>
}




