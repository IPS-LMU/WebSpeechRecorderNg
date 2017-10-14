
    export class ActionEvent {
        constructor() {

        }
    }

    export class Action {

        private _name:string;
        _disabled=true;
        private _onAction:EventListener;
        listeners:Array<EventListener>;
        private controls:HTMLInputElement[];

        constructor(name:string) {
            this._name = name;
            this.listeners = new Array<EventListener>();
            this.controls = [];
        }

        get name():string {
            return this._name;
        }


        get onAction():EventListener {
            return this._onAction;
        }

        set onAction(value:EventListener) {
            this._onAction = value;
        }

        protected  createActionEvent():ActionEvent {
            // default:
            return new ActionEvent();
        }

        perform():void {
            if (!this.disabled && this._onAction) {
                this._onAction.call(this.createActionEvent());
            }
        }

        set disabled(disabled:boolean) {
            this._disabled = disabled;
            for (let c of this.controls) {
                c.disabled = this._disabled;
            }
            let disStr=this.disabled?"disabled":"enabled";
            console.log(this._name+": "+disStr);
        }

        get disabled():boolean {
            return this._disabled;
        }

        addControl(ctrl: HTMLInputElement, actionEventName?: string) {
            if (ctrl) {
                if (this.controls.indexOf(ctrl) < 0) {
                    ctrl.disabled = this.disabled;
                    this.controls.push(ctrl);
                    if (actionEventName) {
                        ctrl.addEventListener(actionEventName, (e) => {
                            this.perform();
                        });
                    }
                }
            }
        }

        removeControl(ctrl:HTMLInputElement) {
            var i = this.controls.indexOf(ctrl);
            if (i >= 0) {
                this.controls = this.controls.splice(i, 1);
            }
        }
    }

