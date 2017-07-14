import { WavFileFormat } from './wavformat'
import { PCMAudioFormat } from '../format'
import { BinaryByteWriter } from '../../io/BinaryWriter'
declare function postMessage (message:any, transfer:Array<any>):void;


   export class WavWriter {

     static PCM:number = 1;
     static DEFAULT_SAMPLE_SIZE_BYTES:number = 2;
     private bw:BinaryByteWriter;
     private format:PCMAudioFormat;
     private dataLength:number;

     private woStr:string;

     constructor() {
       this.bw = new BinaryByteWriter();
     }


     workerFunction() {
       self.onmessage = function (msg) {
         console.log("Worker got message..");

         var bufLen=msg.data.frameLength * msg.data.chs;
         //var buf=new ArrayBuffer(bufLen);
         var valView = new DataView(msg.data.buf,msg.data.bufPos);

         var bufPos = 0;
         var hDynIntRange = 1 << (msg.data.sampleSizeInBits - 1);
         for (var s = 0; s < msg.data.frameLength; s++) {
           // interleaved channel data

           for (var ch = 0; ch < msg.data.chs; ch++) {
             var srcPos=(ch*msg.data.frameLength)+s;
             var valFlt = msg.data.audioData[srcPos];
             var valInt = Math.round(valFlt * hDynIntRange);
             valView.setInt16(bufPos, valInt, true);
             bufPos+=2;
           }
         }
           console.log("Work done, worker post message back...");
         postMessage({buf:msg.data.buf}, [msg.data.buf]);
       }

     }


     writeFmtChunk(audioBuffer:AudioBuffer){

       this.bw.writeUint16(WavFileFormat.PCM,true);
       var frameSize=WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*audioBuffer.numberOfChannels; // fixed 16-bit for now
       this.bw.writeUint16(audioBuffer.numberOfChannels,true);
       this.bw.writeUint32(audioBuffer.sampleRate,true);
         // dwAvgBytesPerSec
       this.bw.writeUint32(frameSize*audioBuffer.sampleRate,true);
       this.bw.writeUint16(frameSize,true);
       // sample size in bits (PCM format only)
       this.bw.writeUint16(WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*8,true);
     }

     writeDataChunk(audioBuffer:AudioBuffer){

       var chData0=audioBuffer.getChannelData(0);
       var dataLen=chData0.length;
        var hDynIntRange=1 << ((WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*8)-1);
       for(var s=0;s<dataLen;s++) {
         // interleaved channel data
         for (var ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
           var chData = audioBuffer.getChannelData(ch);
           var valFlt=chData[s];
           var valInt=Math.round(valFlt*hDynIntRange);
           this.bw.writeInt16(valInt,true);
         }
       }

     }

     writeChunkHeader(name:string,chkLen:number){
       this.bw.writeAscii(name);
       this.bw.writeUint32(chkLen,true);
     }

     writeAsync(audioBuffer:AudioBuffer,callback: (wavFileData:Uint8Array)=> any){

       let dataChkByteLen=this.writeHeader(audioBuffer);
        if(!this.woStr) {

          let wb = new Blob(['(' + this.workerFunction.toString() + ')();'], {type: 'text/javascript'});
          this.woStr = window.URL.createObjectURL(wb);
        }
         let wo = new Worker(this.woStr);

       let chs = audioBuffer.numberOfChannels;

       let frameLength = audioBuffer.getChannelData(0).length;
       let ad = new Float32Array(chs * frameLength);
       for (var ch = 0; ch < chs; ch++) {
         ad.set(audioBuffer.getChannelData(ch), ch * frameLength);
       }
         // ensureCapacity blocks !!!
       this.bw.ensureCapacity(dataChkByteLen);
       wo.onmessage = (me) => {
         callback(me.data.buf);
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
        var dataChkByteLen=audioBuffer.getChannelData(0).length*WavWriter.DEFAULT_SAMPLE_SIZE_BYTES*audioBuffer.numberOfChannels;
        var wavChunkByteLen=(4+4)*3+16+dataChkByteLen;
        var wavFileDataByteLen=wavChunkByteLen+8;

        this.bw.writeUint32(wavChunkByteLen,true); // must be set to file length-8 later
        this.bw.writeAscii(WavFileFormat.WAV_KEY);
        this.writeChunkHeader('fmt ',16);
        this.writeFmtChunk(audioBuffer);
        this.writeChunkHeader('data',dataChkByteLen);
        return dataChkByteLen;
      }

   }



