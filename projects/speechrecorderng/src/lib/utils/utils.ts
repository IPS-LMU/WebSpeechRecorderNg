
  export class UUID {

    static generate():string {
    return UUID.s4() + UUID.s4() + '-' + UUID.s4() + '-' + UUID.s4() + '-' +
      UUID.s4() + '-' + UUID.s4() + UUID.s4() + UUID.s4();
  }

    private static s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  }

  export class Arrays {

    static cloneNumberArray(numberArray: Array<number>): Array<number> {
      let len = numberArray.length;
      let cloneArr = new Array<number>(len);
      for (let c = 0; c < numberArray.length; c++) {
        cloneArr[c] = numberArray[c];
      }
      return cloneArr;
    }

    static swap<T>(items:Array<T>, i:number, j:number) {
      let tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }

    static shuffleArray<T>(orgArray:Array<T>):Array<T>{
        let shuffledArray = [...orgArray];
        for (let i = shuffledArray.length; i > 1; i--) {
          let rnd=Math.random();
          let rndArrIdx=Math.floor(rnd*i);
          Arrays.swap(shuffledArray, i - 1, rndArrIdx);
        }
        return shuffledArray;
      }
  }

  export class WorkerHelper {

    static DEBUG=false;
    static buildWorkerBlobURL(workerFct: Function): string {
      let woFctStr = 'function(){console.warn(\'Worker builder parameter is not a function! (XSS attack?)\');}';
      let woFctNm = 'notafunction';
      if(workerFct instanceof Function) {

        woFctNm = workerFct.name
        if (WorkerHelper.DEBUG) {
          console.info("Worker method name: " + woFctNm)
        }

        woFctStr = workerFct.toString()
        if (WorkerHelper.DEBUG) {
          console.info("Worker method string:")
          console.info(woFctStr)
        }
      }

      // Make sure code starts with "function()"

      // Chrome, Firefox: "[wofctNm](){...}", Safari: "function [wofctNm](){...}"
      // we need an anonymous function: "function() {...}"
      let piWoFctStr = woFctStr.replace(/^function +/, '');

      if(WorkerHelper.DEBUG){
        console.info("Worker platform independent function string:")
        console.info(piWoFctStr)
      }

      // Convert to anonymous function
      let anonWoFctStr = piWoFctStr.replace(woFctNm + '()', 'function()')
      if(WorkerHelper.DEBUG){
        console.info("Worker anonymous function string:")
        console.info(piWoFctStr)
      }
      // Self executing
      let ws = '(' + anonWoFctStr + ')();'
      if(WorkerHelper.DEBUG){
        console.info("Worker self executing anonymous function string:")
        console.info(anonWoFctStr)
      }
      // Build the worker blob
      let wb = new Blob([ws], {type: 'text/javascript'});

      let workerBlobUrl=window.URL.createObjectURL(wb);
      return workerBlobUrl;
    }
  }
