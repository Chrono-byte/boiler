/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';

// internal imports
import channels, {
    checkTokenAuth
} from './db/dbAPI.ts';
import { users } from './db/users.ts';
import {
    Message, User
} from './structures/structures.ts';

function socketHandler(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	message: any,
	context: { user: User; ws: WebSocket & { json: (data: unknown) => void } }
) {
	const user = context.user as User;
	const ws = context.ws as WebSocket & { json: (data: unknown) => void };
	let { username } = user;
	// Check if the message is valid, if not, return.
	if (!message) {
		return;
	}

	try {
		// Try to parse the message as JSON
		message = JSON.parse(message) as { type: string; op: number };
	} catch {
		// If the message fails to parse, close the connection
		console.log(`${username} sent invalid JSON, closing connection.`);

		// Log the "message"
		console.log(message);

		// Send the error control command to the client
		ws.json({
			op: 9,
			data: {
				message: "You've sent invalid JSON!",
			},
			type: "ERROR",
		});

		// Close the connection
		return ws.close();
	}

	// eslint-disable-next-line prefer-const
	let channel = channels.get(message.data.channel);

	// Check if the handshake is complete
	switch (user.handshakeComplete) {
		case false:
			// Await identify payload
			if (message.type == "IDENTIFY" && message.op == 11) {
				if (message.data.token) {
					// Check that the token is valid
					if (!checkTokenAuth(message.data.token)) {
						console.log(
							`Rejected improper handshake from ${username}!`
						);

						// Close the connection
						return ws.close();
					}

					// Get the username from the token
					try {
						type Token = {
							username: string;
							id: string;
							permissions: Record<string, unknown>;
						};

						const decodedToken = jwt.verify(
							message.data.token,
							process.env.JWT_SECRET
						) as Token;

						username = decodedToken.username;
					} catch {
						// Set username to "Unknown"
						username = "Unknown";
					}
				}

				const channelsL = new Map();
				// How to iterate over a map
				for (const [, channel] of channels) {
					// Check if the user is in the channel
					if (channel.members.has(user.id)) {
						// Add it to our channels map
						channelsL.set(channel.id, {
							name: channel.name,
							id: channel.id,
							description: channel.description,
							owner: channel.owner,
						});
					} else {
						return;
					}
				}

				const usersTo = new Map();

				// Iterate over the users
				for (const [, user] of users) {
					// Add it to our users map
					usersTo.set(user.id, {
						username: user.username,
						id: user.id,
						avatarURL: user.avatarURL,
						permissions: user.permissions,
					});
				}

				// Convert our map to an array of only the values, also change the map to an array
				const channelsO = Array.from(channelsL.values());
				const usersToO = Array.from(usersTo.values());

				// Send the identify ack
				ws.json({
					op: 12,
					data: {
						channels: JSON.stringify(channelsO),
						users: JSON.stringify(usersToO),
					},
					type: "READY",
				});

				// Set handshake complete to true
				user.handshakeComplete = true;
			}
			// Else, close the connection
			else {
				// Log that we're rejecting an improper handshake
				console.log(
					`Rejected message from ${username} as handshake was incomplete!`
				);

				// Send the error control command to the client
				ws.json({
					op: 9,
					data: {
						message: "You've sent a message before identifying!",
					},
					type: "ERROR",
				});

				// Close the connection
				return ws.close();
			}
			break;
		case true:
			// Handle heartbeat
			if (message.op == 11 && message.type == "HEARTBEAT_ACK") {
				// We don't need to do anything here, the client is just acknowledging the heartbeat
				return;
			}

			// Check if it's a non-zero opcode
			if (message.op == 0) {
				// Verify that channel is provided
				if (!message.data.channel) {
					console.log(
						`${username} requested to join a channel but didn't provide one!`
					);

					ws.json({
						op: 9,
						data: {
							message: "You've sent a message without a channel!",
						},
						type: "ERROR",
					});
					return;
				}

				// Verify that the channel exists
				if (!channels.has(message.data.channel)) {
					console.log(`${username} requested non-existant channel!`);

					ws.json({
						op: 9,
						data: {
							message: "That channel does not exist!",
						},
						type: "ERROR",
					});
					return;
				}

				// Verify that the user is actually in the channel requested
				if (!channels.get(message.data.channel).members.has(user.id)) {
					console.log(
						`${username} requested to join a channel they're not in!`
					);

					return ws.json({
						op: 9,
						data: {
							message: "You are not in that channel!",
						},
						type: "ERROR",
					});
				}
			}

			// Switch on the op code 0-9, empty blocks
			switch (message.op) {
				case 0: {
					// Message
					// check if the message is empty
					if (message.data.message == "") {
						// Return send error that the message is empty
						return ws.json({
							op: 9,
							data: {
								message: "You can't send an empty message!",
							},
							type: "ERROR",
						});
					}

					// Construct the message
					const message_ = new Message(
						message.data.content,
						user.id,
						channels.get(message.data.channel)
					);

					// Send message
					channel.sendAll(message_);
					break;
				}

				case 1: {
					// Update user status / activity
					// verify that the status is valid
					if (message.data.status < 0 || message.data.status > 4) {
						ws.json({
							op: 9,
							data: {
								message: "Invalid status!",
							},
							type: "ERROR",
						});
					}

					break;
				}

				case 9: {
					// Client thinks we had an error
					console.error(`Client ${username} thinks we had an error!`);
					break;
				}

				default: {
					console.error(
						`Client ${username} sent an invalid op code!`
					);
					console.error(message);
					break;
				}
			}
			break;
	}
}

export default socketHandler;
