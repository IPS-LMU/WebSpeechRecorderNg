/**
 * Created by klausj on 19.08.2015.
 */
var ips;
(function (ips) {
    var io;
    (function (io) {
        var BinaryByteReader = (function () {
            function BinaryByteReader(buf) {
                this.buf = new Uint8Array(buf);
                this.sbuf = new Int8Array(buf);
                this._pos = 0;
            }
            Object.defineProperty(BinaryByteReader.prototype, "pos", {
                get: function () {
                    return this._pos;
                },
                set: function (pos) {
                    this._pos = pos;
                },
                enumerable: true,
                configurable: true
            });
            BinaryByteReader.prototype.length = function () {
                return this.buf.byteLength;
            };
            BinaryByteReader.prototype.eof = function () {
                return (this._pos >= this.buf.byteLength);
            };
            BinaryByteReader.prototype.skip = function (byteCound) {
                this.pos += 4;
            };
            BinaryByteReader.prototype.readAscii = function (size) {
                var i;
                var txt = '';
                for (i = 0; i < size; i++) {
                    txt += String.fromCharCode(this.buf[this._pos++]);
                }
                return txt;
            };
            BinaryByteReader.prototype.readInt8 = function () {
                return (this.buf[this._pos++]);
            };
            BinaryByteReader.prototype.readInt16BE = function () {
                var b0 = this.sbuf[this._pos++];
                var b1 = this.buf[this._pos++];
                var val = (b0 << 8) | b1;
                return val;
            };
            BinaryByteReader.prototype.readInt16LE = function () {
                var b0 = this.buf[this._pos++];
                var b1 = this.sbuf[this._pos++];
                var val = (b1 << 8) | b0;
                return val;
            };
            BinaryByteReader.prototype.readUint16LE = function () {
                var seg = new Uint8Array(2);
                var i;
                for (i = 0; i < 2; i++) {
                    seg[i] = this.buf[this._pos++];
                }
                var val = 0;
                val |= seg[1] << 8;
                val |= seg[0];
                return val;
            };
            BinaryByteReader.prototype.readInt32BE = function () {
                var seg = new Uint8Array(4);
                var i;
                for (i = 0; i < 4; i++) {
                    seg[i] = this.buf[this._pos++];
                }
                var val = seg[0] << 24 | seg[1] << 16 | seg[2] << 8 | seg[3];
                return val;
            };
            BinaryByteReader.prototype.readUint32LE = function () {
                // this dircet data view does not work with nodejs: all avlues are zero
                //var seg=new Uint8Array(this.buf,this._pos,4);
                // ... copy value by value
                var seg = new Uint8Array(4);
                var i;
                for (i = 0; i < 4; i++) {
                    seg[i] = this.buf[this._pos++];
                }
                //console.log("len:", seg.length, " ", seg.byteLength, " ", seg[0], " ", seg[1], " ", seg[2], " ", seg[3]);
                var val = 0;
                val |= seg[3] << 24;
                val |= seg[2] << 16;
                val |= seg[1] << 8;
                val |= seg[0];
                //var val = < 24(seg[3] <) | (seg[2] << 16) | (seg[1] << 8) | seg[0];
                //this._pos=this._pos+4;
                return val;
            };
            return BinaryByteReader;
        }());
        io.BinaryByteReader = BinaryByteReader;
    })(io = ips.io || (ips.io = {}));
})(ips || (ips = {}));
//# sourceMappingURL=BinaryReader.js.map