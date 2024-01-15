define("{{CSS_MODULE_NAME}}", ["require", "exports", "atomicreact"], function (require, exports, atomicreact_1) {
    "use strict";
    Object.defineProperties(exports, {"__esModule": { value: true }, "default": { value: {} }});
    eval(`{{TOKENS}}`)
        .forEach(token => {
            exports.default[token] = `{{ID}}_${token}`;
            Object.defineProperty(exports, token, {get: function(){
                return exports.default[token]
            }}) 
        })
});