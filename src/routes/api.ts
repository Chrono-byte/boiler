/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// internal imports
import { channelsRouter } from './api/channels.ts';
import { usersRouter } from './api/users.ts';

// external imports
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import process from 'node:process';

import { LIB_VERSION as npm_package_version } from '../version.ts';
import { auth } from './auth.ts';

dotenv.config();

// Create router
const router = express.Router();

router.use(express.json());
router.use(auth);

interface BoilerRequest extends Request {
	authenticated: boolean;
	query: { username: string; password: string };
}

// API status endpoint
router.get(
	'/',
	(
		request: BoilerRequest,
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

router.use('/channels', channelsRouter);

router.use('/users', usersRouter);


// Export communicator as ESM
export { router as api };
