
import { io } from "socket.io-client";

const ROOM_ID = "TEST_ROOM";
const SERVER_URL = "http://localhost:3000";
const BOT_COUNT = 9;
const AVATARS = ["👽", "🤖", "👨‍🚀", "👾", "🛸", "👻", "🧟", "🧛", "🧙"];

console.log(`🚀 Launching ${BOT_COUNT} bots to join room ${ROOM_ID}...`);

for (let i = 0; i < BOT_COUNT; i++) {
    const socket = io(SERVER_URL);
    const name = `Bot ${i + 1}`;
    const avatar = AVATARS[i % AVATARS.length];

    socket.on("connect", () => {
        console.log(`✅ ${name} connected`);
        socket.emit("join_room_v2", {
            roomId: ROOM_ID,
            userName: name,
            avatar: avatar,
            isCreator: false
        });
    });

    socket.on("room_state", (room) => {
        // Vote if voting is active and we haven't voted yet
        if (room.status === "voting" && !room.votes[socket.id]) {
            const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4s delay
            const deck = room.deck || ["1", "2", "3", "5", "8", "13"];
            const vote = deck[Math.floor(Math.random() * deck.length)];

            console.log(`⏳ ${name} thinking...`);
            setTimeout(() => {
                console.log(`🗳️ ${name} voting ${vote}`);
                socket.emit("vote", { roomId: ROOM_ID, value: vote });
            }, delay);
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ ${name} disconnected`);
    });
}
