import { StartStopSignal,State } from '../startstopsignal'


    export class SimpleTrafficLight implements StartStopSignal {
        red:HTMLElement;
        yellow:HTMLElement;
        green:HTMLElement;

        constructor() {
            this.red = document.getElementById('stl_red');
            this.yellow = document.getElementById('stl_yellow');
            this.green = document.getElementById('stl_green');
            this.setStatus(State.OFF);
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


