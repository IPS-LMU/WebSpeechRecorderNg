export class Position{
  constructor(public left:number,public top:number){

  }
}


export class Dimension {
  constructor(public width:number,public height:number){

  }
}


export class Rectangle{

  constructor(public position:Position,public dimension:Dimension){

  }
}
