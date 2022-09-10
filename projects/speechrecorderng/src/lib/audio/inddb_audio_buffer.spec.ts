// Straight Jasmine testing without Angular's testing support
import {ArrayAudioBuffer} from "./array_audio_buffer";
import {IndexedDbAudioBuffer} from "./inddb_audio_buffer";

// describe("A suite is just a function", function() {
//   var a;
//
//   it("and so is a spec", function() {
//     a = true;
//
//     expect(a).toBe(true);
//   });
// });


describe('IndexedDbAudioBuffer', () => {
  let aab: IndexedDbAudioBuffer

  let CHUNK_COUNT=10000;
  let CHUNK_SIZE=8192;
  let NUMBER_OF_CHANNELS=2;
  let testRefData=new Array<Float32Array>(NUMBER_OF_CHANNELS);


  let testData=new Array<Array<Float32Array>>(NUMBER_OF_CHANNELS);


for(let ch=0;ch<NUMBER_OF_CHANNELS;ch++) {
  testRefData[ch] = new Float32Array(CHUNK_COUNT * CHUNK_SIZE);
  testData[ch]=new Array<Float32Array>();
  let testRefDataPos=0;
  for (let ci = 0; ci < CHUNK_COUNT; ci++) {
    let cc = new Float32Array(CHUNK_SIZE);
    for (let si = 0; si < CHUNK_SIZE; si++) {
      cc[si] = Math.random() * 2 - 1;
    }
    testData[ch].push(cc);
    testRefData[ch].set(cc, testRefDataPos);
    testRefDataPos += CHUNK_SIZE;
  }
  //aab = new IndexedDbAudioBufferAudioBuffer();
}
  beforeEach(() => {


  });

  it('#frames should return correct values', () => {
      let framesCorrect = true;
      for (let tt = 0; tt < 2; tt++) {
        for (let ti = 0; ti < 10; ti++) {
          let testPos: number;
          let testBufLength: number;
          if (tt == 0) {
            // Test type 0 small chunks
            testBufLength = Math.floor(Math.random() * 128);
            testPos = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE - 128));
          } else {
            // Test type 1 large test buffers
            testPos = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE));
            testBufLength = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE - testPos));

          }

          //let testBufLength=CHUNK_SIZE-12;
          //console.log("Test buffer length: " + testBufLength);
          let testBuf = new Array<Float32Array>(NUMBER_OF_CHANNELS);
          for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
            testBuf[ch] = new Float32Array(testBufLength);
          }

          aab.framesObs(testPos, testBufLength, testBuf).subscribe(
            {
              next: (read) => {
                for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
                  for (let i = 0; i < testBufLength; i++) {
                    if (testBuf[ch][i] !== testRefData[ch][testPos + i]) {
                      console.error("Frames at " + testPos + i + " differ: " + testBuf[ch][i] + "!==+" + testRefData[ch][testPos + i]);
                      framesCorrect = false;
                      break;
                    }
                  }
                }
                expect(framesCorrect).toBe(true);
              }
            }
          );
        }
      }

    }
      );

});
