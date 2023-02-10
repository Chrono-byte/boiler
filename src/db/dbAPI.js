"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// import internal deps
const { generateSnowflake } = require("../util/snowflake");

// import external deps
const bcrypt = require("bcrypt");

// import internal deps
const { User, Channel } = require("../structures/structures");

const { users, getUserById } = require("./users");

// data structure to store channels
const channels = new Map();

// get channel by id function
function getChannelById(id) {
	for (let channel of channels.values()) {
		if (channel.id == id) {
			return channel;
		}
	}
	return null;
}

// get channel by name function
function getChannelByName(name) {
	for (let channel of channels.values()) {
		if (channel.name == name) {
			return channel;
		}
	}
	return null;
}

// add user to database
function addUser(email, username, password, permissions) {
	// create promise
	const promise1 = new Promise((resolve, reject) => {
		// hash password
		bcrypt.hash(password, 10).then((hash) => {
			let id = generateSnowflake();

			// add user to database
			users.set(id, new User(email, username, hash, {
				ADMINISTRATOR: permissions.ADMINISTRATOR,
				MANAGE_CHANNELS: permissions.MANAGE_CHANNELS,
				MANAGE_MESSAGES: permissions.MANAGE_MESSAGES
			}, id));

			// send success
			resolve(users.get(id));
		}).catch((err) => {
			// send error
			// res.status(500).json({ error: "Error adding user to database" });
			console.log(err);
			reject("User does not exist");
		});
	});

	return promise1;
}

// check password hash to input password
function checkPassword(password, hash) {
	return bcrypt.compare(password, hash);
}

// function to check user auth
function checkTokenAuth(token) {
	let auth = false;

	// check that token was provided
	if (!token) {
		return false;
	}

	// check that the connection is an authorized user
	users.forEach((user) => {
		if (user.token == token) {
			auth = true;
		}
	});

	if (auth == false) {
		return false;
	} else {
		// send authorized handshake
		return true;
	}
}

// create channel function
function createChannel({ name, description }, owner) {
	// promise to return
	const promise1 = new Promise((resolve, reject) => {
		// check if channel exists
		for (let channel of channels.values()) {
			if (channel.name == name) {
				reject("Channel already exists");
			}
		}

		// get user from database
		let user = getUserById(owner).Member;

		// channel object
		let channel = new Channel(name, description, generateSnowflake(), user);

		channels.set(channel.id, channel);

		resolve(channel);
	});

	return promise1;
}

// delete channel function
function deleteChannel(id) {
	// promise to return
	const promise1 = new Promise((resolve, reject) => {
		// check if channel exists
		for (let channel of channels.values()) {
			if (channel.id == id) {
				channels.delete(id);
				resolve("Channel deleted");
			}
		}

		reject("Channel does not exist");
	});

	return promise1;
}

// add user to channel function
function addUserToChannel(id, user) {
	// get user from database
	try {
		user = getUserById(user);
	} catch (err) {
		return console.log(err);
	}

	// promise to return
	const promise1 = new Promise((resolve, reject) => {
		// check if channel exists
		let channel = getChannelById(id);

		if (channel) {
			// check if user is in channel
			for (let member of channel.members.values()) {
				if (member.id == user.id) {
					reject("User is already in channel");
				}
			}

			// add user to channel
			channel.members.set(user.id, user.Member);

			// add channel to user's channels
			user.channels.set(channel.id, channel);

			resolve("User added to channel");
		} else {
			reject("Channel does not exist");
		}
	});

	return promise1;
}

// kick user from channel function
function kickUserFromChannel(id, user) {
	// promise to return
	const promise1 = new Promise((resolve, reject) => {
		// check if channel exists
		for (let channel of channels.values()) {
			if (channel.id == id) {
				// check if user is in channel
				for (let member of channel.members.values()) {
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

// get user by token function
function getUserByToken(token) {
	for (let user of users.values()) {
		if (user.token == token) {
			return user;
		}
	}
	return null;
}

module.exports = { addUser, checkPassword, checkTokenAuth, createChannel, deleteChannel, getChannelById, getChannelByName, getUserByToken, kickUserFromChannel, addUserToChannel, channels };
