const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8000 });
console.log("Server started!")

// ADATOK
let clients = {};
let varolista = {};
let nM = 0;
let nS = 0;
let currentpage = 1;
let globalpage = 0;
let currentsong;
let Nhost = 0, Nsheet = 0;

server.on('connection', function (socket) {
    socket.on("message", (message) => {
        message = JSON.parse(message);

        // ÚJ ESZKÖZ
        if (message.type == 'new-device') {
            let clientID = message.deviceName;
            //cast-main
            if (clientID == 'cast-main') {
                nM++;
                clientID += nM;
                Nhost++

                if (Object.keys(clients).some(key => key.includes("cast-main"))) {
                    varolista[clientID] = socket; //várólistához adás
                    socket.send(JSON.stringify({
                        type: 'reserved'
                    }))
                }
                else {
                    clients[clientID] = socket; //hozzáadás a listához
                    currentsong = message.song; //jelenlegi dal
                }
            }
            //cast-sheet
            else {
                nS++;
                clientID += nS;
                Nsheet++
                for (let client of Object.keys(clients)) {
                    if (client.slice(0, -1).includes("cast-main")) {
                        clients[client].send(JSON.stringify({
                            type: 'newSheet' //csatlakozási értesítés
                        }))
                    }
                }

                clients[clientID] = socket; //hozzáadás a listához
            }
            console.log(`[${clientID}] connected (${Object.keys(clients).length + Object.keys(varolista).length} online)`);
        }

        // ÜZENET
        else if (message.type == 'data') {
            console.log(`[${message.device}]:`, message.song, message.tag)
            currentsong = message.song;
            currentpage = message.tag;
            globalpage = message.page;
        }

        // ÜZENET KÜLDÉS
        if (currentsong) {
            for (let client of Object.keys(clients)) {
                if (Object.keys(message).includes('deviceName')) {
                    if (client.slice(0, -1) == "cast-sheet" || clients[client] == socket) {
                        // új eszköz => összes sheet & csatlakozott eszköz
                        clients[client].send(JSON.stringify({
                            type: 'data',
                            song: currentsong,
                            tag: currentpage,
                            page: globalpage,
                            host: Nhost,
                            sheet: Nsheet
                        }));
                    }
                }
                else if (clients[client] != socket) {
                    // host => összes többi eszköz
                    if (client.slice(0, -1) == 'cast-main') {
                        clients[client].send(JSON.stringify({
                            type: 'data',
                            song: currentsong,
                            tag: currentpage,
                            page: globalpage,
                            host: Nhost,
                            sheet: Nsheet
                        }));
                    }
                    else {
                        clients[client].send(JSON.stringify({
                            type: 'data',
                            song: currentsong,
                            tag: currentpage,
                            host: Nhost,
                            sheet: Nsheet
                        }));
                    }
                }
            };
        }
    });

    // Ha egy socket bezárul vagy megszakad, távolítsd el azt a tömbből.
    socket.on('close', function () {
        for (let clientID of Object.keys(clients)) {
            if (clients[clientID] == socket) {
                delete clients[clientID];
                if (clientID.slice(0, -1) == 'cast-main') {
                    Nhost--;
                    if (Object.keys(varolista).length > 0) {
                        let newHost = Object.keys(varolista)[0];
                        clients[newHost] = varolista[newHost];
                        delete varolista[newHost]
                        clients[newHost].send(JSON.stringify({
                            type: 'free'
                        }))
                    }
                }
                else if (clientID.slice(0, -1) == 'cast-sheet') { Nsheet-- }
                console.log(`[${clientID}] disconnected (${Object.keys(clients).length} online)`)
            }

        }

        for (let clientID of Object.keys(varolista)) {
            if (varolista[clientID] == socket) {
                delete varolista[clientID];
                Nhost--
            }
        }

        if (Nhost == 0) {
            for (let client of Object.keys(clients)) {
                clients[client].send(JSON.stringify({
                    type: 'data',
                    song: currentsong,
                    tag: currentpage,
                    host: Nhost,
                    sheet: Nsheet
                }));
            };
        }
        if (Object.keys(clients).length == 0) {
            nM = 0;
            nS = 0;
            currentsong = undefined;
            currentpage = 1;
        }
    });
});
