
    export class Complex {

        real: number;
        img: number;

        public static fromPolarForm(magnitude: number, argument: number): Complex {
            const r = Math.cos(argument) * magnitude;
            const i = Math.sin(argument) * magnitude;
            return new Complex(r, i);
        }
        constructor(real: number, img: number) {
            this.real = real;
            this.img = img;
        }
        public magnitude(): number {
            return Math.sqrt((this.real * this.real) + (this.img * this.img));
        }

        public argument(): number {
            return Math.atan2(this.img, this.real);
        }

        public add(addC: Complex): Complex {
            return new Complex(this.real + addC.real, this.img + addC.img);
        }

        public sub(subC: Complex): Complex {
            return new Complex(this.real - subC.real, this.img - subC.img);
        }

        public mult(multC: Complex): Complex {
            const multR = (this.real * multC.real) - (this.img * multC.img);
            const multI = (this.real * multC.img) + (multC.real * this.img);
            return new Complex(multR, multI);
        }

        public multReal(multF: number): Complex {
            return new Complex(this.real * multF, this.img * multF);
        }

        public div(divisor: Complex): Complex {
            const divReal = divisor.real;
            const divImg = divisor.img;
            const div = (divReal * divReal) + (divImg * divImg);
            const divisionReal = ((this.real * divReal) + (this.img * divImg)) / div;
            const divisionImg = ((divReal * this.img) - (this.real * divImg)) / div;

            return new Complex(divisionReal, divisionImg);
        }

        public divReal(divisor: number): Complex {
            const div = divisor * divisor;
            const divsionReal = (this.real * divisor) / div;
            const divsionImg = (divisor * this.img) / div;

            return new Complex(divsionReal, divsionImg);
        }

        public conjugate(): Complex {
            return new Complex(this.real, -this.img);
        }

        public equals(c: Complex): boolean {
            if (c === null) {
                return false;
            }
            return (this.real === c.real && this.img === c.img);
        }

        public toString(): string {
            return 'Real: ' + this.real + ', Img: ' + this.img;
        }
    }
