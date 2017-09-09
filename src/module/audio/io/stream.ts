import {Float32OutStream} from "../../io/stream";

export interface AudioFloat32OutStream extends Float32OutStream{
    setFormat(channels: number,sampleRate:number);
}

export interface SequenceAudioFloat32OutStream extends AudioFloat32OutStream{
    nextStream();
}