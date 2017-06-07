

    export class Utils {
        public static toHexString(val:number, radix:number, numberOfDigits:number):string {
            var intVal = Math.round(val);
            var str = intVal.toString(radix);
            var countFillChars = numberOfDigits - str.length;
            if (countFillChars > 0) {
                for (var i = 0; i < countFillChars; i++) {
                    str = str + 0;
                }
            }
            return str;
        }
    }

