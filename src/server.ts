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
import { Server } from "ws";
import express from "express";
import cors from "cors";

// utilities
import path from "path";

// dotenv
import dotenv from "dotenv";
dotenv.config();

// import external deps
import jwt from "jsonwebtoken";

import { addUserToChannel, addUser, createChannel } from "./db/dbAPI";

import { getUserById, users } from "./db/users";
import Banner from "./cmd";

// prompt the user for the port from process.argv or default to 8080, also it should be typeof Number
const port = parseInt(process.argv[2]) || 8080;

// internal routers & event handlers
import { auth } from "./routes/auth";
import { api, com } from "./routes/api";

// import database helpers
import { checkTokenAuth, getUserByToken, getChannelById } from "./db/dbAPI";

// create a new websocket server
const wss = new Server({ port: port });
const app = express();

// import message handler
import socketHandler from "./socket";
import { Channel, User } from "./structures/structures";
import { AddressInfo } from "net";

// allow CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// listen for connections
wss.on("connection", (ws: any, req: any) => {
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
	var auth = checkTokenAuth(token);

	// if the connection is not authorized, close the connection
	if (auth == false) {
		return ws.close();
	} else {
		// see if the user is already connected
		let user = getUserByToken(token);

		// if the user is already connected, close the connection
		if (user.socket) {
			// log that the user is already connected
			console.log(`User ${user.username} is already connected!`);

			return ws.close();
		}

		// send authorized notice, requesting IDENTIFY event from client
		ws.json({
			op: 10,
			data: { message: "Authorized" },
			type: "HELLO",
		});
	}

	var username;
	// get the username from the token
	try {
		interface Token {
			username: string;
			id: string;
			permissions: object;
		}

		var decodedToken = jwt.verify(token, process.env.JWT_SECRET) as Token;

		username = decodedToken.username;
	} catch (err) {
		// This should never happen, as the username should always be contained in the token.
		// in the event it does, we'll set the username to "Hackerman" if it fails to verify.
		// if this did happen, the token would have to be created by us, set as the user's token, and then sent to the client.
		username = "Hackerman";
	}

	// get the user from the database
	let user = getUserByToken(token);

	// set the user's token & socket
	user.token = token;
	user.socket = ws;

	console.log(`${username} has joined the server.`);
	// handshake complete variable
	var handshakeComplete = false;

	ws.on("message", (message: any) =>
		socketHandler(message, { ws, user, handshakeComplete })
	);

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

	if (!user.socket) return;

	// get the channel from the database
	user = getUserById(user);
	channel = getChannelById(channel);

	// send the channel join message
	user.socket.json({
		op: 0,
		data: {
			channel: channel,
		},
		type: "CHANNEL_JOIN",
	});
});

// channel leave event
com.on("channelLeave", (obj) => {
	let { user, channel } = obj;

	if (!user.socket) return;

	// get the channel from the database
	user = getUserById(user);

	// send the channel join message
	user.socket.json({
		op: 0,
		data: {
			channel: getChannelById(channel),
		},
		type: "CHANNEL_LEAVE",
	});
});

// update user event
com.on("updateUser", (obj) => {
	let { user } = obj;

	// get the user from the database
	user = getUserById(user);

	// for u in users send the updated user object
	for (let u of users) {
		if (u[1].socket) {
			u[1].socket.json({
				op: 0,
				data: {
					user: u,
				},
				type: "UPDATE_USER",
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
let listener = app.listen(port + 1, function () {
	// print the banner
	Banner();

	// print the server info
	console.log(
		`Gateway listening on port http://localhost:${wss.address().port}`
	);

	// type of listener.address() is AddressInfo
	var port = listener.address() as AddressInfo;
	var ePort = port.port;

	console.log("Server API is listening on port http://localhost:" + ePort);
});

addUser("admin@disilla.org", "admin", "password", {
	ADMINISTRATOR: true,
	MANAGE_CHANNELS: true,
	MANAGE_MESSAGES: true,
})
	.then((user: User) => {
		createChannel(
			{ name: "general", description: "The general channel" },
			user.id
		)
			.then((channel: Channel) => {
				addUserToChannel(channel.id, user.id);
				com.emit("channelJoin", { user: user.id, channel: channel.id });
				addUser("me@disilla.org", "chrono", "password", {
					ADMINISTRATOR: false,
					MANAGE_CHANNELS: false,
					MANAGE_MESSAGES: false,
				})
					.then((nuser: User) => {
						addUserToChannel(channel.id, nuser.id);
					})
					.catch((err) => {
						console.log(err);
					});
			})
			.catch((err) => {
				console.log(err);
			});
	})
	.catch((err) => {
		console.log(err);
	});
