const app = require('express')()

const server = require('http').createServer(app)
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const Canvas = require('canvas')
const path = require('path')

const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        method: ["GET", "POST"],
    }
})

app.use(bodyParser.json({ limit: '30mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '30mb', extended: true }))
app.use(cors());

const PORT = process.env.PORT || 5000;

const users = {}

const socketToRoom = {}

app.get("/", (req, res) => {
    res.send('SERVER is running');
});

io.on('connection', (socket) => {
    socket.emit('me', socket.id);

    socket.on('disconnect', () => {
        socket.broadcast.emit("callended");

        const roomID = socketToRoom[socket.id];
        let room = users[roomID];
        if (room) {
            room = room.filter(id => id !== socket.id);
            users[roomID] = room;
        }
    })

    socket.on('calluser', ({ userToCall, signalData, from, name }) => {
        io.to(userToCall).emit('calluser', { signal: signalData, from, name })
    })

    socket.on('answercall', (data) => {
        io.to(data.to).emit("callaccepted", { signal: data.signal, name: data.name, from: data.from })
    })

    socket.on("callNotAccepted", data => io.to(data.from).emit('callNotAccepted', data))

    socket.on("sendvalue", data => io.to(data.to).emit('sendvalue', { text: data.value, isMe: false }))

    // team settings
    socket.on("joinRoom", roomID => {
        if (users[roomID]) {
            const length = users[roomID].length;
            if (length === 6) {
                socket.emit("room full");
                return;
            }
            users[roomID].push(socket.id);
        } else users[roomID] = [socket.id];

        socketToRoom[socket.id] = roomID;
        const usersInThisRoom = users[roomID].filter(id => id !== socket.id);

        socket.emit("all users", usersInThisRoom);
    });

    socket.on("sending signal", payload => {
        io.to(payload.userToSignal).emit('user joined', { signal: payload.signal, callerId: payload.callerId });
    });

    socket.on("returning signal", payload => {
        io.to(payload.callerId).emit('receiving returned signal', { signal: payload.signal, id: socket.id });
    });



    socket.on("sendMsg", ({ to, msg }) => socket.broadcast.to(to).emit("sendMsg", msg))
})

app.post('/add-team', (req, res) => {
    const data = req.body

    fs.readFile("./teams.json", "utf-8", async(err, jsonString) => {
        const json = JSON.parse(jsonString)
        var name = ""
            // img
        if (data.teamIcon.base64) name = await addIcon("teamsIcons", data.id, data.teamIcon.name, data.teamIcon.base64)
        if (data.icon.base64) await addIcon("membersIcons", data.id, data.icon.name, data.icon.base64)

        json[data.id] = {
            name: data.teamName,
            icon: data.teamIcon.name ? name : null,
            members: [{
                id: data.id,
                name: data.name,
                icon: data.icon.name ? name : null
            }]
        };

        fs.writeFile('./teams.json', JSON.stringify(json, null, 2), err => {
            if (err) {
                console.log(err)
                res.json({ err, code: "ERROR" })
            } else res.json({ code: "OK" })
        })
    })
})

app.get("/teams/:id", (req, res) => {
    const { id } = req.params
    fs.readFile("./teams.json", "utf-8", async(err, teams) => {
        teams = JSON.parse(teams)
        const team = teams[id]
        if (team) res.json({ code: "FOUND", members: team.members })
        else res.json({ code: "NOTFOUND", })
    })
})

const addIcon = async(file, name, end, icon) => {
    end = end.split(".")
    end = end[end.length - 1]

    const image = await Canvas.loadImage(icon)

    const canvas = Canvas.createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)

    fs.writeFileSync(path.join(__dirname, file, name), canvas.toBuffer())
    return name
}

server.listen(PORT, () => console.log('Server listening on port ' + PORT));