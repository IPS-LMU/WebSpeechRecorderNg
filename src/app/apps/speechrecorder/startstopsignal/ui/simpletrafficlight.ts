import { Component } from '@angular/core'
import { StartStopSignal,State } from '../startstopsignal'

@Component({

    selector: 'app-simpletrafficlight',

    template: `

        <div>
            <div id="stl_red" class="circle"></div>
            <div id="stl_yellow" class="circle"></div>
            <div id="stl_green" class="circle"></div>
        </div>
    `
    ,
    styles: [`.circle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        margin: 5px;
        background: grey;
    //flex: 1 1 100%;
    }`,
    `:host{
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
        red:HTMLElement;
        yellow:HTMLElement;
        green:HTMLElement;

        constructor() {
            this.red = document.getElementById('stl_red');
            this.yellow = document.getElementById('stl_yellow');
            this.green = document.getElementById('stl_green');
            //this.setStatus(State.OFF);
        }

        setStatus(status:State) {
            if (State.OFF === status) {
                this.red.style.background = 'grey';
                this.yellow.style.background = 'grey';
                this.green.style.background = 'grey';
            } else if (State.IDLE === status) {
                this.red.style.background = 'red';
                this.yellow.style.background = 'grey';
                this.green.style.background = 'grey';
            } else if (State.PRERECORDING == status) {
                this.red.style.background = 'red';
                this.yellow.style.background = 'yellow';
                this.green.style.background = 'grey';
            } else if (State.RECORDING == status) {
                this.red.style.background = 'grey';
                this.yellow.style.background = 'grey';
                this.green.style.background = 'green';
            } else if (State.POSTRECORDING == status) {
                this.red.style.background = 'grey';
                this.yellow.style.background = 'yellow';
                this.green.style.background = 'grey';
            }
        }
    }


