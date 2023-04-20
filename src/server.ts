/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// Utilities
import path from "node:path";
import { type AddressInfo } from "node:net";

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { Server } from "ws";
import { EventEmitter } from "node:stream";
import http from "node:http";

// Import external deps
import { getUserById, users } from "./db/users.ts";
import Banner from "./cmd.ts";
import { authRouter } from "./routes/auth.ts";
import { api, com } from "./routes/api.ts";
import {
	addUser,
	addUserToChannel,
	checkTokenAuth,
	createChannel,
	getChannelById,
	getUserByToken,
} from "./db/dbAPI.ts";
import socketHandler from "./socket.ts";
import { type Channel, type User } from "./structures/structures.ts";

// check that we're running Node.js 18 or higher
if (Number.parseInt(process.versions.node.split(".")[0]) < 18) {
	console.log("Error: Hammer requires Node.js 18 or higher!");
	process.exit(1);
}

dotenv.config();

// Prompt the user for the port from process.argv or default to 8080, also it should be typeof Number
const port = Number.parseInt(process.argv[2]) || 8080;

// Create a new websocket server
const wss = new Server({ port });
const app = express();

// Allow CORS
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Listen for connections
wss.on(
	"connection",
	(
		ws: WebSocket & { json: (data: unknown) => void } & EventEmitter,
		request: http.IncomingMessage
	) => {
		const url = new URL(request.url, `http://${request.headers.host}`);
		const token = url.searchParams.get("token");

		// Add json helper function
		ws.json = (data) => {
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

		let username;
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

		// Set the user's token & socket
		user.token = token;
		user.socket = ws;

		console.log(`${username} has joined the server.`);
		// Handshake complete variable
		user.handshakeComplete = false;

		// Handle messages
		ws.on("message", (message) => socketHandler(message, { ws, user }));

		// Handle close, cleans User's socket & token, and removes the handshake complete variable
		ws.on("close", () => {
			console.log(`${username} has left the server.`);

			// Remove the user's socket, if it exists
			if (user.socket) {
				user.socket = null;
			}

			// Remove the user's token, if it exists
			if (user.token) {
				user.token = null;
			}

			// Remove the user handshake complete variable
			if (user.handshakeComplete == true) {
				user.handshakeComplete = false;
			}
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
