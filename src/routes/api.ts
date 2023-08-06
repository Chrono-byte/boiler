/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { EventEmitter } from 'node:events';
import process from 'node:process';

import { LIB_VERSION as npm_package_version } from '../version.ts';
import { auth } from './auth.ts';

dotenv.config();

// Create router
const router = express.Router();

const communicator = new EventEmitter();

router.use(express.json());
router.use(auth);

// definition of the type of the request object
declare global {
	namespace Express {
		interface Request {
			authenticated: boolean;
			query: { username: string; password: string };
		}
	}
}

// API status endpoint
router.get(
	'/',
	(
		request: Request,
		res: Response,
	) => {
		const status = {
			// Server info
			name: 'Hammer Test Server',
			description:
				'A simple WebSocket-based chat server & client written in JavaScript',

			// Server health
			health: [
				'OK',
				{
					// uptime: process.uptime(),
					// mem: process.memoryUsage(),
					// cpu: process.cpuUsage(),
				},
			],

			// Server build/brand info
			brand: {
				build: {
					date: process.env.BUILD_DATE,
					commit: process.env.BUILD_COMMIT,
					branch: process.env.BUILD_BRANCH,
					tag: process.env.BUILD_TAG,
				},
				brand: {
					name: 'Boiler',
					version: npm_package_version,
				},
				authors: ['Chrono <chrono@disilla.org>'],
			},

			// Auth status, non-authenticated agents will not be able to access any other endpoints
			authenticated: false,
		};

		status.authenticated = request.authenticated;

		res.json(status);
	},
);

// Get channel endpoint
router.get(
	'/channels/:id',
	(
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.query;

		// Check that requesting user is a member of the channel
		if (!getChannelById(id).members.includes(request.user.id)) {
			// Send error
			res.status(401).json({ error: 'User is not a member of channel' });
			return;
		}

		// Fetch channel from database
		return res.status(200).json(getChannelById(id));
	},
);

// Create channel endpoint
router.post(
	'/channels',
	(
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { name, description } = request.body;

		// Check that name is a valid string
		if (typeof name !== 'string') {
			// Send error
			res.status(500).json({ error: 'Invalid channel name' });
			return;
		}

		// Check if channel exists
		if (getChannelByName(name) != null) {
			// Send error
			// res.status(409).json({ error: "Channel already exists" });
			return;
		}

		// Add channel to database
		createChannel({ name, description }, request.user.id).catch((error) => {
			console.log(error);
		});

		const channel = getChannelByName(name);

		// Log channel creation
		console.log(
			`Channel ${channel.name} created by ${request.user.username}`,
		);

		if (channel == null) {
			res.status(409).json({ error: 'Channel could not be created' });
			return;
		}

		// Send channel over network
		res.status(200).json(channel);
	},
);

// Delete channel endpoint
router.delete(
	'/channels/:id',
	(
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		// Check if channel exists
		if (getChannelById(id) == null) {
			// Send error
			res.status(500).json({ error: 'Channel does not exist' });
			return;
		}

		// Check if user is owner of channel
		if (getChannelById(id).owner != request.user.id) {
			// Send error
			res.status(401).json({ error: 'User is not owner of channel' });
			return;
		}

		// Delete channel
		deleteChannel(id);

		// Send success
		res.status(200).json({ success: true });
	},
);

// Get channel members endpoint
router.get(
	'/channels/:id/members/',
	(
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		// Check if channel exists
		if (getChannelById(id) == null) {
			// Send error
			res.status(500).json({ error: 'Channel does not exist' });
		}

		// Send channel over network
		res.status(200).json(getChannelById(id).members);
	},
);

// Kick user endpoint
router.delete(
	'/channels/:id/members/:uid',
	(
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id, uid } = request.params;

		// Check if channel exists
		if (getChannelById(id) == null) {
			// Send error
			res.status(500).json({ error: 'Channel does not exist' });
			return;
		}

		// Check if user is owner OR a server admin
		if (
			getChannelById(id).owner != request.user.id &&
			!request.user.permissions.ADMINISTRATOR
		) {
			// Send error
			res.status(401).json({ error: 'Refused.' });
			return;
		}

		// Check if user is in channel
		if (!getChannelById(id).members.has(uid)) {
			// Send error
			res.status(500).json({ error: 'User is not in channel' });
			return;
		}

		try {
			// Kick user
			kickUserFromChannel(id, uid);
		} catch {
			// Send error
			res.status(500).json({ error: 'User could not be kicked' });
			return;
		}

		// Send success
		res.status(200).json({ success: true });
	},
);

// Leave channel endpoint
router.delete(
	'/channels/:id/members/@me',
	async (
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		// Check if channel exists
		if (getChannelById(id) == null) {
			// Send error
			res.status(500).json({ error: 'Channel does not exist' });
			return;
		}

		// Check if user is in channel and that the user is not the owner
		if (
			!getChannelById(id).members.has(request.user.id) ||
			getChannelById(id).owner.id == request.user.id
		) {
			// Send error
			res.status(500).json({ error: 'User is not in channel' });
			return;
		}

		// Remove user from channel
		try {
			getChannelById(id).members.delete(request.user.id);
		} catch {
			// Send error
			res.status(500).json({ error: 'User could not be removed' });
			return;
		}

		// Emit event for WS gateway
		communicator.emit('channelLeave', {
			channel: id,
			user: request.user.id,
		});

		// Get user
		const user = await getUserById(request.user.id);

		// Remove channel id from user's channel list
		user.channels.delete(id);

		// Send success
		res.status(200).json({ success: true });
	},
);

// Put user into channel endpoint
router.put(
	'/channels/:id/members',
	async (
		request: Request,
		res: Response,
	) => {
		// Check if user is authenticated
		if (!request.authenticated) {
			// Send error
			res.status(401).json({ error: 'User is not authenticated' });
			return;
		}

		const { id } = request.params;

		const user = await getUserById(request.user.id);
		const uid = request.user.id;

		console.log(
			`${user.username} is requesting to join channel ${
				getChannelById(id).name
			}`,
		);

		// Check if user is already in channel
		if (getChannelById(id).members.has(uid)) {
			// Send error
			res.status(409).json({ error: 'User is already in channel' });
			return;
		}

		// Check if channel exists
		if (getChannelById(id) == null) {
			// Send error
			res.status(500).json({ error: 'Channel does not exist' });
		}

		// Add user to channel
		try {
			addUserToChannel(id, uid).catch((error) => {
				console.log(error);
			});
		} catch (error) {
			console.log(error);
		}

		// Check if user is in channel
		if (!getChannelById(id).members.has(uid)) {
			// Send error
			console.log(`${user.username} could not be added to channel`);
			return;
		}

		if (getChannelById(id).members.has(uid)) {
			console.log(`${user.username} was added to channel`);
		}

		// Emit event for WS gateway
		communicator.emit('channelJoin', { channel: id, user: uid });

		// Send channel over network
		res.status(200).json(getChannelById(id));
	},
);

// Get user info endpoint
router.get(
	'/user/:id',
	async (
		request: Request,
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
		request: Request,
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

		// Fire updateUser event for WS gateway
		communicator.emit('updateUser', { user: id });
	},
);

// Export communicator as ESM
export { communicator as com, router as api };
