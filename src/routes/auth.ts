/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import process from "node:process";

dotenv.config();

// Create router
const router = express.Router();

router.get(
	"/",
	(
		request: Request & {
			authenticated: boolean;
			query: { token: string };
		},
		res: Response
	) => {
		// Check if user is authenticated
		if (request.authenticated) {
			// post
			res.status(200).json({
				authenticated: true,
				username: request.query.username,
				id: request.query.id,
			});
		} else {
			// Send error
			res.status(401).json({ error: "err" });
		}
	}
);

// Login endpoint
router.post("/login/email", async (request: Request, res: Response) => {
	const { username, password } = request.body;

	const user = await getUserByEmail(username);

	if (!user) {
		res.status(404).json({ error: "User not found" });
	}

	// Check if password is correct
	if ((await checkPassword(password, user.hash)) == true) {
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
			token: token,
			username: user.username,
			id: user.id,
		});

		// finish request
		return;
	} else {
		res.status(401).json({ error: "Incorrect password" });
	}
});

// Register endpoint
router.post(
	"/register",
	(
		request: Request & {
			authenticated: boolean;
			query: { username: string; password: string };
		},
		res: Response
	) => {
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
	}
);

// Authentication middleware, checks if user is logged in & redirects to login page if not, otherwise continues to next middleware
const auth = (
	request: Request & {
		authenticated: boolean;
		query: { username: string; password: string };
	},
	res: Response,
	next: () => void
) => {
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
