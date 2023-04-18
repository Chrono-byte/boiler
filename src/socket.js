const { Message } = require("./structures/structures");
const db = require("./db/dbAPI");
const { users } = require("./db/users");

const jwt = require("jsonwebtoken");

function socketHandler(message, context) {
	var { ws, user, handshakeComplete } = context;
	var { username } = user;
	// check if the message is valid, if not, return.
	if (!message) return;

	try {
		// try to parse the message
		message = JSON.parse(message);
	} catch (err) {
		// if the message fails to parse, close the connection
		console.log(`${username} sent invalid JSON, closing connection.`);

		// log the "message"
		console.log(message);

		// send the error control command to the client
		ws.json({
			op: 9,
			data: {
				message: "You've sent invalid JSON!",
			},
			type: "ERROR",
		});

		// close the connection
		return ws.close();
	}

	// check if the handshake is complete
	if (!handshakeComplete) {
		// await identify payload
		if (message.op == 11 && message.type == "IDENTIFY") {
			if (message.data.token) {
				// check that the token is valid
				if (!db.checkTokenAuth(message.data.token)) {
					console.log(
						`Rejected improper handshake from ${username}!`
					);

					// close the connection
					return ws.close();
				}

				// get the username from the token
				try {
					username = jwt.verify(
						message.data.token,
						process.env.JWT_SECRET
					).username;
				} catch (err) {
					// set username to "Unknown"
					username = "Unknown";
				}
			}

			var channels = new Map();
			// how to iterate over a map
			for (let [, channel] of db.channels) {
				// check if the user is in the channel
				if (channel.members.has(user.id)) {
					// add it to our channels map
					channels.set(channel.id, {
						name: channel.name,
						id: channel.id,
						description: channel.description,
						owner: channel.owner,
					});
				} else return;
			}

			var usersTo = new Map();

			// iterate over the users
			for (let [, user] of users) {
				// add it to our users map
				usersTo.set(user.id, {
					username: user.username,
					id: user.id,
					avatar: user.avatar,
					permissions: user.permissions,
				});
			}

			// convert our map to an array of only the values
			channels = Array.from(channels.values());
			usersTo = Array.from(usersTo.values());

			// send the identify ack
			ws.json({
				op: 12,
				data: {
					channels: JSON.stringify(channels),
					users: JSON.stringify(usersTo)
				},
				type: "READY",
			});

			// set handshake complete to true
			handshakeComplete = true;

			// log that we've accepted the handshake
			console.log(handshakeComplete);
			return;
		}
		// else, close the connection
		else {
			// log that we're rejecting an improper handshake
			console.log(`Rejected message from ${username} as handshake was incomplete!`);

			// send the error control command to the client
			ws.json({
				op: 9,
				data: {
					message: "You've sent a message before identifying!",
				},
				type: "ERROR",
			});

			// close the connection
			return ws.close();
		}
	} else if (handshakeComplete) {
		// handle heartbeat
		if (message.op == 11 && message.type == "HEARTBEAT_ACK") {
			// we don't need to do anything here, the client is just acknowledging the heartbeat
			return;
		}

		// check if it's a non-zero opcode
		if (message.op == 0) {
			// verify that channel is provided
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

			// verify that the channel exists
			if (!db.channels.has(message.data.channel)) {
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

			// verify that the user is actually in the channel requested
			if (!db.channels.get(message.data.channel).members.has(user.id)) {
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

		// update current sock channel
		var channel = db.channels.get(message.data.channel);

		// switch on the op code 0-9, empty blocks
		switch (message.op) {
			case 0: // message
				// check if the message is empty
				if (message.data.message == "") {
					// return send error that the message is empty
					return ws.json({
						op: 9,
						data: {
							message: "You can't send an empty message!",
						},
						type: "ERROR",
					});
				}

				// construct the message
				var msg = new Message(
					message.data.content,
					user.id,
					db.channels.get(message.data.channel)
				);

				// send message
				channel.sendAll(msg);
				break;
			case 1: // update user status / activity
				// verify that the status is valid
				if (message.data.status < 0 || message.data.status > 4) {
					ws.json({
						op: 9,
						data: {
							message: "Invalid status!",
						},
						type: "ERROR",
					});
					return;
				}
				break;
			case 9: // client thinks we had an error
				console.error(`Client ${username} thinks we had an error!`);
				break;
			default:
				console.error(`Client ${username} sent an invalid op code!`);
				break;
		}
	}
}

module.exports = { messageHandler: socketHandler };
