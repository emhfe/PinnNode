var util = require('util');

var socket = require('./socket');

var debug = require('debug')('pinn');

module.exports = function () {
  var message = util.format.apply(util, arguments);

  socket.emit('server:log', message);
  debug(message);
};
