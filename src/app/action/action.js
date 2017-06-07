var ips;
(function (ips) {
    var action;
    (function (action) {
        var ActionEvent = (function () {
            function ActionEvent() {
            }
            return ActionEvent;
        }());
        action.ActionEvent = ActionEvent;
        var Action = (function () {
            function Action(name) {
                this._name = name;
                this.listeners = new Array();
                this.controls = [];
            }
            Object.defineProperty(Action.prototype, "name", {
                get: function () {
                    return this._name;
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(Action.prototype, "onAction", {
                get: function () {
                    return this._onAction;
                },
                set: function (value) {
                    this._onAction = value;
                },
                enumerable: true,
                configurable: true
            });
            Action.prototype.createActionEvent = function () {
                // default:
                return new ActionEvent();
            };
            Action.prototype.perform = function () {
                if (this._onAction) {
                    this._onAction.call(this.createActionEvent());
                }
            };
            Object.defineProperty(Action.prototype, "disabled", {
                get: function () {
                    return this._disabled;
                },
                set: function (disabled) {
                    this._disabled = disabled;
                    for (var _i = 0, _a = this.listeners; _i < _a.length; _i++) {
                        var l = _a[_i];
                        var e = new CustomEvent('toggle_disabled', { 'detail': this._disabled });
                        l.call(e);
                    }
                    for (var _b = 0, _c = this.controls; _b < _c.length; _b++) {
                        var c = _c[_b];
                        c.disabled = this._disabled;
                    }
                },
                enumerable: true,
                configurable: true
            });
            Action.prototype.addControl = function (ctrl) {
                if (ctrl) {
                    if (this.controls.indexOf(ctrl) < 0) {
                        ctrl.disabled = this.disabled;
                        this.controls.push(ctrl);
                    }
                }
            };
            Action.prototype.removeControl = function (ctrl) {
                var i = this.controls.indexOf(ctrl);
                if (i >= 0) {
                    this.controls = this.controls.splice(i, 1);
                }
            };
            return Action;
        }());
        action.Action = Action;
    })(action = ips.action || (ips.action = {}));
})(ips || (ips = {}));
//# sourceMappingURL=action.js.map