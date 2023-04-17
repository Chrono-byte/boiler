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
const { getUserById } = require("./db/users");
const { Banner } = require("./cmd");

// prompt the user for the port
const port = process.argv[2] || 8080;

// internal routers
const auth = require("./routes/auth").router;
const api = require("./routes/api").router;

// create a new websocket server
const wss = new Server({ port: port });
const app = express();

// import com from api
const com = require("./routes/api").communicator;

// import message handler
const { messageHandler } = require("./socket");

// allow CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// listen for connections
wss.on("connection", (ws, req) => {
	var url = new URL(req.url, `http://${req.headers.host}`);
	var token = url.searchParams.get("token");

	// add json helper function
	ws.json = (data) => {
		ws.send(JSON.stringify(data));
	};

	// check that token was provided
	if (!token) {
		return ws.close();
	}

	// check that the connection is an authorized user
	var auth = db.checkTokenAuth(token);

	// if the connection is not authorized, close the connection
	if (auth == false) {
		return ws.close();
	} else {
		// see if the user is already connected
		let user = db.getUserByToken(token);

		// if the user is already connected, close the connection
		if (user.socket) {
			// log that the user is already connected
			console.log(`User ${user.username} is already connected!`);

			return ws.close();
		}

		// send authorized handshake
		ws.json({
			op: 10,
			data: { message: "Authorized" },
			type: "HELLO"
		});
	}

	var username;
	// get the username from the token
	try {
		username = jwt.verify(token, process.env.JWT_SECRET).username;
	} catch (err) {
		// This should never happen, as the username should always be contained in the token.
		// in the event it does, we'll set the username to "Hackerman" if it fails to verify.
		// if this did happen, the token would have to be created by us, set as the user's token, and then sent to the client.
		username = "Hackerman";
	}

	// console.log that we've received a connection
	console.log(`Received connection from ${username}!`);

	// get the user from the database
	let user = db.getUserByToken(token);

	// set the user's token & socket
	user.token = token;
	user.socket = ws;

	console.log(`${username} has joined the server.`);
	// handshake complete variable
	var handshakeComplete = false;

	ws.on("message", message => messageHandler(message, { ws, user, handshakeComplete }, { jwt, db }));

	ws.on("close", () => {
		console.log(`${username} has left the server.`);

		// remove the user's socket, if it exists
		if (user.socket) {
			user.socket = null;
		}

		// remove the user's token, if it exists
		if (user.token) {
			user.token = null;
		}
	});
});

// channel join event
com.on("channelJoin", (obj) => {
	let { user, channel } = obj;

	if(!user.socket) return;

	// get the channel from the database
	user = getUserById(user);
	channel = db.getChannelById(channel);

	// send the channel join message
	user.socket.json(({
		op: 0,
		data: {
			channel: channel,
		},
		type: "CHANNEL_JOIN"
	}));
});

// channel leave event
com.on("channelLeave", (obj) => {
	let { user, channel } = obj;

	if(!user.socket) return;

	// get the channel from the database
	user = db.getUserById(user);

	// send the channel join message
	user.socket.json(({
		op: 0,
		data: {
			channel: db.getChannelById(channel),
		},
		type: "CHANNEL_LEAVE"
	}));
});

// update user event
com.on("updateUser", (obj) => {
	let { user } = obj;

	// get the user from the database
	user = db.getUserById(user);

	if(!user.socket) return;

	// for every connected user, send the updated user
	for (let u of user) {
		if (u.socket) {
			u.socket.json({
				op: 0,
				data: {
					user: user
				},
				type: "USER_UPDATE"
			});
		}
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
		db.addUserToChannel(channel.id, user.id).then(() => {
			com.emit("channelJoin", { user: user.id, channel: channel.id });
		}).catch((err) => {
			console.log(err);
		});
		db.addUser("me@disilla.org", "chrono", "password", {
			ADMINISTRATOR: false,
			MANAGE_CHANNELS: false,
			MANAGE_MESSAGES: false
		}).then((nuser) => {
			db.addUserToChannel(channel.id, nuser.id).catch((err) => {
				console.log(err);
			});
		}).catch((err) => {
			console.log(err);
		});
	}).catch((err) => {
		console.log(err);
	});
}).catch((err) => {
	console.log(err);
});
