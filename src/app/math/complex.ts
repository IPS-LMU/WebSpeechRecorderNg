
    export class Complex {

        real:number;
        img:number;

        constructor(real:number, img:number) {
            this.real = real;
            this.img = img;
        }

        public static fromPolarForm(magnitude:number, argument:number):Complex {
            var r = Math.cos(argument) * magnitude;
            var i = Math.sin(argument) * magnitude;
            return new Complex(r, i);
        }

        public magnitude():number {
            return Math.sqrt((this.real * this.real) + (this.img * this.img));
        }

        public argument():number {
            return Math.atan2(this.img, this.real);
        }

        public add(addC:Complex):Complex {
            return new Complex(this.real + addC.real, this.img + addC.img);
        }

        public sub(subC:Complex):Complex {
            return new Complex(this.real - subC.real, this.img - subC.img);
        }

        public mult(multC:Complex):Complex {
            var multR = (this.real * multC.real) - (this.img * multC.img);
            var multI = (this.real * multC.img) + (multC.real * this.img);
            return new Complex(multR, multI);
        }

        public multReal(multF:number):Complex {
            return new Complex(this.real * multF, this.img * multF);
        }

        public div(divisor:Complex):Complex {
            var divReal = divisor.real;
            var divImg = divisor.img;
            var div = (divReal * divReal) + (divImg * divImg);
            var divisionReal = ((this.real * divReal) + (this.img * divImg)) / div;
            var divisionImg = ((divReal * this.img) - (this.real * divImg)) / div;

            return new Complex(divisionReal, divisionImg);
        }

        public divReal(divisor:number):Complex {
            var div = divisor * divisor;
            var divsionReal = (this.real * divisor) / div;
            var divsionImg = (divisor * this.img) / div;

            return new Complex(divsionReal, divsionImg);
        }

        public conjugate():Complex {
            return new Complex(this.real, -this.img);
        }

        public equals(c:Complex):boolean {
            if (c == null)
                return false;
            return (this.real == c.real && this.img == c.img);
        }

        public toString():string {
            return "Real: " + this.real + ", Img: " + this.img;
        }

    }
