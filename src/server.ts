/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import http from "node:http";
import { type AddressInfo } from "node:net";
import path from "node:path";
import process from "node:process";
import { EventEmitter } from "node:stream";
import WebSocket, { WebSocketServer } from "ws";

// internal imports
import Banner from "./cmd.ts";
import {
	addUser,
	addUserToChannel,
	checkTokenAuth,
	createChannel,
	getChannelById,
	getUserByToken,
} from "./db/db.ts";
import { getUserById, users } from "./db/users.ts";
import { api, com } from "./routes/api.ts";
import { authRouter } from "./routes/auth.ts";
import socketHandler from "./socket.ts";

// check that we're running Node.js 18 or higher
if (Number.parseInt(process.versions.node.split(".")[0]) < 18) {
	const err = new Error(
		"Hammer requires Node.js 18 or higher to run. Please update your Node.js installation."
	);

	console.log(err);

	process.exit(1);
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);
if ("Deno" in window == false) {
	throw new Error("Running in Node.js");
}
dotenv.config();

// Prompt the user for the port from process.argv or default to 8080, also it should be typeof Number
const port = Number.parseInt(process.argv[2]) || 8080;

// Create a new websocket server
const wss = new WebSocketServer({
	port: port,
});
const app = express();

// Allow CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Listen for connections
wss.on(
	"connection",
	(
		ws: WebSocket & { json: (data: unknown) => void } & EventEmitter,
		request: http.IncomingMessage & { url: string }
	) => {
		const url = new URL(request.url, `http://${request.headers.host}`);
		const token = url.searchParams.get("token");

		// Add json helper function
		ws.json = (data: JSON) => {
			ws.send(JSON.stringify(data));
		};

		// Check that token was provided
		if (!token) {
			return ws.close();
		}

		// Check that the connection is an authorized user
		const auth = checkTokenAuth(token);

		// If the connection is not authorized, close the connection
		if (auth) {
			// See if the user is already connected
			const user = getUserByToken(token);

			if (!user) {
				return ws.close();
			}

			// If the user is already connected, close the connection
			if (user.socket) {
				// Log that the user is already connected
				console.log(`User ${user.username} is already connected!`);

				return ws.close();
			}

			// Send authorized notice, requesting IDENTIFY event from client
			ws.json({
				op: 10,
				data: { message: "Authorized" },
				type: "HELLO",
			});
		} else {
			return ws.close();
		}

		let username: string;
		// Get the username from the token
		try {
			type Token = {
				username: string;
				id: string;
				permissions: Record<string, unknown>;
			};

			const decodedToken = jwt.verify(
				token,
				process.env.JWT_SECRET
			) as Token;

			username = decodedToken.username;
		} catch {
			// This should never happen, as the username should always be contained in the token.
			// in the event it does, we'll set the username to "Hackerman" if it fails to verify.
			// if this did happen, the token would have to be created by us, set as the user's token, and then sent to the client.
			username = "Hackerman";
		}

		// Get the user from the database
		const user = getUserByToken(token);

		if (!user) {
			return ws.close();
		}

		// Set the user's token & socket
		user.token = token;
		user.socket = ws;

		console.log(`${username} has joined the server.`);
		// Handshake complete variable
		user.handshakeComplete = false;

		// Handle messages
		ws.on("message", (message: JSON) =>
			socketHandler(message, { ws, user })
		);

		// Handle close, cleans User's socket & token, and removes the handshake complete variable
		ws.on("close", () => {
			console.log(`${username} has left the server.`);

			// Remove the user's socket, if it exists
			user.socket = null;

			// Remove the user's token, if it exists
			user.token = null;

			// Remove the user handshake complete variable
			user.handshakeComplete = false;
		});
	}
);

// Channel join event
com.on("channelJoin", (object) => {
	let { user, channel } = object;

	if (!user.socket) {
		return;
	}

	// Get the channel from the database
	user = getUserById(user);
	channel = getChannelById(channel);

	// Send the channel join message
	user.socket.json({
		op: 0,
		data: {
			channel,
		},
		type: "CHANNEL_JOIN",
	});
});

// Channel leave event
com.on("channelLeave", (object) => {
	const channel = object.channel;
	let { user } = object;

	if (!user.socket) {
		return;
	}

	// Get the channel from the database
	user = getUserById(user);

	// Send the channel join message
	user.socket.json({
		op: 0,
		data: {
			channel: getChannelById(channel),
		},
		type: "CHANNEL_LEAVE",
	});
});

// Update user event
com.on("updateUser", (object) => {
	let { user } = object;

	// Get the user from the database
	user = getUserById(user);

	// For u in users send the updated user object
	for (const u of users) {
		if (u[1].socket) {
			u[1].socket.json({
				op: 0,
				data: {
					user: user,
				},
				type: "UPDATE_USER",
			});
		}
	}
});

// Authentication router
app.use("/auth", authRouter);

// Api router
app.use("/api", api);

// // app router
app.use("/app", express.static(path.join(__dirname, "./app")));

// // login router
app.use("/app/login", express.static(path.join(__dirname, "./app/login.html")));

// set x-powered-by header setting
app.disable("x-powered-by");

// Start the server
const listener = app.listen(port + 1, () => {
	// Print the banner
	Banner();

	// Type of listener.address() is AddressInfo
	const port = listener.address() as AddressInfo;
	const ePort = port.port;

	const wPortT = wss.address() as AddressInfo;
	const wPort: number = wPortT.port;

	// Print the server info
	console.log(`Gateway listening on ws://localhost:${wPort}`);

	console.log("Server API is listening on http://localhost:" + ePort);
});

/*
addUser("admin@disilla.org", "admin", "password", {
	ADMINISTRATOR: true,
	MANAGE_CHANNELS: true,
	MANAGE_MESSAGES: true,
})
	.then((user: User) => {

		console.log("Admin user created.");

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
					.catch((error) => {
						console.log(error);
					});
			})
			.catch((error) => {
				console.log(error);
			});
	})
	.catch((error) => {
		console.log(error);
	});
	*/

(async () => {
	const user = await addUser("admin@disilla.org", "admin", "password", {
		ADMINISTRATOR: true,
		MANAGE_CHANNELS: true,
		MANAGE_MESSAGES: true,
	});

	const name = (await getUserById(user.id)).username;
	if(name == "admin") {
		console.log("Admin user created.");
	}

	const channel = await createChannel(
		{ name: "general", description: "The general channel" },
		user.id
	);

	await addUserToChannel(channel.id, user.id);
	com.emit("channelJoin", { user: user.id, channel: channel.id });

	const nuser = await addUser("me@disilla.org", "chrono", "password", {
		ADMINISTRATOR: false,
		MANAGE_CHANNELS: false,
		MANAGE_MESSAGES: false,
	});

	const name1 = (await getUserById(nuser.id)).username;
	if(name1 == "chrono") {
		console.log("Chrono user created.");
	}

	await addUserToChannel(channel.id, nuser.id);
	com.emit("channelJoin", { user: nuser.id, channel: channel.id });

	console.log("Async/await test complete.");
})();
