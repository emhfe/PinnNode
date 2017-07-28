(function (io) {
  $(document).ready(function () {
    var socket = io.connect();

    socket.on('server:log', function (message) {
      var output = $('div#log > pre');

      output.append(message + '\n');
      output.animate({ scrollTop: output.prop('scrollHeight') }, 1000);
    });
  });
})(window.io);
