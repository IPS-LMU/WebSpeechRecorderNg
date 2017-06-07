/**
 * Created by klausj on 16.08.2015.
 */
var ips;
(function (ips) {
    var audio;
    (function (audio) {
        var ui;
        (function (ui) {
            var Point = (function () {
                function Point() {
                }
                return Point;
            }());
            ui.Point = Point;
            var Marker = (function () {
                function Marker() {
                }
                return Marker;
            }());
            ui.Marker = Marker;
        })(ui = audio.ui || (audio.ui = {}));
    })(audio = ips.audio || (ips.audio = {}));
})(ips || (ips = {}));
//# sourceMappingURL=common.js.map