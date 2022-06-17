import { WavFileFormat } from './wavformat'
import { PCMAudioFormat } from '../format'
import { BinaryByteWriter } from '../../io/BinaryWriter'
import {WorkerHelper} from "../../utils/utils";
declare function postMessage (message:any, transfer:Array<any>):void;


   export class WavWriter {

     static PCM:number = 1;
     static DEFAULT_SAMPLE_SIZE_BITS:number = 16;
     sampleSize=WavWriter.DEFAULT_SAMPLE_SIZE_BITS;
     private bw:BinaryByteWriter;
     private format:PCMAudioFormat|null=null;
     private dataLength:number|null=null;
     private workerURL: string|null=null;

     constructor() {
       this.bw = new BinaryByteWriter();
     }

     /*
      *  Method used as worker code.
      */
     workerFunction() {
       self.onmessage = function (msg:MessageEvent) {

         let bufLen=msg.data.frameLength * msg.data.chs;
         let valView = new DataView(msg.data.buf,msg.data.bufPos);
          let sampleSize=msg.data.sampleSizeInBits;
          let sampleSizeBytes=Math.round(sampleSize/8);
         let bufPos = 0;
         let hDynIntRange = 1 << (sampleSize - 1);
         for (let s = 0; s < msg.data.frameLength; s++) {
           // interleaved channel data

           for (let ch = 0; ch < msg.data.chs; ch++) {
             let srcPos=(ch*msg.data.frameLength)+s;
             let valFlt = msg.data.audioData[srcPos];
             let valInt = Math.round(valFlt * hDynIntRange);
             if(sampleSize===16) {
               valView.setInt16(bufPos, valInt, true);
             }else if(sampleSize===32){
               valView.setInt32(bufPos, valInt, true);
             }else{
               throw new Error('Sample size '+sampleSize+' not supported');
             }
             bufPos+=sampleSizeBytes;
           }
         }
         postMessage({buf:msg.data.buf}, [msg.data.buf]);
         //self.close()
       }
     }


     writeFmtChunk(audioBuffer:AudioBuffer){

       this.bw.writeUint16(WavFileFormat.PCM,true);
       let frameSize=this.sampleSize*audioBuffer.numberOfChannels/8; // fixed 16-bit for now
       this.bw.writeUint16(audioBuffer.numberOfChannels,true);
       this.bw.writeUint32(audioBuffer.sampleRate,true);
         // dwAvgBytesPerSec
       this.bw.writeUint32(frameSize*audioBuffer.sampleRate,true);
       this.bw.writeUint16(frameSize,true);
       // sample size in bits (PCM format only)
       this.bw.writeUint16(this.sampleSize,true);
     }

     writeDataChunk(audioBuffer:AudioBuffer){

       let chData0=audioBuffer.getChannelData(0);
       let dataLen=chData0.length;
        let hDynIntRange=1 << ((this.sampleSize)-1);
       for(let s=0;s<dataLen;s++) {
         // interleaved channel data
         for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
           let chData = audioBuffer.getChannelData(ch);
           let valFlt=chData[s];
           let valInt=Math.round(valFlt*hDynIntRange);
           if(this.sampleSize===16) {
             this.bw.writeInt16(valInt, true);
           }else if(this.sampleSize===32){
             this.bw.writeInt32(valInt,true);
           }else{
             throw new Error('Sample size '+this.sampleSize+' not supported');
           }
         }
       }

     }

     writeChunkHeader(name:string,chkLen:number){
       this.bw.writeAscii(name);
       this.bw.writeUint32(chkLen,true);
     }

     private checkSampleSize():string|null{
       let errMsg=null;
       if(!(this.sampleSize===16 || this.sampleSize===32)){
         errMsg='Sample size of '+this.sampleSize+' not supported. Supported are 16 and 24 bits.'
       }
       return errMsg;
     }

     writeAsync(audioBuffer:AudioBuffer,callback: (wavFileData:Uint8Array)=> any){
       let errMsg=this.checkSampleSize();
       if(errMsg){
         throw new Error(errMsg);
       }
       let dataChkByteLen=this.writeHeader(audioBuffer);
       if (!this.workerURL) {
         this.workerURL = WorkerHelper.buildWorkerBlobURL(this.workerFunction)
        }
       let wo = new Worker(this.workerURL);

       let chs = audioBuffer.numberOfChannels;

       let frameLength = audioBuffer.getChannelData(0).length;
       let ad = new Float32Array(chs * frameLength);
       for (let ch = 0; ch < chs; ch++) {
         ad.set(audioBuffer.getChannelData(ch), ch * frameLength);
       }
         // ensureCapacity blocks !!!
       this.bw.ensureCapacity(dataChkByteLen);
       wo.onmessage = (me) => {
         callback(me.data.buf);
         wo.terminate();
       }

       wo.postMessage({sampleSizeInBits:this.sampleSize, chs: chs, frameLength: frameLength, audioData: ad,buf:this.bw.buf,bufPos:this.bw.pos}, [ad.buffer,this.bw.buf]);

     }

     write(audioBuffer:AudioBuffer):Uint8Array{
       let errMsg=this.checkSampleSize();
       if(errMsg){
         throw new Error(errMsg);
       }
       this.writeHeader(audioBuffer);
       this.writeDataChunk(audioBuffer);
       return this.bw.finish();
     }


      writeHeader(audioBuffer:AudioBuffer):number{

        this.bw.writeAscii(WavFileFormat.RIFF_KEY);
        let dataChkByteLen=audioBuffer.getChannelData(0).length*this.sampleSize*audioBuffer.numberOfChannels/8;
        let wavChunkByteLen=(4+4)*3+16+dataChkByteLen;
        let wavFileDataByteLen=wavChunkByteLen+8;

        this.bw.writeUint32(wavChunkByteLen,true); // must be set to file length-8 later
        this.bw.writeAscii(WavFileFormat.WAV_KEY);
        this.writeChunkHeader('fmt ',16);
        this.writeFmtChunk(audioBuffer);
        this.writeChunkHeader('data',dataChkByteLen);
        return dataChkByteLen;
      }

   }



