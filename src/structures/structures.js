"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */
const { getUserById } = require("../db/users");
const { generateSnowflake } = require("../util/snowflake");

function testUsername(username, bypass) {
	// check that username is a string
	if (typeof username !== "string") {
		return false;
	}

	// check that username is not empty
	if (username.length === 0) {
		return false;
	}

	if (!bypass) {
		// check that username is not too long
		if (username.length > 16) {
			return false;
		}

		// check that username is not too short
		if (username.length < 3) {
			return false;
		}

		// check that username is not taken
		if (getUserById(username)) {
			return false;
		}

		// check that username is not a reserved name
		if (username == "hammer" || username == "system" || username == "server" || username == "root" || username == "owner" || username == "sys") {
			return false;
		}

		// check that it is alphanumeric
		if (!/^[a-zA-Z0-9]+$/.test(username)) {
			return false;
		}
	}

	return true;
}

class Message {
	constructor(content, author, channel) {
		// check that required parameters are provided
		if (!content || !author || !channel) throw new Error("Missing required parameters for Message constructor. (content, author, channel)");

		// check that content is a string
		if (typeof content !== "string") throw new TypeError("Message content must be a string.");

		// message and author
		this.content = content;
		this.author = channel.members.get(author) ? channel.members.get(author) : null;

		// parent channel
		this.channel = channel;

		// message metadata
		this.createdAt = new Date();
		this.reply = false;
		this.id = generateSnowflake();
	}
}

class HammerObject {
	constructor() {}

	serialize() {
		return {
			...this
		}
	}
}

class Member {
	constructor(user) {
		// identity
		this.username = user.username;
		this.id = user.id;

		// public info
		this.joinedAt = user.joinedAt;
		this.avatarURL = user.avatarURL;

		// server level permissions
		this.permissions = user.permissions;
	}
}

class User {
	constructor(email, username, hash, permissions, id) {
		// account auth info
		this.email = email;
		this.hash = hash;
		this.salt = null;

		// identity

		// check that username is valid
		if (!testUsername(username)) {
			throw new Error("Invalid username");
		}

		this.username = username;

		this.id = id;

		// public info
		this.joinedAt = new Date();
		this.avatarURL = null;

		// server level permissions
		this.permissions = {
			ADMINISTRATOR: permissions.ADMINISTRATOR,
			MANAGE_CHANNELS: permissions.MANAGE_CHANNELS,
			MANAGE_MESSAGES: permissions.MANAGE_MESSAGES
		};

		// session info
		this.token = null;
		this.socket = null;

		// safe to expose this
		this.Member = new Member(this);

		// list of channels the user is in
		this.channels = new Map();
	}

	send(message) {
		// unimplemented send to user
		console.log("Sending message: " + message);

		throw new Error("Not implemented");
	}

	setUsername(username, bypass) {
		let yes = testUsername(username, bypass);

		if (!yes) {
			throw new Error("Invalid username");
		}

		this.username = username;
	}

	setAvatarURL(url) {
		// regex to check if url is valid
		const regex = /^(http|https):\/\/[^ "]+$/;

		if (!regex.test(url)) {
			throw new Error("Invalid URL");
		}

		// check that url is an image
		if (!url.endsWith(".png") && !url.endsWith(".jpg") && !url.endsWith(".jpeg")) {
			throw new Error("URL is not an image");
		}

		this.avatarURL = url;
	}
}

class Channel extends HammerObject {
	constructor(name, description, id, owner) {
		super();
		// channel name and description
		this.name = name;
		this.description = description;

		// channel metadata
		this.owner = owner;
		this.id = id;

		// list of members in the channel
		this.members = new Map();

		// messages store
		this.messages = new Map();
	}

	rename(name, user) {
		// check that the user has permission to rename the channel
		if (!user.permissions.MANAGE_CHANNELS) {
			throw new Error("You do not have permission to rename this channel.");
		}

		// check that name is a string
		if (typeof name !== "string") {
			throw new TypeError("Channel name must be a string.");
		}

		// check that name is not empty
		if (name.length === 0) {
			throw new Error("Channel name cannot be empty.");
		}

		// check that name is not too long
		if (name.length > 16) {
			throw new Error("Channel name cannot be longer than 16 characters.");
		}

		this.name = name;
	}

	setDescription(description, user) {
		// check that the user has permission to rename the channel
		if (!user.permissions.MANAGE_CHANNELS) {
			throw new Error("You do not have permission to rename this channel.");
		}

		// check that description is a string
		if (typeof description !== "string") {
			throw new TypeError("Channel description must be a string.");
		}

		// check that description is not too long
		if (description.length > 128) {
			throw new Error("Channel description cannot be longer than 128 characters.");
		}

		this.description = description;
	}

	addMember(member) {
		// check that the member is not already in the channel
		if (this.members.has(member.id)) {
			return console.error("Member is already in this channel.");
		}

		this.members.set(member.id, member);
	}

	removeMember(member) {
		// check that the member is in the channel
		if (!this.members.has(member.id)) {
			throw new Error("Member is not in this channel.");
		}

		this.members.delete(member.id);
	}

	setOwner(member) {
		this.owner = member;
	}

	sendAll(message, from) {
		// check if from is set
		if (!from) {
			from = message.author.id;
		}

		if (typeof message == "string" && from) {
			message = new Message(message, from, this);
		}

		// check that message is a Message
		if (!(message instanceof Message)) {
			throw new TypeError("Message must be a Message object.");
		}

		// check that message is from this channel
		if (message.channel.id !== this.id) {
			throw new Error("Message is not from this channel.");
		}

		// push message to messages store
		this.messages.set(message.id, message);

		this.members.forEach(member => {
			// get the member's full user from the id
			const user = getUserById(member.id);
			if (!user.socket || member.id == from) return;

			try {
				user.socket.json({
					op: 0,
					data: message,
					type: "MESSAGE"
				});
			} catch (e) { console.log(e); }
		});
	}

	deleteMessage(message, user) {
		// check that message exists
		if (!this.messages.has(message.id)) {
			throw new Error("Message does not exist.");
		}

		message = this.messages.get(message.id);

		// check that the user has permission to delete messages
		if (!user.permissions.MANAGE_MESSAGES || user.id !== message.author.id) {
			throw new Error("You do not have permission to delete this message.");
		}

		// check that message is from this channel
		if (message.channel.id !== this.id) {
			throw new Error("Message is not from this channel.");
		}

		this.messages.delete(message.id);
	}

	broadcast(message) {
		this.members.forEach(member => {
			const user = getUserById(member.id);
			if (member.id !== this.owner.id) {
				user.socket.json({
					op: 0,
					data: new Message(message.content, "hehe", this),
					type: "MESSAGE"
				});
			}
		});
	}
}

module.exports = {
	User,
	Channel,
	Message,
	testUsername
};
