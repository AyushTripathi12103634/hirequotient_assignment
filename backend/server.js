import express from "express";
import http from "http";
import cors from 'cors';
import { Server } from 'socket.io';

import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: 'localhost',
    port: 5500,
    user: 'postgres',
    password: 'root',
    database: 'chatroom',
});

client.connect(err => {
    if (err) {
        console.error('connection error', err.stack)
    } else {
        console.log('Connected to Database')
    }
});

await client.query(`
  CREATE TABLE IF NOT EXISTS ROOMS(
    RoomID VARCHAR(12) UNIQUE,
    Participants TEXT[],
    messages JSON[]
  );
`);

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

const server = http.createServer(app);
const io = new Server(server,
    {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }
    }
);

app.get("/rooms/:username", async (req, res) => {
    const { username } = req.params
    const result = await client.query("SELECT * FROM ROOMS WHERE $1 = ANY(Participants)", [username]);
    return res.status(200).send({
        rooms: result.rows // send only the rows, not the entire result
    });
});

app.post("/setroom/:username", async (req, res) => {
    const { username } = req.params;
    const generateRandomString = (length) => {
        const characters = 'abcdefghijklmnopqrstuvwxyz';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };

    const roomId = `${generateRandomString(3)}-${generateRandomString(3)}-${generateRandomString(3)}`;

    await client.query("INSERT INTO ROOMS VALUES($1,ARRAY[$2])", [roomId, username]);

    return res.status(200).send({
        room: roomId
    })
});

let socketToUsername = {};

io.on('connection', (socket) => {
    socket.on('join room', async (roomId, username) => {
        socket.join(roomId);
        socketToUsername[socket.id] = username;
        const room = await client.query("SELECT * FROM ROOMS WHERE RoomID = $1", [roomId]);
        if (!room.rows.length) {
            await client.query("INSERT INTO ROOMS(RoomID, Participants, messages) VALUES($1, ARRAY[$2::TEXT], ARRAY[]::JSON[])", [roomId, username]);
        } else {
            if (room.rows[0]) {
                if (!room.rows[0].participants.includes(username)) {
                    await client.query("UPDATE ROOMS SET Participants = array_append(Participants, $1) WHERE RoomID = $2", [username, roomId]);
                }
                socket.emit('old messages', room.rows[0].messages);
            }
        }
    });

    socket.on('send message', async (roomId, message) => {
        const msg = { user: socketToUsername[socket.id], text: message, timestamp: new Date() };
        await client.query("UPDATE ROOMS SET messages = array_append(messages, $1::JSON) WHERE RoomID = $2", [JSON.stringify(msg), roomId]);
        io.to(roomId).emit('new message', msg);
    });

    socket.on('disconnect', async () => {
        delete socketToUsername[socket.id];
        const allRooms = await client.query("SELECT * FROM ROOMS");
        allRooms.rows.forEach(async (room) => {
            if (room && room.Participants && room.Participants.includes(socket.id)) {
                const updatedParticipants = room.Participants.filter(participant => participant !== socket.id);
                await client.query("UPDATE ROOMS SET Participants = $1 WHERE RoomID = $2", [updatedParticipants, room.RoomID]);
                io.to(room.RoomID).emit('update users', updatedParticipants);
            }
        });
    });
});

server.listen(5000, () => console.log('server is running on port 3000'));
