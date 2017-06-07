var ips;
(function (ips) {
    var math;
    (function (math) {
        var Utils = (function () {
            function Utils() {
            }
            Utils.toHexString = function (val, radix, numberOfDigits) {
                var intVal = Math.round(val);
                var str = intVal.toString(radix);
                var countFillChars = numberOfDigits - str.length;
                if (countFillChars > 0) {
                    for (var i = 0; i < countFillChars; i++) {
                        str = str + 0;
                    }
                }
                return str;
            };
            return Utils;
        }());
        math.Utils = Utils;
    })(math = ips.math || (ips.math = {}));
})(ips || (ips = {}));
//# sourceMappingURL=utils.js.map