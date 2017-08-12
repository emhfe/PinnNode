var express = require('express');
var http = require('http');
var path = require('path');

var app = express();
var server = http.Server(app);

var io = require('socket.io').listen(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', function (socket) {
  if (socket.handshake.headers['user-agent'] !== 'node-XMLHttpRequest') {
    socket.join('subscribers');
  }

  socket.on('server:log', function (message) {
    io.to('subscribers').emit('server:log', message);
  });
});

run = function () {
  server.listen(3000, function () {
    console.log('Express server listening on port', 3000);
  });
};

if (require.main === module) {
  run();
}
