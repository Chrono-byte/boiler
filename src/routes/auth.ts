/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// net-related modules
import {
	addUser,
	checkPassword,
	checkTokenAuth,
	getUserByToken,
} from "../db/dbAPI.ts";
import { getUserByEmail } from "../db/users.ts";
import { type User } from "../structures/structures.ts";
import express from "express";

// Dotenv
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

// Create router
const router = express.Router();

// Login endpoint
router.post("/login/email", (request, res) => {
	const username = request.query.username as string;
	const password = request.query.password as string;

	// Check that username and password were provided
	if (!username || !password) {
		console.log({
			username,
			password
		});

		res.status(400).json({ error: "Missing username or password" });
		return;
	}

	getUserByEmail(username)
		.then((user: User) => {
			// Check if password is correct
			if (checkPassword(password, user.hash)) {
				// Generate token
				const token = jwt.sign(
					{
						username: user.username,
						id: user.id,
						permissions: user.permissions,
					},
					process.env.JWT_SECRET,
					{
						expiresIn: "12h",
					}
				);

				// Assign token to user
				user.token = token;

				// Send token
				res.status(200).json({
					token,
					username: user.username,
					id: user.id,
				});
			} else {
				res.status(401).json({ error: "Incorrect password" });
			}
		})
		.catch((error) => {
			console.log(error);

			return res.status(401).json({ error: "User does not exist" });
		});
});

// Register endpoint
router.post("/register", (request, res) => {
	// Get email, username, and password from request
	const email = request.query.email as string;
	const username = request.query.username as string;
	const password = request.query.password as string;

	// Log email, username, and password
	console.log({ email, username, password });

	// Check if user exists in database
	getUserByEmail(username)
		.then((user) => {
			// Check if user exists
			if (user) {
				// Send error
				res.status(500).json({ error: "User already exists" });
			}
		})
		.catch(() => {
			// Add user to database
			addUser(email, username, password, {
				ADMINISTRATOR: false,
				MANAGE_CHANNELS: false,
				MANAGE_MESSAGES: false,
			})
				.then(() => {
					// Send success
					res.json({ success: true });
				})
				.catch((error) => {
					// Send error
					res.status(500).json({ error });
				});
		});
});

// Authentication middleware, checks if user is logged in & redirects to login page if not, otherwise continues to next middleware
const auth = (request, res, next) => {
	// Get token from request
	const token = request.headers.authorization;

	// Console.log(req.headers.authorization);

	// check if token is valid
	const auth = checkTokenAuth(token);

	if (auth) {
		// Set req.authenticated to true
		request.authenticated = true;

		request.user = getUserByToken(token);

		next();
	} else {
		// Check if the route is for the API status endpoint
		if (
			request.url === "/" ||
			request.url === "/auth/login/email" ||
			request.url === "/auth/register"
		) {
			// Allow access to /api/ routes
			next();
		} else {
			// Log error
			console.log("Not authenticated.");

			// Send error
			res.status(401).json({ error: "Not authenticated." });
		}
	}
};

export { router as authRouter, auth };
