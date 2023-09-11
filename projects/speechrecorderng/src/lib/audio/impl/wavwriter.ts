import { WavFileFormat } from './wavformat'
import { BinaryByteWriter } from '../../io/BinaryWriter'
import {WorkerHelper} from "../../utils/utils";
declare function postMessage (message:any, transfer:Array<any>):void;


export enum SampleSize {INT16=16,INT32=32}
   export class WavWriter {

     static readonly DEFAULT_SAMPLE_SIZE:SampleSize = SampleSize.INT16;
     private readonly sampleSizeInBytes:number=WavWriter.DEFAULT_SAMPLE_SIZE.valueOf()/8;
     private sampleSize=WavWriter.DEFAULT_SAMPLE_SIZE;
     private sampleSizeInBits=this.sampleSize.valueOf();
     private bw:BinaryByteWriter;
     private workerURL: string|null=null;
     constructor(sampleSize?:SampleSize) {
       if(sampleSize){
         this.sampleSize=sampleSize;
       }
       this.sampleSizeInBits=this.sampleSize.valueOf();
       this.sampleSizeInBytes=Math.round(this.sampleSizeInBits/8);

       this.bw = new BinaryByteWriter();
     }

     /*
      *  Method used as worker code.
      */
     workerFunction() {
       self.onmessage = function (msg:MessageEvent) {

         const valView = new DataView(msg.data.buf,msg.data.bufPos);
         const sampleSizeInbytes=Math.round(msg.data.sampleSizeInBits/8);
         let bufPos = 0;
         let hDynIntRange = 1 << (msg.data.sampleSizeInBits - 1);
         for (let s = 0; s < msg.data.frameLength; s++) {
           // interleaved channel data

           for (let ch = 0; ch < msg.data.chs; ch++) {
             let srcPos=(ch*msg.data.frameLength)+s;
             let valFlt = msg.data.audioData[srcPos];
             let valInt = Math.round(valFlt * hDynIntRange);
             if(msg.data.sampleSizeInBits===32) {
               valView.setInt32(bufPos,valInt,true);
             }else {
               valView.setInt16(bufPos,valInt,true);
             }
             bufPos+=sampleSizeInbytes;
           }
         }
         postMessage({buf:msg.data.buf}, [msg.data.buf]);
         //self.close()
       }
     }


     writeFmtChunk(audioBuffer:AudioBuffer){

       this.bw.writeUint16(WavFileFormat.PCM,true);
       const frameSize=this.sampleSizeInBytes*audioBuffer.numberOfChannels;
       this.bw.writeUint16(audioBuffer.numberOfChannels,true);
       this.bw.writeUint32(audioBuffer.sampleRate,true);
         // dwAvgBytesPerSec
       this.bw.writeUint32(frameSize*audioBuffer.sampleRate,true);
       this.bw.writeUint16(frameSize,true);
       // sample size in bits (PCM format only)
       this.bw.writeUint16(this.sampleSizeInBits,true);
     }

     writeDataChunk(audioBuffer:AudioBuffer){

       let chData0=audioBuffer.getChannelData(0);
       let dataLen=chData0.length;
        let hDynIntRange=1 << ((this.sampleSizeInBits)-1);
       for(let s=0;s<dataLen;s++) {
         // interleaved channel data
         for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
           let chData = audioBuffer.getChannelData(ch);
           let valFlt=chData[s];
           let valInt=Math.round(valFlt*hDynIntRange);
           if(this.sampleSize===SampleSize.INT16) {
             this.bw.writeInt16(valInt, true);
           }else if(this.sampleSize===SampleSize.INT32){
             this.bw.writeInt32(valInt,true);
           }
         }
       }

     }

     writeChunkHeader(name:string,chkLen:number){
       this.bw.writeAscii(name);
       this.bw.writeUint32(chkLen,true);
     }

     writeAsync(audioBuffer:AudioBuffer,callback: (wavFileData:Uint8Array)=> any){

       const dataChkByteLen=this.writeHeader(audioBuffer);
       if (!this.workerURL) {
         this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
        }
       const wo = new Worker(this.workerURL);

       const chs = audioBuffer.numberOfChannels;

       const frameLength = audioBuffer.getChannelData(0).length;
       const ad = new Float32Array(chs * frameLength);
       for (let ch = 0; ch < chs; ch++) {
         ad.set(audioBuffer.getChannelData(ch), ch * frameLength);
       }
         // ensureCapacity blocks !!!
       this.bw.ensureCapacity(dataChkByteLen);
       wo.onmessage = (me) => {
         callback(me.data.buf);
         wo.terminate();
       }


       wo.postMessage({sampleSizeInBits:this.sampleSizeInBits, chs: chs, frameLength: frameLength, audioData: ad,buf:this.bw.buf,bufPos:this.bw.pos}, [ad.buffer,this.bw.buf]);

     }

     write(audioBuffer:AudioBuffer):Uint8Array{
       this.writeHeader(audioBuffer);
       this.writeDataChunk(audioBuffer);
       return this.bw.finish();
     }


      writeHeader(audioBuffer:AudioBuffer):number{
        this.bw.writeAscii(WavFileFormat.RIFF_KEY);
        let dataChkByteLen=0;
        //const dataChkByteLen=audioBuffer.getChannelData(0).length*WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*audioBuffer.numberOfChannels;
        const abChs=audioBuffer.numberOfChannels;
        if(abChs>0){
          const abCh0=audioBuffer.getChannelData(0);
          dataChkByteLen=abCh0.length*this.sampleSizeInBytes*abChs;
        }
        const wavChunkByteLen=(4+4)*3+16+dataChkByteLen;
        this.bw.writeUint32(wavChunkByteLen,true); // must be set to file length-8 later
        this.bw.writeAscii(WavFileFormat.WAV_KEY);
        this.writeChunkHeader('fmt ',16);
        this.writeFmtChunk(audioBuffer);
        this.writeChunkHeader('data',dataChkByteLen);
        return dataChkByteLen;
      }

   }



