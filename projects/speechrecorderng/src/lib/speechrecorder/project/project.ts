
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
  mimeTypes?: Array<string>,
  audioFormat?: AudioFormat,
  audioDevices?: Array<AudioDevice>
}




