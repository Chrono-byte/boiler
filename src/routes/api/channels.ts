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

// Get channel endpoint
router.get(
	'/channels/:id',
	(
		request: BoilerRequest,
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
		request: BoilerRequest,
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
		request: BoilerRequest,
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

export { router as channelsRouter };
