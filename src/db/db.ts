/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
// import bcrypt from 'bcrypt';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { v4 as uuidv4 } from 'uuid';

// internal imports
import { Channel, PermissionsObject, User } from "../structures/structures.ts";
import { getUserById, users } from "./users.ts";

// Data structure to store channels
const channels = new Map();

// Get channel by id function
// deno-lint-ignore no-explicit-any
function getChannelById(id: any) {
	for (const channel of channels.values()) {
		if (channel.id == id) {
			return channel;
		}
	}

	return null;
}

// Get channel by name function
function getChannelByName(name: string) {
	for (const channel of channels.values()) {
		if (channel.name == name) {
			return channel;
		}
	}

	return null;
}

// how to set the return type of a function
// https://stackoverflow.com/questions/42701129/how-to-set-the-return-type-of-a-function-in-typescript

// Add user to database, returns a promise<User> ASYNC
async function addUser(
	email: string,
	username: string,
	password: string,
	permissions: PermissionsObject
): Promise<User> {
	// Salt for password
	const salt = await bcrypt.genSalt(10);

	// Create promise
	const promise1 = new Promise((resolve, reject) => {
		// Hash password
		bcrypt
			.hash(password, salt)
			.then((hash: string) => {
				const id = uuidv4();

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
			.catch((error: Error) => {
				if (error) reject(false);
			});
	});

	return promise1 as Promise<User>;
}

// Check password hash to input password
function checkPassword(password: string, hash: string): Promise<boolean> {
	// return is of type Promise<boolean>
	return bcrypt.compare(password, hash);
}

// Function to check user auth
function checkTokenAuth(token: string): boolean {
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

// Create channel function takes in a name and description as object, and the owner's id
function createChannel(
	{ name, description }: { name: string; description: string },
	owner: string
): Promise<Channel> {
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
			.then((user: User) => {
				// Channel object
				const channel = new Channel(
					name,
					description,
					uuidv4(),
					user.Member
				);

				channels.set(channel.id, channel);

				resolve(channel);
			})
			.catch((error: Error) => {
				console.log(error);
				reject("User does not exist");
			});
	});

	return promise1 as Promise<Channel>;
}

// Delete channel function
function deleteChannel(id: string): Promise<string> {
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

	return promise1 as Promise<string>;
}

// Add user to channel function
async function addUserToChannel(id: string, user: string): Promise<string> {
	// Get user from database
	const userN = await getUserById(user).catch((err: Error) => {
		console.log(err);
	});

	if (!userN) {
		return "User does not exist";
	}

	// Promise to return
	const promise1 = new Promise((resolve, reject) => {
		// Check if channel exists
		const channel = getChannelById(id);

		if (channel) {
			// Check if user is in channel
			for (const member of channel.members.values()) {
				if (member.id == userN.id) {
					reject("User is already in channel");
				}
			}

			// Add user to channel
			channel.members.set(userN.id, userN.Member);

			// Add channel to user's channels
			userN.channels.set(channel.id, channel);

			resolve("User added to channel");
		} else {
			reject("Channel does not exist");
		}
	});

	return promise1 as Promise<string>;
}

// Kick user from channel function
function kickUserFromChannel(id: string, user: string): Promise<string> {
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

	return promise1 as Promise<string>;
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

// Export functions as ESM module
export {
	addUser,
	checkPassword,
	checkTokenAuth,
	createChannel,
	deleteChannel,
	getChannelById,
	getChannelByName,
	getUserByToken,
	kickUserFromChannel,
	addUserToChannel,
};
