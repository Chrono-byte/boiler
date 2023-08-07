/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import dotenv from 'dotenv';
import express, { Request, Response } from 'npm:express';

dotenv.config();

// Create router
const router = express.Router();

router.use(express.json());

interface BoilerRequest extends Request {
	authenticated: boolean;
	query: { username: string; password: string };
}

// Get user info endpoint
router.get(
	'/user/:id',
	async (
		request: BoilerRequest,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		// Check if user exists
		if (getUserById(id) == null) {
			// Send error
			res.status(500).json({ error: 'User does not exist' });
			return;
		}

		// Get user
		const user = await getUserById(id);

		// Send user over network
		res.status(200).json(user.Member);
	},
);

// Set username endpoint
router.put(
	'/user/:id/username',
	async (
		request: BoilerRequest,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		// Check if user exists and if the user making the request is the user
		if (getUserById(id) == null || id != request.user.id) {
			// Send error
			res.status(500).json({ error: 'User does not exist' });
			return;
		}

		// Check if username is set
		if (request.body.username == null) {
			// Send error
			res.status(500).json({ error: 'Username is not set' });
			return;
		}

		// Get user
		const user = await getUserById(id);

		// Set username
		user.setUsername(request.body.username, false);
	},
);

export { router as usersRouter }
