
    export interface WindowFunction {
        getScale(i: number): number;
    }

    export class GaussianWindow implements WindowFunction {

        public static DEFAULT_SIGMA = 0.3;
        // Gaussian window function,
        // http://reference.wolfram.com/language/ref/GaussianWindow.html
        // val=exp(-50*x*x/9) => sigma=0.3

        private buf: Float32Array;

        constructor(size: number, sigma: number = GaussianWindow.DEFAULT_SIGMA) {
            this.buf = new Float32Array(size);
            const center = (size - 1) / 2;
            for (let i = 0; i < size; i++) {
                const quot = (i - center) / (sigma * center);
                const exp = -0.5 * quot * quot;
                const val = Math.exp(exp);
                this.buf[i] = val;
            }
        }

        getScale(i: number): number {
            return this.buf[i];
        }

    }

