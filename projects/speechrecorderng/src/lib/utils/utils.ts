
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
  }
