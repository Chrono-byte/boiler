"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// import eventemitter 
const EventEmitter = require('events');

// import internal deps
const { users, getUserByEmail, getUserById } = require("../db/users");
const { generateSnowflake } = require("../util/snowflake");

class Message {
	constructor(content, author, channel) {
		this.content = content;
		this.author = author;

		this.createdAt = new Date();

		this.reply = false;

		this.id = generateSnowflake();
	}
}

class BaseChannel {
	constructor() {
		this.messages = new Map();
	}
}

class Member {
	constructor(user) {
		this.username = user.username;
		this.id = user.id;

		this.joinedAt = user.joinedAt;
		this.avatarURL = user.avatarURL;

		this.permissions = user.permissions;
	}
}

class User {
	constructor(email, username, hash, permissions, id) {
		this.email = email;
		this.hash = hash;

		this.username = username;
		this.id = id;

		this.joinedAt = new Date();
		this.avatarURL = null;

		this.permissions = {
			ADMINISTRATOR: permissions.ADMINISTRATOR,
			MANAGE_CHANNELS: permissions.MANAGE_CHANNELS,
			MANAGE_MESSAGES: permissions.MANAGE_MESSAGES
		}

		this.token = null;
		this.socket = null;
		this.sequence = 0;

		this.Member = new Member(this);
	}

	send(message) {
		throw new Error("Not implemented");
	}

	setAvatarURL(url) {
		// regex to check if url is valid
		const regex = /^(http|https):\/\/[^ "]+$/

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

class Channel extends BaseChannel {
	constructor(name, description, id, owner) {
		super();
		this.name = name;
		this.description = description;

		this.id = id;

		this.members = new Map();

		this.owner = owner;
	}

	addMember(member) {
		this.members.set(member.id, member);
	}

	removeMember(member) {
		this.members.delete(member.id);
	}

	setOwner(member) {
		this.owner = member;
	}

	sendAll(message) {
		console.log("Sending message to all members");

		console.log(this.members);

		this.members.forEach(member => {
			// get the member's full user from the id
			const user = getUserById(member.id);

			console.log("Sending message to " + user.email);

			// message = JSON.stringify({
			//     op: 0,
			//     d: new Message(message, this.owner, this),
			//     sequence: member.sequence += 1,
			//     type: "message"
			// });

			// console.log(message);

			// member.socket.send(message);
		});
	}


	broadcast(message) {
		this.members.forEach(member => {
			if (member.id !== this.owner.id) {
				member.send(message);
			}
		});
	}
}

module.exports = {
	User,
	Channel
}
