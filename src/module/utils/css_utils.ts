import { Utils } from '../math/utils';

    export class CSSUtils {

        static toColorString(red: number, green: number, blue: number): string {
            return '#' + Utils.toHexString(red, 16, 2) + Utils.toHexString(green, 16, 2) + Utils.toHexString(blue, 16, 2);
        }
    }
