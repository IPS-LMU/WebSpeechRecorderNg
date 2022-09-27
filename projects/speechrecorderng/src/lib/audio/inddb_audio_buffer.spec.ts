// Straight Jasmine testing without Angular's testing support
import {IndexedDbAudioBuffer, IndexedDbRandomAccessStream, PersistentAudioStorageTarget} from "./inddb_audio_buffer";
import {UUID} from "../utils/utils";
import {expect} from "@angular/flex-layout/_private-utils/testing";



describe('IndexedDbAudioBuffer',
  () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
    let CHUNK_COUNT = 23;
    let CHUNK_SIZE = 50;
    let NUMBER_OF_CHANNELS = 2;
    let SAMPLE_RATE = 44100;
    let testRefData = new Array<Float32Array>(NUMBER_OF_CHANNELS);
    let testData = new Array<Array<Float32Array>>(NUMBER_OF_CHANNELS);

    let vals = new Array<number>(NUMBER_OF_CHANNELS);

    for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
      vals[ch] = ch * 0.1;
      testRefData[ch] = new Float32Array(CHUNK_COUNT * CHUNK_SIZE);
      testData[ch] = new Array<Float32Array>();
      let testRefDataPos = 0;

      for (let ci = 0; ci < CHUNK_COUNT; ci++) {
        let cc = new Float32Array(CHUNK_SIZE);
        for (let si = 0; si < CHUNK_SIZE; si++) {
          cc[si] = Math.random() * 2 - 1;
          cc[si] = vals[ch];
          vals[ch] += 1.0;
        }
        testData[ch].push(cc);
        testRefData[ch].set(cc, testRefDataPos);
        testRefDataPos += CHUNK_SIZE;
      }
    }
    // for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
    //     console.debug(JSON.stringify(testData[ch]));
    // }


    beforeEach(() => {

    });


    function test1(aab: IndexedDbAudioBuffer, stNm: string, or: IDBOpenDBRequest, tt: number, ti: number, t1done: Function) {
      let testPos: number;
      let testBufLength: number;
      if (tt == 0) {
        // Test type 0 small chunks
        testBufLength = Math.floor(Math.random() * 128);
        if (testBufLength > CHUNK_COUNT * CHUNK_SIZE) {
          testBufLength = CHUNK_COUNT * CHUNK_SIZE;
        }
        testPos = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE - 128));
      } else {
        // Test type 1 large test buffers
        testPos = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE));
        testBufLength = Math.floor(Math.random() * (CHUNK_COUNT * CHUNK_SIZE - testPos));
      }
      if (testPos < 0) {
        testPos = 0;
      }
      if (testPos >= CHUNK_SIZE * CHUNK_COUNT) {
        testPos = 0;
      }
      if (testBufLength < 1) {
        testBufLength = 1;
      }
      if (testBufLength > CHUNK_COUNT * CHUNK_SIZE) {
        testBufLength = CHUNK_COUNT * CHUNK_SIZE;
      }
      if (testPos >= testBufLength) {
        testPos = 0;
      }

      testPos = 359;
      testBufLength = 412;

      //testPos = 3;
      //testBufLength = 7;

      //let testBufLength=CHUNK_SIZE-12;
      //console.log("Test buffer length: " + testBufLength);
      let testBuf = new Array<Float32Array>(NUMBER_OF_CHANNELS);
      for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
        testBuf[ch] = new Float32Array(testBufLength);
      }
      let db = or.result;
      let tr = db.transaction(stNm, 'readwrite');
      let recFileObjStore = tr.objectStore(stNm);
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
          let pt=new PersistentAudioStorageTarget(db,stNm);
          aab = new IndexedDbAudioBuffer(pt, NUMBER_OF_CHANNELS, SAMPLE_RATE, CHUNK_SIZE, CHUNK_COUNT + CHUNK_SIZE, uuid);
          let framesCorrect = true;
          console.debug('Test pos: ' + testPos + ' test buf len: ' + testBufLength);
          let iabStr=new IndexedDbRandomAccessStream(aab);
          iabStr.framesObs(testPos, testBufLength, testBuf).subscribe(
            {
              next: (read) => {
                for (let ch = 0; ch < NUMBER_OF_CHANNELS; ch++) {
                  for (let i = 0; i < testBufLength; i++) {
                    let expectedVal = testRefData[ch][testPos + i];
                    let testVal = testBuf[ch][i];
                    if (testVal != expectedVal) {
                      console.error("Frames at " + (testPos + i) + " differ: " + testVal + "!==+" + expectedVal);
                      framesCorrect = false;
                      break;
                    }
                  }
                }
                console.debug('Compared ' + NUMBER_OF_CHANNELS + ' channels with ' + testBufLength + ' samples.');
                expect(framesCorrect).toBeTrue();
                t1done();
              }
            }
          );
        }
        tr.commit();
      } catch (err) {
        t1done('Transfer audio data error: ' + err);
      }
    }


    function test1Loop(aab: IndexedDbAudioBuffer, stNm: string, or: IDBOpenDBRequest, tt: number, ti: number, done: DoneFn) {

      test1(aab, stNm, or, tt, ti,
        (err=undefined) => {
          if (err) {
            done.fail(err);
          } else {
            ti++;
            if (ti >= 1) {
              ti = 0;
              tt++;
            }
            if (tt < 1) {
              test1Loop(aab, stNm, or, tt, ti, done);
            } else {
              console.debug('Calling done');
              //expect(framesCorrect).toBeTrue();
              done();
            }
          }
        });
  }


  it('#framesObs should asynchronously return correct values', (done) => {
      let DB_NAME = 'inddb_audio_buffer_spec_test_db';
      let RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME = 'rec_file_chunks';

      let aab: IndexedDbAudioBuffer;
      let or: IDBOpenDBRequest;
      or = indexedDB.open(DB_NAME, 1);
      or.onerror = (err) => {
        done.fail("Could not open indexed database: " + DB_NAME + ": " + err);
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
        test1Loop(aab, RECORDING_FILE_CHUNKS_OBJECT_STORE_NAME, or, 0, 0, done);
      }
    }
  );

});
