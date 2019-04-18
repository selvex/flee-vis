(function(exports) {
  exports.port = 3000;
  exports.dataDirectory = "/public/assets/data/test/";
  exports.routeToData = "/assets/data/test/";
  exports.dbsize = 100;
  exports.debug = true;
})
(typeof exports === 'undefined' ? this['config'] = {} : exports);
