
    export class Point {
        constructor(private _x:number,private _y:number) {
        }
        get x():number{
            return this._x;
        }
        get y():number{
            return this._y;
        }
    }
    export class Marker {
        name: string|null=null;
        framePosition: number|null=null;

    }


