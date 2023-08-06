/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// external imports
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

function testUsername(username: string, bypass: boolean) {
	// Check that username is a string
	if (typeof username !== 'string') {
		return false;
	}

	// Check that username is not empty
	if (username.length === 0) {
		return false;
	}

	if (!bypass) {
		// Check that username is not too long
		if (username.length > 16) {
			return false;
		}

		// Check that username is not too short
		if (username.length < 3) {
			return false;
		}

		// Check that username is not a reserved name
		if (
			username == 'system' ||
			username == 'root'
		) {
			return false;
		}

		// Check that it is alphanumeric
		if (!/^[a-zA-Z\d]+$/.test(username)) {
			return false;
		}
	}

	return true;
}

class Message {
	content: string;
	author: Member | null;
	channel: Channel;
	createdAt: Date;
	reply: boolean;
	id: string;
	constructor(content: string, author: string, channel: Channel) {
		// Check that required parameters are provided
		if (!content || !author || !channel) {
			throw new Error(
				'Missing required parameters for Message constructor. (content, author, channel)',
			);
		}

		// Check that content is a string
		if (typeof content !== 'string') {
			throw new TypeError('Message content must be a string.');
		}

		// Message and author
		this.content = content;
		// get author from user id if the author exists
		this.author = channel.members.get(author) || null;

		// Parent channel
		this.channel = channel;

		// Message metadata
		this.createdAt = new Date();
		this.reply = false;
		this.id = uuidv4();
	}
}

class PermissionsObject {
	ADMINISTRATOR: boolean;
	MANAGE_CHANNELS: boolean;
	MANAGE_MESSAGES: boolean;
	constructor(
		ADMINISTRATOR: boolean,
		MANAGE_CHANNELS: boolean,
		MANAGE_MESSAGES: boolean,
	) {
		this.ADMINISTRATOR = ADMINISTRATOR;
		this.MANAGE_CHANNELS = MANAGE_CHANNELS;
		this.MANAGE_MESSAGES = MANAGE_MESSAGES;
	}
}

class Member {
	username: string;
	id: string;
	joinedAt: Date;
	avatarURL: string | undefined;
	permissions: PermissionsObject;
	constructor(user: User) {
		// Identity
		this.username = user.username;
		this.id = user.id;

		// Public info
		this.joinedAt = user.joinedAt;
		this.avatarURL = user.avatarURL;

		// Server level permissions
		this.permissions = user.permissions;
	}
}

class User {
	email: string;
	hash: string;
	username: string;
	id: string;
	joinedAt: Date;
	avatarURL: string | undefined;
	permissions: PermissionsObject;
	token: string | undefined | null;
	// This needs to be changed to have our custom .json middleware socket
	socket: WebSocket & { json: (data: unknown) => void };
	Member: Member;
	channels: Map<string, Channel>;
	handshakeComplete: boolean | undefined;
	constructor(
		email: string,
		username: string,
		hash: string,
		permissions: PermissionsObject,
		id: string,
	) {
		// Account auth info
		this.email = email as string;
		this.hash = hash as string;

		// Identity

		// check that username is valid
		if (!testUsername(username, true)) {
			throw new Error('Invalid username');
		}

		this.username = username as string;

		this.id = id as string;

		// Public info
		this.joinedAt = new Date();

		// Server level permissions
		this.permissions = {
			ADMINISTRATOR: permissions.ADMINISTRATOR,
			MANAGE_CHANNELS: permissions.MANAGE_CHANNELS,
			MANAGE_MESSAGES: permissions.MANAGE_MESSAGES,
		};

		// Session info
		this.token = null;
		this.socket = null;

		// Safe to expose this
		this.Member = new Member(this);

		// List of channels the user is in
		this.channels = new Map();
	}
}

class Channel {
	owner: Member;
	id: string;
	name: string;
	description: string;
	members: Map<string, Member>;
	messages: Map<string, Message>;
	constructor(name: string, description: string, id: string, owner: Member) {
		// Channel name and description
		this.name = name;
		this.description = description;

		// Channel metadata
		this.owner = owner;
		this.id = id;

		// members: Map<string, Member>;
		this.members = new Map<string, Member>();
		// messages: Map<string, Message>;
		this.messages = new Map<string, Message>();
	}
}

export { Channel, Message, PermissionsObject, testUsername, User };
