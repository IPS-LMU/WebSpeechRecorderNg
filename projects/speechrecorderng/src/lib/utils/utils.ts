
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

  export class DataSize{
    private static BINARY_UNITS=['B','KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB','RiB','QiB'];
    private static BINARY_UNIT_FACTOR:number=1024;
    private static BINARY_UNIT_FACTOR_LOG:number=Math.log(DataSize.BINARY_UNIT_FACTOR);

    static formatBytesToBinaryUnits(bytes:number,decimals:number=2):string{

      let binaryUnitIdx=0;
      let divisor=1;
      if(bytes>0) {
        const bytesLog = Math.log(bytes);
        binaryUnitIdx = Math.floor(bytesLog / this.BINARY_UNIT_FACTOR_LOG);
        if (binaryUnitIdx >= this.BINARY_UNITS.length) {
          // fallback to bytes
          binaryUnitIdx = 0;
        }
        divisor = Math.pow(this.BINARY_UNIT_FACTOR, binaryUnitIdx);
      }
      let decimalsUnitValue:string;
      if(binaryUnitIdx===0){
        decimalsUnitValue=bytes.toString();
      }else {
        const unitValue = bytes / divisor;
        decimalsUnitValue=unitValue.toFixed(decimals);
      }
      const binaryUnitStr = decimalsUnitValue + ' ' + this.BINARY_UNITS[binaryUnitIdx];

      return binaryUnitStr;
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

      if(! (workerFct instanceof Function)) {
        throw new Error(
            'Parameter workerFct is not a function! (XSS attack?).'
        )
      }
      let  woFctNm = workerFct.name
      if (WorkerHelper.DEBUG) {
        console.info("Worker method name: " + woFctNm)
      }

      let woFctStr = workerFct.toString()
      if (WorkerHelper.DEBUG) {
        console.info("Worker method string:")
        console.info(woFctStr)
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

  export class ErrorHelper{

    static messageFromError(error:any):string|null{
        let msg=null;
        if(error instanceof Error){
          msg=error.message;
        }
        return msg;
    }

    static messageFromErrorNonNull(error:any):string{
      let msg='';
      const msgNullable=ErrorHelper.messageFromError(error);
      if(msgNullable!=null){
        msg=msgNullable;
      }
      return msg;
    }

    static message(baseMessage:string,error:any):string{
      let msg=baseMessage;
      if(error instanceof Error){
        msg=baseMessage+': '+error.message;
      }else{
        msg=baseMessage+'.';
      }
      return msg;
    }

  }
