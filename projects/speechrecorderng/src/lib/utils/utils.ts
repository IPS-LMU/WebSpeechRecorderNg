
import {SprLogger} from "./logger";

/**
 * A readable sentence for whatever a failed request or operation handed back.
 *
 * The status lines used to print the reason object itself, which reached the operator as
 * "[object Object]" — an `HttpErrorResponse` is not an `Error`, and a rejected promise can carry a
 * plain object, so a bare `String(reason)` is not enough. Order: an Error's message, an object's
 * `message`, an HTTP status with its text, then the value itself.
 */
export function messageOf(reason: unknown): string {
  if (reason === null || reason === undefined) {
    return '';
  }
  if (typeof reason === 'string') {
    return reason;
  }
  if (reason instanceof Error) {
    return reason.message;
  }
  const candidate = reason as {message?: unknown, status?: unknown, statusText?: unknown};
  if (typeof candidate.message === 'string' && candidate.message !== '') {
    return candidate.message;
  }
  if (typeof candidate.status === 'number') {
    return typeof candidate.statusText === 'string' && candidate.statusText !== ''
      ? `HTTP ${candidate.status} ${candidate.statusText}`
      : `HTTP ${candidate.status}`;
  }
  try {
    const rendered = JSON.stringify(reason);
    if (rendered !== undefined) {
      return rendered;
    }
  } catch (ignored) {
    // A circular structure has no JSON form; fall through to String.
  }
  return String(reason);
}

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
        SprLogger.info("Worker method name: " + woFctNm)
      }

      let woFctStr = workerFct.toString()
      if (WorkerHelper.DEBUG) {
        SprLogger.info("Worker method string:")
        SprLogger.info(woFctStr)
      }


      // Make sure code starts with "function()"

      // Chrome, Firefox: "[wofctNm](){...}", Safari: "function [wofctNm](){...}"
      // we need an anonymous function: "function() {...}"
      let piWoFctStr = woFctStr.replace(/^function +/, '');

      if(WorkerHelper.DEBUG){
        SprLogger.info("Worker platform independent function string:")
        SprLogger.info(piWoFctStr)
      }

      // Convert to anonymous function
      let anonWoFctStr = piWoFctStr.replace(woFctNm + '()', 'function()')
      if(WorkerHelper.DEBUG){
        SprLogger.info("Worker anonymous function string:")
        SprLogger.info(piWoFctStr)
      }
      // Self executing
      let ws = '(' + anonWoFctStr + ')();'
      if(WorkerHelper.DEBUG){
        SprLogger.info("Worker self executing anonymous function string:")
        SprLogger.info(anonWoFctStr)
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
