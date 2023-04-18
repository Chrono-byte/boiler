"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// net-related modules
import express from "express";

// dotenv
import dotenv from "dotenv";
dotenv.config();

// import internal deps
import { addUser, checkPassword, checkTokenAuth, getUserByToken } from "../db/dbAPI";
import { getUserByEmail } from "../db/users";

// create router
const router = express.Router();

import jwt from "jsonwebtoken";
import { User } from "../structures/structures";

// login endpoint
router.post("/login/email", (req, res) => {
	let { username, password } = req.query;

	// check that username and password were provided
	if (!username || !password) {
		res.status(400).json({ error: "Missing username or password" });
		return;
	}

	getUserByEmail(username).then((user: User) => {
		// check if password is correct
		if (checkPassword(password, user.hash)) {
			// generate token
			const token = jwt.sign({ username: user.username, id: user.id, permissions: user.permissions }, process.env.JWT_SECRET, {
				expiresIn: "12h"
			});

			// assign token to user
			user.token = token;

			// send token
			res.status(200).json({ token: token, username: user.username, id: user.id });
		} else {
			res.status(401).json({ error: "Incorrect password" });
		}
	}).catch((err) => {
		console.log(err);

		return res.status(401).json({ error: "User does not exist" });
	});
});

// register endpoint
router.post("/register", (req, res) => {
	let { email, username, password } = req.query;

	// log email, username, and password
	console.log({ email: email, username: username, password: password });

	// check if user exists in database
	getUserByEmail(username).then((user) => {
		// check if user exists
		if (user) {
			// send error
			res.status(500).json({ error: "User already exists" });
		}
	}).catch(() => {
		// add user to database
		addUser(email, username, password, {
			ADMINISTRATOR: false,
			MANAGE_CHANNELS: false,
			MANAGE_MESSAGES: false
		}).then(() => {
			// send success
			res.json({ success: true });
		}).catch((err) => {
			// send error
			res.status(500).json({ error: err });
		});
	});
});

// authentication middleware, checks if user is logged in & redirects to login page if not, otherwise continues to next middleware
const auth = (req, res, next) => {
	// get token from request
	const token = req.headers.authorization;

	// console.log(req.headers.authorization);

	// check if token is valid
	const auth = checkTokenAuth(token);

	if (auth) {
		// set req.authenticated to true
		req.authenticated = true;

		req.user = getUserByToken(token);

		next();
	} else {
		// check if the route is for the API status endpoint
		if (req.url === "/" || req.url === "/auth/login/email" || req.url === "/auth/register") {
			// allow access to /api/ routes
			next();
		} else {
			// log error
			console.log("Not authenticated.");

			// send error
			res.status(401).json({ error: "Not authenticated." });
		}
	}
};

export {
	router as auth
}