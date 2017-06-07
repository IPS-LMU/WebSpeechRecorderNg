import { Complex } from 'app/math/complex';

    export class DFTFloat32 {

        private n:number;
        private m:number;

        private cosLookup:Float32Array;
        private sinLookup:Float32Array;

        constructor(n:number) {
            this.n = n;
            this.m = Math.log(n) / Math.log(2);

            //if(n != (1 << m))throw new RuntimeException("length N must be power of 2");

            // lookup tables
            this.cosLookup = new Float32Array(n / 2);
            this.sinLookup = new Float32Array(n / 2);

            for (var i:number = 0; i < n / 2; i++) {
                var arc = (-2 * Math.PI * i) / n;
                this.cosLookup[i] = Math.cos(arc);
                this.sinLookup[i] = Math.sin(arc);
            }
        }

        public processReal(srcBuf:Float32Array):Array<Complex> {
            var x = srcBuf.slice();
            var y = new Float32Array(srcBuf.length);
            for (var yi:number = 0; yi < y.length; yi++) {
                y[yi] = 0.0;
            }
            this.fftCooleyTukey(x, y);
            var rc = new Array<Complex>(x.length);
            for (var i:number = 0; i < x.length; i++) {
                rc[i] = new Complex(x[i], y[i]);
            }
            return rc;
        }

        public processRealMagnitude(srcBuf:Float32Array):Float32Array {
            var x = srcBuf.slice();
            var y = new Float32Array(srcBuf.length);
            for (var yi:number = 0; yi < y.length; yi++) {
                y[yi] = 0.0;
            }
            this.fftCooleyTukey(x, y);
            var rc = new Float32Array(x.length);
            for (var i:number = 0; i < x.length; i++) {
                var rcc = new Complex(x[i], y[i]);
                rc[i] = rcc.magnitude();
            }
            return rc;
        }

        public fftCooleyTukey(real:Float32Array, img:Float32Array):void {
            var i:number;
            var j:number = 0;
            var k:number;
            var n1:number;
            var n2:number = this.n / 2;
            var a:number;
            var c:number;
            var s:number;
            var t1:number;
            var t2:number;

            for (i = 1; i < this.n - 1; i++) {
                n1 = n2;
                while (j >= n1) {
                    j = j - n1;
                    n1 = n1 / 2;
                }
                j = j + n1;

                if (i < j) {
                    t1 = real[i];
                    real[i] = real[j];
                    real[j] = t1;
                    t1 = img[i];
                    img[i] = img[j];
                    img[j] = t1;
                }
            }

            n1 = 0;
            n2 = 1;
            for (i = 0; i < this.m; i++) {
                n1 = n2;
                n2 = n2 + n2;
                a = 0;
                for (j = 0; j < n1; j++) {
                    c = this.cosLookup[a];
                    s = this.sinLookup[a];
                    a += 1 << (this.m - i - 1);

                    for (k = j; k < this.n; k = k + n2) {
                        t1 = c * real[k + n1] - s * img[k + n1];
                        t2 = s * real[k + n1] + c * img[k + n1];
                        real[k + n1] = real[k] - t1;
                        img[k + n1] = img[k] - t2;
                        real[k] = real[k] + t1;
                        img[k] = img[k] + t2;
                    }
                }
            }
        }


        public process(t:Array<Complex>):Array<Complex> {
            var reals:Float32Array = new Float32Array(this.n);
            var imgs:Float32Array = new Float32Array(this.n);
            var trans:Array<Complex> = new Array<Complex>(this.n);
            for (var i:number = 0; i < this.n; i++) {
                reals[i] = t[i].real;
                imgs[i] = t[i].img;
            }
            this.fftCooleyTukey(reals, imgs);
            for (var i:number = 0; i < this.n; i++) {
                trans[i] = new Complex(reals[i], imgs[i]);
            }
            return trans;


        }

    }
    export class DFT {

        private n:number;
        private m:number;

        private cosLookup:Array<number>;
        private sinLookup:Array<number>;

        constructor(n:number) {
            this.n = n;
            this.m = Math.log(n) / Math.log(2);

            //if(n != (1 << m))throw new RuntimeException("length N must be power of 2");

            // lookup tables
            this.cosLookup = new Array<number>(n / 2);
            this.sinLookup = new Array<number>(n / 2);

            for (var i:number = 0; i < n / 2; i++) {
                var arc = (-2 * Math.PI * i) / n;
                this.cosLookup[i] = Math.cos(arc);
                this.sinLookup[i] = Math.sin(arc);
            }
        }

        public processReal(srcBuf:Array<number>):Array<number> {
            var x = srcBuf.slice();
            var y = new Array<number>(srcBuf.length);
            for (var yi:number = 0; yi < y.length; yi++) {
                y[yi] = 0.0;
            }
            this.fftCooleyTukey(x, y);
            var rc = new Complex[x.length];
            for (var i:number = 0; i < x.length; i++) {
                rc[i] = new Complex(x[i], y[i]);
            }
            return rc;
        }

        public fftCooleyTukey(real:Array<number>, img:Array<number>):void {
            var i:number;
            var j:number = 0;
            var k:number;
            var n1:number;
            var n2:number = this.n / 2;
            var a:number;
            var c:number;
            var s:number;
            var t1:number;
            var t2:number;

            for (i = 1; i < this.n - 1; i++) {
                n1 = n2;
                while (j >= n1) {
                    j = j - n1;
                    n1 = n1 / 2;
                }
                j = j + n1;

                if (i < j) {
                    t1 = real[i];
                    real[i] = real[j];
                    real[j] = t1;
                    t1 = img[i];
                    img[i] = img[j];
                    img[j] = t1;
                }
            }

            n1 = 0;
            n2 = 1;
            for (i = 0; i < this.m; i++) {
                n1 = n2;
                n2 = n2 + n2;
                a = 0;
                for (j = 0; j < n1; j++) {
                    c = this.cosLookup[a];
                    s = this.sinLookup[a];
                    a += 1 << (this.m - i - 1);

                    for (k = j; k < this.n; k = k + n2) {
                        t1 = c * real[k + n1] - s * img[k + n1];
                        t2 = s * real[k + n1] + c * img[k + n1];
                        real[k + n1] = real[k] - t1;
                        img[k + n1] = img[k] - t2;
                        real[k] = real[k] + t1;
                        img[k] = img[k] + t2;
                    }
                }
            }
        }


        public process(t:Array<Complex>):Array<Complex> {
            var reals:Array<number> = new Array<number>(this.n);
            var imgs:Array<number> = new Array<number>(this.n);
            var trans:Array<Complex> = new Array<Complex>(this.n);
            for (var i:number = 0; i < this.n; i++) {
                reals[i] = t[i].real;
                imgs[i] = t[i].img;
            }
            this.fftCooleyTukey(reals, imgs);
            for (var i:number = 0; i < this.n; i++) {
                trans[i] = new Complex(reals[i], imgs[i]);
            }
            return trans;


        }

    }

