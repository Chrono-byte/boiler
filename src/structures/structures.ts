/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// internal imports
import { getUserById } from "../db/users.ts";
import generateSnowflake from "../util/snowflake.ts";

// external imports
import WebSocket from "ws";

function testUsername(username: string, bypass: boolean) {
	// Check that username is a string
	if (typeof username !== "string") {
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

		// Check that username is not taken
		if (getUserById(username) !== null) {
			return false;
		}

		// Check that username is not a reserved name
		if (
			username == "hammer" ||
			username == "system" ||
			username == "server" ||
			username == "root" ||
			username == "owner" ||
			username == "sys"
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
				"Missing required parameters for Message constructor. (content, author, channel)"
			);
		}

		// Check that content is a string
		if (typeof content !== "string") {
			throw new TypeError("Message content must be a string.");
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
		this.id = generateSnowflake();
	}
}

class PermissionsObject {
	ADMINISTRATOR: boolean;
	MANAGE_CHANNELS: boolean;
	MANAGE_MESSAGES: boolean;
	constructor(
		ADMINISTRATOR: boolean,
		MANAGE_CHANNELS: boolean,
		MANAGE_MESSAGES: boolean
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
	salt: string | undefined;
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
		id: string
	) {
		// Account auth info
		this.email = email as string;
		this.hash = hash as string;

		// Identity

		// check that username is valid
		if (!testUsername(username, true)) {
			throw new Error("Invalid username");
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

	send(message: string) {
		// Unimplemented send to user
		console.log(`Sending message to user ${this.username}: ${message}`);

		throw new Error("Not implemented");
	}

	setUsername(username: string, bypass: boolean) {
		const yes = testUsername(username, bypass);

		if (!yes) {
			throw new Error("Invalid username");
		}

		this.username = username;
	}

	setAvatarURL(url: string) {
		// Regex to check if url is valid
		const regex = /^(http|https):\/\/[^ "]+$/;

		if (!regex.test(url)) {
			throw new Error("Invalid URL");
		}

		// Check that url is an image
		if (
			!url.endsWith(".png") &&
			!url.endsWith(".jpg") &&
			!url.endsWith(".jpeg")
		) {
			throw new Error("URL is not an image");
		}

		this.avatarURL = url;
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

	rename(name: string, user: { permissions: { MANAGE_CHANNELS: boolean } }) {
		// Check that the user has permission to rename the channel
		if (!user.permissions.MANAGE_CHANNELS) {
			throw new Error(
				"You do not have permission to rename this channel."
			);
		}

		// Check that name is a string
		if (typeof name !== "string") {
			throw new TypeError("Channel name must be a string.");
		}

		// Check that name is not empty
		if (name.length === 0) {
			throw new Error("Channel name cannot be empty.");
		}

		// Check that name is not too long
		if (name.length > 16) {
			throw new Error(
				"Channel name cannot be longer than 16 characters."
			);
		}

		this.name = name;
	}

	setDescription(
		description: string,
		user: { permissions: { MANAGE_CHANNELS: boolean } }
	) {
		// Check that the user has permission to rename the channel
		if (!user.permissions.MANAGE_CHANNELS) {
			throw new Error(
				"You do not have permission to rename this channel."
			);
		}

		// Check that description is a string
		if (typeof description !== "string") {
			throw new TypeError("Channel description must be a string.");
		}

		// Check that description is not too long
		if (description.length > 128) {
			throw new Error(
				"Channel description cannot be longer than 128 characters."
			);
		}

		this.description = description;
	}

	addMember(member: Member) {
		// Check that the member is not already in the channel
		if (this.members.has(member.id)) {
			console.error("Member is already in this channel.");
			return;
		}

		this.members.set(member.id, member);
	}

	removeMember(member: { id: string }) {
		// Check that the member is in the channel
		if (!this.members.has(member.id)) {
			throw new Error("Member is not in this channel.");
		}

		this.members.delete(member.id);
	}

	setOwner(member: User) {
		this.owner = member;
	}

	async sendAll(message: Message, from: string) {
		// Check if from is set
		if (!from) {
			if (!message.author) {
				throw new Error("Message must have an author.");
			}
			from = message.author.id;
		}

		if (typeof message === "string" && from) {
			message = new Message(message, from, this);
		}

		// Check that message is a Message
		if (!(message instanceof Message)) {
			throw new TypeError("Message must be a Message object.");
		}

		// Check that message is from this channel
		if (message.channel.id !== this.id) {
			throw new Error("Message is not from this channel.");
		}

		// Push message to messages store
		this.messages.set(message.id, message);

		for (const [, member] of this.members) {
			// Get the member's full user from the id
			const user = await getUserById(member.id);
			if (!user.socket || member.id == from) {
				continue;
			}

			try {
				user.socket.json({
					op: 0,
					data: message,
					type: "MESSAGE",
				});
			} catch (error) {
				console.log(error);
			}
		}
	}

	deleteMessage(
		message: Message,
		user: { permissions: { MANAGE_MESSAGES: boolean }; id: string }
	) {
		// Check that the user has permission to delete messages
		if (
			!user.permissions.MANAGE_MESSAGES ||
			user.id !== message.author?.id
		) {
			throw new Error(
				"You do not have permission to delete this message."
			);
		}

		// Check that message is from this channel
		if (message.channel.id !== this.id) {
			throw new Error("Message is not from this channel.");
		}

		this.messages.delete(message.id);
	}

	async broadcast(message: { content: string }) {
		for (const [, member] of this.members) {
			const user = await getUserById(member.id);
			if (member.id !== this.owner.id) {
				user.socket.json({
					op: 0,
					data: new Message(message.content, "hehe", this),
					type: "MESSAGE",
				});
			}
		}
	}
}

export { User, Channel, Message, testUsername, PermissionsObject };
