"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Michael G. <chrono@disilla.org>
 */

// servers
const { Server } = require("ws");
const express = require("express");
const cors = require("cors");

// utilities
const path = require("path");
require("dotenv").config();

// import external deps
const jwt = require("jsonwebtoken");
const db = require("./db/dbAPI");
// const  authMW  = require("./auth/auth").auth;

// prompt the user for the port
const port = process.argv[2] || 8080;

// internal routers
const auth = require("./auth/auth").router;
const api = require("./api/api").router;
const { log } = require("console");

// create a new websocket server
const wss = new Server({ port: port });
const app = express();

// import com from api
const com = require("./api/api").communicator;

// allow CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// listen for connections
wss.on("connection", (ws, req) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const token = url.searchParams.get("token");

	// check that token was provided
	if (!token) {
		ws.close();
	}

	// check that the connection is an authorized user
	const auth = db.checkTokenAuth(token);
	let sequence = 0;

	if (auth == false) {
		ws.close();
		return;
	} else {
		// send authorized handshake
		ws.send(JSON.stringify({
			op: 10,
			data: { message: "Authorized" },
			sequence: sequence += 1,
			type: "HELLO"
		}));
	}

	let username;
	// get the username from the token
	try {
		username = jwt.verify(token, process.env.JWT_SECRET).username;
	} catch (err) {
		// set username to "Unknown"
		username = "Unknown";
	}

	// get the user from the database
	const user = db.getUserByToken(token);

	// set the user's token & socket
	user.token = token;
	user.socket = ws;

	// handshake complete variable
	let handshakeComplete = false;

	ws.on("message", (message) => {
		// parse the message
		message = JSON.parse(message);

		// set our sequence count
		sequence += 1;
		user.sequence = sequence;

		// if sequence is not equal to the sequence count, reject the message & close the connection
		if (message.sequence != sequence) {
			// log the error
			log(`Sequence mismatch for ${username}!`);
			log(`Expected ${sequence}, got ${message.sequence}!`);

			// close the connection
			ws.close();
			return;
		}

		// check if the handshake is complete
		if (handshakeComplete == false) {
			// await falken identify payload
			if (message.op == 11 && message.type == "IDENTIFY") {
				// set the heartbeat interval
				setInterval(() => {
					// send the heartbeat
					ws.send(JSON.stringify({
						op: 1,
						data: null,
						sequence: sequence += 1,
						type: "HEARTBEAT"
					}));
				}, message.data.heartbeat_interval);

				// set the handshake complete variable
				handshakeComplete = true;
			}

			// else, close the connection
			else {
				ws.close();
			}
		} else {
			// switch on the op code 0-9, empty blocks
			switch (message.op) {
				case 0:
					// get the channel from the database
					const channel = db.channels.get(message.data.channel);

					channel.sendAll(message.data.message);
					break;
				case 1:
					break;
				case 2:
					break;
				case 3:
					break;
				case 4:
					break;
				case 5:
					break;
				case 6:
					break;
				case 7:
					break;
				case 8:
					break;
				case 9:
					break;
				default:
					break;
			}
		}
	});
});

com.on("channelJoin", (obj) => {
	let { user, channel } = obj;

	// get the channel from the database
	user = db.getUserById(user);

	// send the channel join message
	user.socket.send(JSON.stringify({
		op: 0,
		data: {
			channel: db.getChannelById(channel),
		},
		sequence: user.sequence += 1,
		type: "CHANNEL_JOIN"
	}));
});

// authentication router
app.use("/auth", auth);

// api router
app.use("/api", api);

// app router
app.use("/app", express.static(path.join(__dirname, "./app")));

// login router
app.use("/app/login", express.static(path.join(__dirname, "./app/login.html")));

// log the server version
console.log(`Server Version: ${require("../package.json").version}`);

// start the server
let listener = app.listen(`${new Number(port) + 1}`, function () {
	console.log("Server API is listening on port http://localhost:" + listener.address().port);
});

db.addUser("admin@disilla.org", "admin", "password", {
	ADMINISTRATOR: true,
	MANAGE_CHANNELS: true,
	MANAGE_MESSAGES: true
}).then((user) => {
	db.createChannel({ name: "general", description: "The general channel" }, user.id).then((channel) => { 
		// log the channel
	}).catch((err) => {
		console.log(err);
	});
}).catch((err) => {
	console.log(err);
});

console.log(`Gateway listening on port http://localhost:${wss.address().port}`);