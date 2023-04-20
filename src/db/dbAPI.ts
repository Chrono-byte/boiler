/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import bcrypt from 'bcrypt';

// internal imports
import {
    Channel, PermissionsObject, User
} from '../structures/structures.ts';
import generateSnowflake from '../util/snowflake.ts';
import { getUserById, users } from './users.ts';

// Data structure to store channels
const channels = new Map();

// Get channel by id function
function getChannelById(id) {
	for (const channel of channels.values()) {
		if (channel.id == id) {
			return channel;
		}
	}

	return null;
}

// Get channel by name function
function getChannelByName(name) {
	for (const channel of channels.values()) {
		if (channel.name == name) {
			return channel;
		}
	}

	return null;
}

// Add user to database
function addUser(
	email: string,
	username: string,
	password: string,
	permissions: PermissionsObject
) {
	// Create promise
	const promise1 = new Promise((resolve, reject) => {
		// Hash password
		bcrypt
			.hash(password, 10)
			.then((hash: string) => {
				const id = generateSnowflake();

				// Add user to database
				users.set(
					id,
					new User(
						email,
						username,
						hash,
						{
							ADMINISTRATOR: permissions.ADMINISTRATOR,
							MANAGE_CHANNELS: permissions.MANAGE_CHANNELS,
							MANAGE_MESSAGES: permissions.MANAGE_MESSAGES,
						},
						id
					)
				);

				// Send success
				resolve(users.get(id));
			})
			.catch((error) => {
				// Send error
				// res.status(500).json({ error: "Error adding user to database" });
				console.log(error);
				reject("User does not exist");
			});
	});

	return promise1;
}

// Check password hash to input password
function checkPassword(password, hash) {
	// return is of type Promise<boolean>
	return bcrypt.compare(password, hash);
}

// Function to check user auth
function checkTokenAuth(token) {
	let auth = false;

	// Check that token was provided
	if (!token) {
		return false;
	}

	// Check that the connection is an authorized user
	for (const [, user] of users) {
		if (user.token == token) {
			auth = true;
		}
	}

	if (!auth) {
		return false;
	}

	// Send authorized handshake
	return true;
}

// Create channel function
async function createChannel({ name, description }, owner) {
	// Promise to return
	const promise1 = new Promise((resolve, reject) => {
		// Check if channel exists
		for (const channel of channels.values()) {
			if (channel.name == name) {
				reject("Channel already exists");
			}
		}

		// Get user from database
		getUserById(owner)
			.then((user) => {
				// Channel object
				const channel = new Channel(
					name,
					description,
					generateSnowflake(),
					user.Member
				);

				channels.set(channel.id, channel);

				resolve(channel);
			})
			.catch((error) => {
				console.log(error);
				reject("User does not exist");
			});
	});

	return promise1;
}

// Delete channel function
async function deleteChannel(id) {
	// Promise to return
	const promise1 = new Promise((resolve, reject) => {
		// Check if channel exists
		for (const channel of channels.values()) {
			if (channel.id == id) {
				channels.delete(id);
				resolve("Channel deleted");
			}
		}

		reject("Channel does not exist");
	});

	return promise1;
}

// Add user to channel function
async function addUserToChannel(id, user) {
	// Get user from database
	try {
		user = await getUserById(user);
	} catch (error) {
		console.log(error);
		return;
	}

	// Promise to return
	const promise1 = new Promise((resolve, reject) => {
		// Check if channel exists
		const channel = getChannelById(id);

		if (channel) {
			// Check if user is in channel
			for (const member of channel.members.values()) {
				if (member.id == user.id) {
					reject("User is already in channel");
				}
			}

			// Add user to channel
			channel.members.set(user.id, user.Member);

			// Add channel to user's channels
			user.channels.set(channel.id, channel);

			resolve("User added to channel");
		} else {
			reject("Channel does not exist");
		}
	});

	return promise1;
}

// Kick user from channel function
async function kickUserFromChannel(id, user) {
	// Promise to return
	const promise1 = new Promise((resolve, reject) => {
		// Check if channel exists
		for (const channel of channels.values()) {
			if (channel.id == id) {
				// Check if user is in channel
				for (const member of channel.members.values()) {
					if (member.id == user) {
						channel.members.delete(user);
						resolve("User kicked from channel");
					}
				}

				reject("User is not in channel");
			}

			reject("Channel does not exist");
		}

		reject("Channel does not exist");
	});

	return promise1;
}

// Get user by token function
function getUserByToken(token: string): User | null {
	for (const user of users.values()) {
		if (user.token == token) {
			return user;
		}
	}

	return null;
}

// Export functions as ESM module
export default channels;

export {
	// Export functions
	addUser,
	checkPassword,
	checkTokenAuth,
	createChannel,
	deleteChannel,
	addUserToChannel,
	kickUserFromChannel,
	getUserByToken,
	getChannelById,
	getChannelByName,
};
