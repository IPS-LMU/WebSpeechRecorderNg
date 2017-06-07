

    export class Utils {
        public static toHexString(val: number, radix: number, numberOfDigits: number): string {
            const intVal = Math.round(val);
            let  str = intVal.toString(radix);
            const countFillChars = numberOfDigits - str.length;
            if (countFillChars > 0) {
                for (let i = 0; i < countFillChars; i++) {
                    str = str + 0;
                }
            }
            return str;
        }
    }

