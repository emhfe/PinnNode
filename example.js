var logger = require('./library/notify');

var i = 1;

setInterval(function () {
  logger('Test message', i++);
}, 1000);
