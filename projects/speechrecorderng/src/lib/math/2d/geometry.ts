export class Position{
  constructor(public left:number,public top:number){

  }
  toString():string{
    return this.left+","+this.top
  }
}


export class Dimension {
  constructor(public width:number,public height:number){

  }
  toString():string{
    return this.width+"x"+this.height
  }
}


export class Rectangle{

  constructor(public position:Position,public dimension:Dimension){

  }
  toString():string{
    return this.position+":"+this.dimension
  }
}
