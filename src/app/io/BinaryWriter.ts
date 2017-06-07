
    export class BinaryByteWriter {
        static DEFAULT_SIZE_INC=1024;
        buf:ArrayBuffer;
        private _pos:number;

        constructor() {
            var size=BinaryByteWriter.DEFAULT_SIZE_INC;
            this.buf = new ArrayBuffer(size);
            this._pos = 0;
        }

        get pos():number {
            return this._pos;
        }

        ensureCapacity(numBytes:number){

          while(this._pos+numBytes>=this.buf.byteLength){
            // buffer increment
              let inc = BinaryByteWriter.DEFAULT_SIZE_INC;
              if (inc < numBytes) {
                  inc = numBytes;
              }
              var newSize = this.buf.byteLength + inc;

            var arrOld=new Uint8Array(this.buf,0,this._pos);
            var arrNew=new Uint8Array(newSize);
            arrNew.set(arrOld);
            this.buf=arrNew.buffer;
          }
        }

        writeUint8(val:number):void{
          this.ensureCapacity(1);
          var valView=new DataView(this.buf,this._pos,1);
          valView.setUint8(0,val);
          this._pos++;
        }

      writeUint16(val:number, le:boolean):void{
        this.ensureCapacity(2);
        var valView=new DataView(this.buf,this._pos,2);
        valView.setUint16(0,val,le);
        this._pos+=2;

      }
      writeInt16(val:number, le:boolean):void{
        this.ensureCapacity(2);
        var valView=new DataView(this.buf,this._pos,2);
        valView.setInt16(0,val,le);
        this._pos+=2;
      }


      writeUint32(val:number,le:boolean):void{
        this.ensureCapacity(4);
        var valView=new DataView(this.buf,this._pos,4);
        valView.setUint32(0,val,le);
        this._pos+=4;
      }

      writeInt32(val:number,le:boolean):void{
        this.ensureCapacity(4);
        var valView=new DataView(this.buf,this._pos,4);
        valView.setInt32(0,val,le);
        this._pos+=4;
      }
        finish():Uint8Array{
          var finalArr=new Uint8Array(this._pos);
          var dv=new DataView(this.buf,0,this._pos);
          for(var i=0;i<this._pos;i++){
            finalArr[i]=dv.getUint8(i);
          }
          return finalArr;
        }

        writeAscii(text:string):void {
            var i;
            for (i = 0; i < text.length; i++) {
              var asciiCode=text.charCodeAt(i);
              if(asciiCode<0 || asciiCode>255){
                throw new Error("Not an ASCII character at char "+i+" in "+text);
              }
              this.writeUint8(asciiCode);
            }
        }

    }

