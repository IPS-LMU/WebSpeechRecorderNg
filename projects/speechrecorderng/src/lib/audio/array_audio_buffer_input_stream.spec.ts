import {ArrayAudioBuffer} from "./array_audio_buffer";
import {ArrayAudioBufferInputStream} from "./array_audio_buffer_input_stream";
import {EditFloat32ArrayInputStream} from "../io/stream";

describe('ArrayAudioBufferInputStream', () => {
  let aab: ArrayAudioBuffer;

  let CHUNK_COUNT=10000;
  let CHUNK_SIZE=8192
  let TEST_BUF_FRAME_SIZE=53;
  let testRefData=new Float32Array(CHUNK_COUNT*CHUNK_SIZE);
  let testRefDataPos=0;
  let testData=new Array<Array<Float32Array>>();
  testData.push(new Array<Float32Array>());

  for(let ci=0;ci<CHUNK_COUNT;ci++){
    let cc=new Float32Array(CHUNK_SIZE);
    for(let si=0;si<CHUNK_SIZE;si++){
      cc[si]=Math.random()*2 -1;
    }
    testData[0].push(cc);
    testRefData.set(cc,testRefDataPos);
    testRefDataPos+=CHUNK_SIZE;
  }
  aab = new ArrayAudioBuffer(1,44100,testData);

  beforeEach(() => {  });

  it('#audio input stream should return correct values (small skip)', () => {
    let testBuf=new Array<Float32Array>(1);
    testBuf[0]=new Float32Array(TEST_BUF_FRAME_SIZE);
    let testPos=13;
    let aais=new ArrayAudioBufferInputStream(aab);
    aais.skipFrames(testPos);
    let r=aais.read(testBuf);
    expect(r).toBe(TEST_BUF_FRAME_SIZE);
    let framesCorrect=true;
    for(let i=0;i<TEST_BUF_FRAME_SIZE;i++){
      if(testBuf[0][i]!==testRefData[testPos+i]){
        console.error("Frames at "+testPos+i+" differ: "+testBuf[0][i]+"!==+"+testRefData[testPos+i]);
        framesCorrect=false;
        break;
      }
    }

    expect(framesCorrect).toBe(true);
  });

  it('#audio input stream should return correct values (large skip)', () => {
    let testBuf=new Array<Float32Array>(1);
    testBuf[0]=new Float32Array(TEST_BUF_FRAME_SIZE);
    let testPos=34567;
    let aais=new ArrayAudioBufferInputStream(aab);
    aais.skipFrames(testPos);
    let r=aais.read(testBuf);
    expect(r).toBe(TEST_BUF_FRAME_SIZE);
    let framesCorrect=true;
    for(let i=0;i<TEST_BUF_FRAME_SIZE;i++){
      if(testBuf[0][i]!==testRefData[testPos+i]){
        console.error("Frames at "+testPos+i+" differ: "+testBuf[0][i]+"!==+"+testRefData[testPos+i]);
        framesCorrect=false;
        break;
      }
    }

    expect(framesCorrect).toBe(true);
  });

  it('#edit audio input stream should return correct values', () => {
    let testBuf=new Array<Float32Array>(1);
    testBuf[0]=new Float32Array(TEST_BUF_FRAME_SIZE);
    let testPos=34567;
    let aais=new ArrayAudioBufferInputStream(aab);
    let eaais=new EditFloat32ArrayInputStream(aais,testPos,TEST_BUF_FRAME_SIZE);

    let r=eaais.read(testBuf);
    expect(r).toBe(TEST_BUF_FRAME_SIZE);
    let framesCorrect=true;
    for(let i=0;i<TEST_BUF_FRAME_SIZE;i++){
      if(testBuf[0][i]!==testRefData[testPos+i]){
        console.error("Frames at "+testPos+i+" differ: "+testBuf[0][i]+"!==+"+testRefData[testPos+i]);
        framesCorrect=false;
        break;
      }
    }

    expect(framesCorrect).toBe(true);
  });



});
