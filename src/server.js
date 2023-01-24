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
const { addUser, checkTokenAuth } = require("./db/dbAPI");
// const  authMW  = require("./auth/auth").auth;

// prompt the user for the port
const port = process.argv[2] || 8080;

// internal routers
const auth = require("./auth/auth").router;
const api = require("./api/api");
const { log } = require("console");

// create a new websocket server
const wss = new Server({ port: port });
const app = express();

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
	const auth = checkTokenAuth(token);
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

	// handshake complete variable
	let handshakeComplete = false;

	ws.on("message", (message) => {
		// parse the message
		let Pmessage = JSON.parse(message);

		// set our sequence count
		sequence += 1;

		// if sequence is not equal to the sequence count, reject the message & close the connection
		if (Pmessage.sequence != sequence) {
			// log the error
			log(`Sequence mismatch for ${username}!`);
			log(`Expected ${sequence}, got ${Pmessage.sequence}!`);

			// close the connection
			ws.close();
			return;
		}

		// check if the handshake is complete
		if (handshakeComplete == false) {
			// await falken identify payload
			if (Pmessage.op == 11 && Pmessage.type == "IDENTIFY") {
				// set the heartbeat interval
				setInterval(() => {
					// send the heartbeat
					ws.send(JSON.stringify({
						op: 1,
						data: null,
						sequence: sequence+=1,
						type: "HEARTBEAT"
					}));
				}, Pmessage.data.heartbeat_interval);

				// set the handshake complete variable
				handshakeComplete = true;
			}

			// else, close the connection
			else {
				ws.close();
			}
		} else {
			// switch on the op code 0-9, empty blocks
			switch (Pmessage.op) {
				case 0:
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

		// console.log(`Received message ${} from user ${username}`);
		// console.log(Pmessage);
	});
});

// authentication router
app.use("/auth", auth);

// api router
app.use("/api/v3", api);
app.use("/api", api);

// app router
app.use("/app", express.static(path.join(__dirname, "./app")));

// login router
app.use("/app/login", express.static(path.join(__dirname, "./app/login.html")));

// log the server version
console.log(`Server Version: ${require("../package.json").version}`);
// start the server
let listener = app.listen(`${new Number(port) + 1}`, function () {
	console.log("Server Functions API is listening on port http://localhost:" + listener.address().port);

	addUser("admin@disilla.org", "admin", "password").then(() => {
		console.log("Admin user created!");
	}).catch((err) => {
		console.log(err);
	});
});

console.log(`Server listening on port http://localhost:${wss.address().port}`);