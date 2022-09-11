// Straight Jasmine testing without Angular's testing support
import {ArrayAudioBuffer} from "./array_audio_buffer";
import {IndexedDbAudioBuffer} from "./inddb_audio_buffer";
import {UUID} from "../utils/utils";

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
  jasmine.DEFAULT_TIMEOUT_INTERVAL=60000;
      let CHUNK_COUNT = 1;
      let CHUNK_SIZE = 2;
      let NUMBER_OF_CHANNELS = 2;
      let SAMPLE_RATE=44100;
      let testRefData = new Array<Float32Array>(NUMBER_OF_CHANNELS);
      let testData = new Array<Array<Float32Array>>(NUMBER_OF_CHANNELS);

      for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
        testRefData[ch] = new Float32Array(CHUNK_COUNT * CHUNK_SIZE);
        testData[ch] = new Array<Float32Array>();
        let testRefDataPos = 0;
        for (let ci = 0; ci < CHUNK_COUNT; ci++) {
          let cc = new Float32Array(CHUNK_SIZE);
          for (let si = 0; si < CHUNK_SIZE; si++) {
            cc[si] = Math.random() * 2 - 1;
          }
          testData[ch].push(cc);
          testRefData[ch].set(cc, testRefDataPos);
          testRefDataPos += CHUNK_SIZE;
        }
      }


      beforeEach(() => {

      });

      it('#frames should return correct values', (done) => {
        let DB_NAME = 'inddb_audio_buffer_spec_test_db';
        let RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME = 'rec_file_chunks';

        let aab: IndexedDbAudioBuffer;
        let or: IDBOpenDBRequest;
        or = indexedDB.open(DB_NAME, 1);
        or.onerror = (err) => {
          console.error("Could not open indexed database: " + DB_NAME + ": " + err);
        };
        or.onupgradeneeded = (ev) => {
          let db = or.result
          let tr = or.transaction

          if (!db.objectStoreNames.contains(RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME)) {
            let rfStore = db.createObjectStore(RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME);
          }
          if (ev.oldVersion) {
            console.info("Upgraded indexed database " + DB_NAME + " schema from version " + ev.oldVersion + " to " + ev.newVersion)
          } else {
            console.info("Created indexed database " + DB_NAME + " schema version " + ev.newVersion)
          }
        };
        or.onsuccess = () => {
          console.info("Opened indexed database");
          //for (let tt = 0; tt < 2; tt++) {
          //for (let ti = 0; ti < 10; ti++) {
          let tt = 0;
          let ti = 0;
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
          let db = or.result;
          let tr = db.transaction(RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME, 'readwrite');
          let recFileObjStore = tr.objectStore(RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME);
          let uuid = UUID.generate();
          let indDbChkIdx = 0;
          try {
            let ch0Data = testData[0];
            let dataChkCnt = ch0Data.length;
            let pos = 0;
            for (let chCkIdx = 0; chCkIdx < dataChkCnt; chCkIdx++) {
              let bufLen = 0;
              for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
                let chChk = testData[ch][chCkIdx];
                bufLen = chChk.length;
                //let cacheId = uuid + '_' + ch + '_' + chCkIdx;
                let chkDbId = [uuid, indDbChkIdx + chCkIdx, ch];
                let cr = recFileObjStore.add(chChk, chkDbId);
                //console.debug("Added: " + ch + " " + (indDbChkIdx + chCkIdx));
                cr.onsuccess = () => {
                  //console.debug("Stored audio data to indexed db");
                }
                cr.onerror = () => {
                  console.error("Error storing audio data to indexed db");
                }
              }
              pos += bufLen;
            }
            indDbChkIdx += dataChkCnt;

            tr.onerror = (err) => {
              console.error('Failed to cache audio data to indexed db: ' + err)
            }
            tr.oncomplete = () => {
              console.debug('Transferred capture audio data to indexed db, deleting original data from memory...');
              aab = new IndexedDbAudioBuffer(db,RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME,NUMBER_OF_CHANNELS,SAMPLE_RATE,CHUNK_SIZE,CHUNK_COUNT+CHUNK_SIZE,uuid);
              let framesCorrect = true;

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
                      console.debug('Calling done function');
                      done.call(self);
                    }
                  }
              );
            }
            tr.commit();
          } catch (err) {
            console.error('Transfer capture audio data error: ' + err);
          }
        }
      });
    }
);
