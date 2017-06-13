
    export const enum State {IDLE, PRERECORDING, POSTRECORDING, RECORDING, OFF}
    ;

    export interface StartStopSignal {
        setStatus(status:State);
    }

