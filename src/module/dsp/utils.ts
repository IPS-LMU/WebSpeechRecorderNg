
    export class DSPUtils {

        private static OCTAVE_FACTOR: number = 1.0 / (Math.log(2) / Math.log(10));

        /**
         * Get normalized amplitude level in dB
         * @param linearLevel a normalized positive linear level (1.0 corresponds to 0dB)
         * @return level in dB
         */
        public static toLevelInDB(linearLevel: number): number {
            if (linearLevel < 0) {
                throw new RangeError('Linear level argument must be positive.');
            }

            return 10 * Math.log(linearLevel) / Math.log(10);
        }


        public static toLinearLevel(dbLevel: number): number {
            return Math.pow(10, (dbLevel / 10));
        }

        /**
         * Get normalized amplitude power level in dB
         * @param linearLevel a normalized positive linear level (1.0 corresponds to 0dB)
         * @return power level in dB
         */
        public static toPowerLevelInDB(linearLevel: number): number {
            if (linearLevel < 0) {
                throw new RangeError('Linear level argument must be positive.');
            }
            return 20 * Math.log(linearLevel) / Math.log(10);
        }

        public static toPowerLinearLevel(dbLevel: number): number {
            return Math.pow(10, (dbLevel / 20));
        }

        public static toOctaves(fq: number): number {
            return DSPUtils.OCTAVE_FACTOR * Math.log(fq) / Math.log(10);
        }

        public static maxLevel(audioBuffer: AudioBuffer): number {
            let ml = 0.0;
            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
              const chArr = audioBuffer.getChannelData(ch);
              for (let s = 0; s < chArr.length; s++) {
                const l = Math.abs(chArr[s]);
                if (l > ml) {
                  ml = l;
                }
              }
            }
            return ml;
        }

    }
