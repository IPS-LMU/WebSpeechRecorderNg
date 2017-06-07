/**
 * Created by klausj on 19.08.2015.
 */
var ips;
(function (ips) {
    var io;
    (function (io) {
        var BinaryByteWriter = (function () {
            function BinaryByteWriter() {
                var size = BinaryByteWriter.DEFAULT_SIZE_INC;
                this.buf = new ArrayBuffer(size);
                this._pos = 0;
            }
            Object.defineProperty(BinaryByteWriter.prototype, "pos", {
                get: function () {
                    return this._pos;
                },
                enumerable: true,
                configurable: true
            });
            BinaryByteWriter.prototype.ensureCapacity = function (numBytes) {
                while (this._pos + numBytes >= this.buf.byteLength) {
                    // buffer increment
                    var newSize = this.buf.byteLength + BinaryByteWriter.DEFAULT_SIZE_INC;
                    var arrOld = new Uint8Array(this.buf, 0, this._pos);
                    var arrNew = new Uint8Array(newSize);
                    arrNew.set(arrOld);
                    this.buf = arrNew.buffer;
                }
            };
            BinaryByteWriter.prototype.writeUint8 = function (val) {
                this.ensureCapacity(1);
                var valView = new DataView(this.buf, this._pos, 1);
                valView.setUint8(0, val);
                this._pos++;
            };
            BinaryByteWriter.prototype.writeUint16 = function (val, le) {
                this.ensureCapacity(2);
                var valView = new DataView(this.buf, this._pos, 2);
                valView.setUint16(0, val, le);
                this._pos += 2;
            };
            BinaryByteWriter.prototype.writeInt16 = function (val, le) {
                this.ensureCapacity(2);
                var valView = new DataView(this.buf, this._pos, 2);
                valView.setInt16(0, val, le);
                this._pos += 2;
            };
            BinaryByteWriter.prototype.writeUint32 = function (val, le) {
                this.ensureCapacity(4);
                var valView = new DataView(this.buf, this._pos, 4);
                valView.setUint32(0, val, le);
                this._pos += 4;
            };
            BinaryByteWriter.prototype.writeInt32 = function (val, le) {
                this.ensureCapacity(4);
                var valView = new DataView(this.buf, this._pos, 4);
                valView.setInt32(0, val, le);
                this._pos += 4;
            };
            BinaryByteWriter.prototype.finish = function () {
                var finalArr = new Uint8Array(this._pos);
                var dv = new DataView(this.buf, 0, this._pos);
                for (var i = 0; i < this._pos; i++) {
                    finalArr[i] = dv.getUint8(i);
                }
                return finalArr;
            };
            BinaryByteWriter.prototype.writeAscii = function (text) {
                var i;
                for (i = 0; i < text.length; i++) {
                    var asciiCode = text.charCodeAt(i);
                    if (asciiCode < 0 || asciiCode > 255) {
                        throw new Error("Not an ASCII character at char " + i + " in " + text);
                    }
                    this.writeUint8(asciiCode);
                }
            };
            BinaryByteWriter.DEFAULT_SIZE_INC = 1024;
            return BinaryByteWriter;
        }());
        io.BinaryByteWriter = BinaryByteWriter;
    })(io = ips.io || (ips.io = {}));
})(ips || (ips = {}));
//# sourceMappingURL=BinaryWriter.js.map