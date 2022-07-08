// Straight Jasmine testing without Angular's testing support
import {ArrayAudioBuffer} from "./array_audio_buffer";

// describe("A suite is just a function", function() {
//   var a;
//
//   it("and so is a spec", function() {
//     a = true;
//
//     expect(a).toBe(true);
//   });
// });


describe('ArrayAudioBuffer', () => {
  let aab: ArrayAudioBuffer;

  let CHUNK_COUNT=10000;
  let CHUNK_SIZE=8192
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

  it('#frames should return correct values', () => {
    let testBuf=new Array<Float32Array>(1);
    testBuf[0]=new Float32Array(53);
    let testPos=13;
    aab.frames(testPos,53,testBuf);
    let framesCorrect=true;
    for(let i=0;i<53;i++){
      if(testBuf[0][i]!==testRefData[testPos+i]){
        console.error("Frames at "+testPos+i+" differ: "+testBuf[0][i]+"!==+"+testRefData[testPos+i]);
        framesCorrect=false;
        break;
      }
    }

    expect(framesCorrect).toBe(true);
  });




});
