#!/usr/bin/env node
"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// check that we're running Node.js 18 or higher
if (parseInt(process.versions.node.split(".")[0]) < 18) {
	console.log("Error: Hammer requires Node.js 18 or higher!");
	process.exit(1);
}

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
const { getUserById, users } = require("./db/users");
const { Banner } = require("./cmd");

// prompt the user for the port
const port = process.argv[2] || 8080;

// internal routers
const auth = require("./auth/auth").router;
const api = require("./api/api").router;

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
	ws.json = (data) => {
		ws.send(JSON.stringify(data));
	}

	// check that token was provided
	if (!token) {
		ws.close();
	}

	// check that the connection is an authorized user
	const auth = db.checkTokenAuth(token);
	let sequence = 0;

	// if the connection is not authorized, close the connection
	if (auth == false) {
		return ws.close();
	} else {
		// send authorized handshake
		ws.json({
			op: 10,
			data: { message: "Authorized" },
			sequence: sequence += 1,
			type: "HELLO"
		});
	}

	let username;
	// get the username from the token
	try {
		username = jwt.verify(token, process.env.JWT_SECRET).username;
	} catch (err) {
		// set username to "Unknown"
		username = "Unknown";
	}

	// console.log that we've received a connection
	console.log(`Received connection from ${username}!`);

	// get the user from the database
	const user = db.getUserByToken(token);

	// set the user's token & socket
	user.token = token;
	user.socket = ws;

	console.log(`User ${username} has joined the server!`);
	// handshake complete variable
	let handshakeComplete = false;

	ws.on("message", (message) => {
		// try to parse the message, if it fails, close the connection
		try {
			// parse the message
			message = JSON.parse(message);
		} catch (err) {
			// console.log the error
			console.log(`Error parsing message from ${username}!`);
			console.log(err);

			// close the connection
			ws.close();
			return;
		}

		// set our sequence count
		sequence += 1;
		user.sequence = sequence;

		// if sequence is not equal to the sequence count, reject the message & close the connection
		if (message.sequence != sequence) {
			// console.log the error
			console.log(`Sequence mismatch for ${username}!`);
			console.log(`Expected ${sequence}, got ${message.sequence}!`);

			// close the connection
			ws.close();
			return;
		}

		// check if the handshake is complete
		if (!handshakeComplete) {
			// await falken identify payload
			if (message.op == 11 && message.type == "IDENTIFY") {
				// set the heartbeat interval
				setInterval(() => {
					// send the heartbeat
					ws.json(({
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
		} else if (handshakeComplete) {
			// handle heartbeat
			if (message.op == 11 && message.type == "HEARTBEAT_ACK") {
				// we don't need to do anything here, the client is just acknowledging the heartbeat
				// we probably should do some logic here idk
				// return to prevent further processing
				return;
			}

			// verify that channel is provided
			if (!message.data.channel) {
				console.log(`${username} requested to join a channel but didn't provide one!`);
				ws.json(({
					op: 9,
					data: {
						message: "You've sent a message without a channel!"
					},
					sequence: sequence += 1,
					type: "ERROR"
				}));
				return;
			}

			// verify that the channel exists
			if (!db.channels.has(message.data.channel)) {
				console.log(`${username} requested non-existant channel does not exist!`);
				ws.json(({
					op: 9,
					data: {
						message: "That channel does not exist!"
					},
					sequence: sequence += 1,
					type: "ERROR"
				}));
				return;
			}

			// verify that the user is actually in the channel requested
			if (!db.channels.get(message.data.channel).users.includes(user.id)) {
				ws.json(({
					op: 9,
					data: {
						message: "You are not in that channel!"
					},
					sequence: sequence += 1,
					type: "ERROR"
				}));
				return;
			}

			// update current sock channel
			channel = db.channels.get(message.data.channel);

			// switch on the op code 0-9, empty blocks
			switch (message.op) {
				case 0:
					// send message
					console.log(`${username} sent a message in ${channel.name}!`);
					// channel.sendAll(message.data.message);
					break;
				case 1:
					// update user status / activity

					// verify that the status is valid
					if (message.data.status < 0 || message.data.status > 4) {
						ws.json(({
							op: 9,
							data: {
								message: "Invalid status!"
							},
							sequence: sequence += 1,
							type: "ERROR"
						}));
						return;
					}
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

	ws.on("close", () => {
		// remove the user's socket, if it exists
		if (user.socket) {
			user.socket = null;
		}

		// remove the user's token, if it exists
		if (user.token) {
			user.token = null;
		}

		// remove the user's sequence, if it exists
		if (user.sequence) {
			user.sequence = null;
		}
	});
});

// channel join event
com.on("channelJoin", (obj) => {
	let { user, channel } = obj;

	// get the channel from the database
	user = getUserById(user);

	// send the channel join message
	user.socket.json(({
		op: 0,
		data: {
			channel: db.getChannelById(channel),
		},
		sequence: user.sequence += 1,
		type: "CHANNEL_JOIN"
	}));
});

// channel leave event
com.on("channelLeave", (obj) => {
	let { user, channel } = obj;

	// get the channel from the database
	user = db.getUserById(user);

	// send the channel join message
	user.socket.json(({
		op: 0,
		data: {
			channel: db.getChannelById(channel),
		},
		sequence: user.sequence += 1,
		type: "CHANNEL_LEAVE"
	}));
});

// update user event
com.on("updateUser", (obj) => {
	let { user } = obj;

	// get the user from the database
	user = db.getUserById(user);

	// find every channel the user is in
	for (let channel of user.channels) { 
		// log channel name
		console.log(channel.name);
	}
});

// authentication router
app.use("/auth", auth);

// api router
app.use("/api", api);

// // app router
app.use("/app", express.static(path.join(__dirname, "./app")));

// // login router
app.use("/app/login", express.static(path.join(__dirname, "./app/login.html")));

// start the server
let listener = app.listen(`${new Number(port) + 1}`, function () {
	Banner();

	console.log(`Gateway listening on port http://localhost:${wss.address().port}`);
	console.log("Server API is listening on port http://localhost:" + listener.address().port);
});

db.addUser("admin@disilla.org", "admin", "password", {
	ADMINISTRATOR: true,
	MANAGE_CHANNELS: true,
	MANAGE_MESSAGES: true
}).then((user) => {
	db.createChannel({ name: "general", description: "The general channel" }, user.id).then((channel) => {
		db.addUserToChannel(channel.id, user.id).catch((err) => {
			console.log(err);
		});

		console.log(users.get(user.id).channels);
	}).catch((err) => {
		console.log(err);
	});
}).catch((err) => {
	console.log(err);
});