"use strict";

var app = require('express')();

var server = require('http').createServer(app);

var bodyParser = require('body-parser');

var cors = require('cors');

var fs = require('fs');

var Canvas = require('canvas');

var path = require('path');

var io = require('socket.io')(server, {
  cors: {
    origin: "*",
    method: ["GET", "POST"]
  }
});

app.use(bodyParser.json({
  limit: '30mb',
  extended: true
}));
app.use(bodyParser.urlencoded({
  limit: '30mb',
  extended: true
}));
app.use(cors());
var PORT = process.env.PORT || 5000;
var users = {};
var socketToRoom = {};
app.get("/", function (req, res) {
  res.send('SERVER is running');
});
io.on('connection', function (socket) {
  socket.emit('me', socket.id);
  socket.on('disconnect', function () {
    socket.broadcast.emit("callended");
    var roomID = socketToRoom[socket.id];
    var room = users[roomID];

    if (room) {
      room = room.filter(function (id) {
        return id !== socket.id;
      });
      users[roomID] = room;
    }
  });
  socket.on('calluser', function (_ref) {
    var userToCall = _ref.userToCall,
        signalData = _ref.signalData,
        from = _ref.from,
        name = _ref.name;
    io.to(userToCall).emit('calluser', {
      signal: signalData,
      from: from,
      name: name
    });
  });
  socket.on('answercall', function (data) {
    io.to(data.to).emit("callaccepted", {
      signal: data.signal,
      name: data.name,
      from: data.from
    });
  });
  socket.on("callNotAccepted", function (data) {
    return io.to(data.from).emit('callNotAccepted', data);
  });
  socket.on("sendvalue", function (data) {
    return io.to(data.to).emit('sendvalue', {
      text: data.value,
      isMe: false
    });
  }); // team settings

  socket.on("joinRoom", function (roomID) {
    if (users[roomID]) {
      var length = users[roomID].length;

      if (length === 6) {
        socket.emit("room full");
        return;
      }

      users[roomID].push(socket.id);
    } else users[roomID] = [socket.id];

    socketToRoom[socket.id] = roomID;
    var usersInThisRoom = users[roomID].filter(function (id) {
      return id !== socket.id;
    });
    socket.emit("all users", usersInThisRoom);
  });
  socket.on("sending signal", function (payload) {
    io.to(payload.userToSignal).emit('user joined', {
      signal: payload.signal,
      callerId: payload.callerId
    });
  });
  socket.on("returning signal", function (payload) {
    io.to(payload.callerId).emit('receiving returned signal', {
      signal: payload.signal,
      id: socket.id
    });
  });
  socket.on("sendMsg", function (_ref2) {
    var to = _ref2.to,
        msg = _ref2.msg;
    return socket.broadcast.to(to).emit("sendMsg", msg);
  });
});
app.post('/add-team', function (req, res) {
  var data = req.body;
  fs.readFile("./teams.json", "utf-8", function _callee(err, jsonString) {
    var json, name;
    return regeneratorRuntime.async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            json = JSON.parse(jsonString);
            name = ""; // img

            if (!data.teamIcon.base64) {
              _context.next = 6;
              break;
            }

            _context.next = 5;
            return regeneratorRuntime.awrap(addIcon("teamsIcons", data.id, data.teamIcon.name, data.teamIcon.base64));

          case 5:
            name = _context.sent;

          case 6:
            if (!data.icon.base64) {
              _context.next = 9;
              break;
            }

            _context.next = 9;
            return regeneratorRuntime.awrap(addIcon("membersIcons", data.id, data.icon.name, data.icon.base64));

          case 9:
            json[data.id] = {
              name: data.teamName,
              icon: data.teamIcon.name ? name : null,
              members: [{
                id: data.id,
                name: data.name,
                icon: data.icon.name ? name : null
              }]
            };
            fs.writeFile('./teams.json', JSON.stringify(json, null, 2), function (err) {
              if (err) {
                console.log(err);
                res.json({
                  err: err,
                  code: "ERROR"
                });
              } else res.json({
                code: "OK"
              });
            });

          case 11:
          case "end":
            return _context.stop();
        }
      }
    });
  });
});
app.get("/teams/:id", function (req, res) {
  var id = req.params.id;
  fs.readFile("./teams.json", "utf-8", function _callee2(err, teams) {
    var team;
    return regeneratorRuntime.async(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            teams = JSON.parse(teams);
            team = teams[id];
            if (team) res.json({
              code: "FOUND",
              members: team.members
            });else res.json({
              code: "NOTFOUND"
            });

          case 3:
          case "end":
            return _context2.stop();
        }
      }
    });
  });
});

var addIcon = function addIcon(file, name, end, icon) {
  var image, canvas, ctx;
  return regeneratorRuntime.async(function addIcon$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          end = end.split(".");
          end = end[end.length - 1];
          _context3.next = 4;
          return regeneratorRuntime.awrap(Canvas.loadImage(icon));

        case 4:
          image = _context3.sent;
          canvas = Canvas.createCanvas(image.width, image.height);
          ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          fs.writeFileSync(path.join(__dirname, file, name), canvas.toBuffer());
          return _context3.abrupt("return", name);

        case 10:
        case "end":
          return _context3.stop();
      }
    }
  });
};

server.listen(PORT, function () {
  return console.log('Server listening on port ' + PORT);
});