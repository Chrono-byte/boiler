"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// data structure to store users
const users = new Map();

// get user by username function
function getUserByEmail(username) {
	const promise1 = new Promise((resolve, reject) => {
		for (let user of users.values()) {
			if (user.email == username) {
				return resolve(user);
			}
		}

		reject("User does not exist");
	});

	return promise1;
}

// get user by id function
function getUserById(id) {
	for (let user of users.values()) {
		if (user.id == id) {
			return user;
		}
	}
	return null;
}

module.exports = { users, getUserByEmail, getUserById };
