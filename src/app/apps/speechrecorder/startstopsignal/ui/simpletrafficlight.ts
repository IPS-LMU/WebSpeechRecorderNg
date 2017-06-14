import {Component} from '@angular/core'
import {StartStopSignal, State} from '../startstopsignal'

@Component({

  selector: 'app-simpletrafficlight',

  template: `

    <div>
      <div class="circle {{lighttop}}"></div>
      <div class="circle {{lightmid}}"></div>
      <div class="circle {{lightbottom}}"></div>
    </div>
  `
  ,
  styles: [`.circle {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    margin: 5px;
    background: grey;
  }`, `.red {
    background: red;
  }
  `, `
    .yellow {
      background: yellow;
    }
  `, `
    .green {
      background: green;
    }
  `, `
    .black {
      background: black;
    }`,
      `:host {
      display: flex;
      flex-direction: column;
      background: black;
      padding: 2px;
      height: 170px;
      max-height: 170px;
      flex: 0;
    }
    `]
})
export class SimpleTrafficLight implements StartStopSignal {

  private lighttop: string;
  private lightmid: string;
  private lightbottom: string;

  constructor() {
    this.setStatus(State.OFF);
  }

  setStatus(status: State) {
    if (State.OFF === status) {
      this.lighttop = 'grey';
      this.lightmid = 'grey';
      this.lightbottom = 'grey';
    } else if (State.IDLE === status) {
      this.lighttop = 'red';
      this.lightmid = 'grey';
      this.lightbottom = 'grey';
    } else if (State.PRERECORDING == status) {
      this.lighttop = 'red';
      this.lightmid = 'yellow';
      this.lightbottom = 'grey';
    } else if (State.RECORDING == status) {
      this.lighttop = 'grey';
      this.lightmid = 'grey';
      this.lightbottom = 'green';
    } else if (State.POSTRECORDING == status) {
      this.lighttop = 'grey';
      this.lightmid = 'yellow';
      this.lightbottom = 'grey';
    }
  }
}


