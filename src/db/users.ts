/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

import { type User } from "../structures/structures.ts";

// Users, Map<string, User>
const users = new Map<string, User>();

// Get user by username function, returns a User object, or null if user does not exist
function getUserByEmail(email: string): Promise<User> {
	const promise1 = new Promise((resolve, reject) => {
		for (const [, user] of users) {
			if (user.email == email) {
				resolve(user);
				return;
			}
		}

		reject("User does not exist");
	});

	return promise1 as Promise<User>;
}

// Get user by id function, returns a User object
function getUserById(id: string): Promise<User> {
	const promise1 = new Promise((resolve, reject) => {
		for (const [, user] of users) {
			if (user.id == id) {
				resolve(user);
				return;
			}
		}

		reject("User does not exist");
	});

	return promise1 as Promise<User>;
}

export { users, getUserByEmail, getUserById };
