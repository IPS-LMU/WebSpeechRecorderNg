import { WavFileFormat } from './wavformat'
import { BinaryByteWriter } from '../../io/BinaryWriter'
import {WorkerHelper} from "../../utils/utils";
declare function postMessage (message:any, transfer:Array<any>):void;


   export class WavWriter {

     static readonly DEFAULT_SAMPLE_SIZE_BYTES:number = 2;
     private bw:BinaryByteWriter;
     private workerURL: string|null=null;
     constructor() {
       this.bw = new BinaryByteWriter();
     }

     /*
      *  Method used as worker code.
      */
     workerFunction() {
       self.onmessage = function (msg:MessageEvent) {

         const valView = new DataView(msg.data.buf,msg.data.bufPos);

         let bufPos = 0;
         let hDynIntRange = 1 << (msg.data.sampleSizeInBits - 1);
         for (let s = 0; s < msg.data.frameLength; s++) {
           // interleaved channel data

           for (let ch = 0; ch < msg.data.chs; ch++) {
             let srcPos=(ch*msg.data.frameLength)+s;
             let valFlt = msg.data.audioData[srcPos];
             let valInt = Math.round(valFlt * hDynIntRange);
             valView.setInt16(bufPos, valInt, true);
             bufPos+=2;
           }
         }
         postMessage({buf:msg.data.buf}, [msg.data.buf]);
         //self.close()
       }
     }


     writeFmtChunk(audioBuffer:AudioBuffer){

       this.bw.writeUint16(WavFileFormat.PCM,true);
       let frameSize=WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*audioBuffer.numberOfChannels; // fixed 16-bit for now
       this.bw.writeUint16(audioBuffer.numberOfChannels,true);
       this.bw.writeUint32(audioBuffer.sampleRate,true);
         // dwAvgBytesPerSec
       this.bw.writeUint32(frameSize*audioBuffer.sampleRate,true);
       this.bw.writeUint16(frameSize,true);
       // sample size in bits (PCM format only)
       this.bw.writeUint16(WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*8,true);
     }

     writeDataChunk(audioBuffer:AudioBuffer){

       let chData0=audioBuffer.getChannelData(0);
       let dataLen=chData0.length;
        let hDynIntRange=1 << ((WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*8)-1);
       for(let s=0;s<dataLen;s++) {
         // interleaved channel data
         for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
           let chData = audioBuffer.getChannelData(ch);
           let valFlt=chData[s];
           let valInt=Math.round(valFlt*hDynIntRange);
           this.bw.writeInt16(valInt,true);
         }
       }

     }

     writeChunkHeader(name:string,chkLen:number){
       this.bw.writeAscii(name);
       this.bw.writeUint32(chkLen,true);
     }

     writeUrlAsync(audioBuffer:AudioBuffer,callback: (wavFileUrl:string)=> any){
       this.writeBlobAsync(audioBuffer,(wavFileBlob)=> {
         let url=URL.createObjectURL(wavFileBlob);
         callback(url);
       });
     }

     writeBlobAsync(audioBuffer:AudioBuffer,callback: (wavFileBlob:Blob)=> any){
       this.writeAsync(audioBuffer,(wavFileData)=> {
         let wavBlob = new Blob([wavFileData], {type: 'audio/wav'});
         callback(wavBlob);
       });
     }

     writeAsync(audioBuffer:AudioBuffer,callback: (wavFileData:Uint8Array)=> any){

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
       //TODO Fixed sample size of 16 bits
       wo.postMessage({sampleSizeInBits:16, chs: chs, frameLength: frameLength, audioData: ad,buf:this.bw.buf,bufPos:this.bw.pos}, [ad.buffer,this.bw.buf]);

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
          dataChkByteLen=abCh0.length*WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*abChs;
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



