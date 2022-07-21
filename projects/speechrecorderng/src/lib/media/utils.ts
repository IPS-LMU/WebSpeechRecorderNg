
    export class MediaUtils {

        static toMediaTime(timeInSeconds:number):string{
            let rest=timeInSeconds;
            let hours=Math.floor(timeInSeconds/3600);
            rest-=hours*3600;
            let minutes=Math.floor(rest/60);
            rest-=minutes*60;
            let seconds=Math.floor(rest);
            rest-=seconds;
            let millis=Math.round(rest*1000);
            return hours.toString().padStart(2,'0')+':'+minutes.toString().padStart(2,'0')+':'+seconds.toString().padStart(2,'0')+'.'+millis.toString().padStart(3,'0');
        }
    }
