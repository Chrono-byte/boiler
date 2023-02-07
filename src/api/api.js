"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

// net-related imports
const express = require("express");
require("dotenv").config();

const npm_package_version = require("../../package.json").version;

// import authentication middleware
const { auth } = require("../auth/auth");

// import database functions
const { getChannelById, getChannelByName, createChannel, deleteChannel, kickUserFromChannel, addUserToChannel } = require("../db/dbAPI");
const { getUserById } = require("../db/users");

// create router
const router = express.Router();

// create event emitter
const EventEmitter = require("events");
const communicator = new EventEmitter();

router.use(express.json());
router.use(auth);

// API status endpoint
router.get("/", (req, res) => {
	let status = {
		// server info
		"name": "Hammer Test Server",
		"description": "A simple WebSocket-based chat server & client written in JavaScript",

		// server health
		"health": ["OK", {
			"uptime": process.uptime(),
			"mem": process.memoryUsage(),
			"cpu": process.cpuUsage(),
		}],

		// server build/brand info
		"brand": {
			"build": {
				"date": process.env.BUILD_DATE,
				"commit": process.env.BUILD_COMMIT,
				"branch": process.env.BUILD_BRANCH,
				"tag": process.env.BUILD_TAG,
			},
			"brand": {
				"name": "Boiler",
				"version": npm_package_version
			},
			"authors": [
				"Chrono <chrono@disilla.org>",
				// "tehZevo"
			]
		},

		// auth status, non-authenticated agents will not be able to access any other endpoints
		"authenticated": false
	}

	status.authenticated = req.authenticated;

	res.json(status);

	// send dummy data
	// res.status(200).send("Hello World!");
});

// get channel endpoint
router.get("/channels/:id", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}
	
	let { id } = req.query;

	// check that requesting user is a member of the channel
	if (!getChannelById(id).members.includes(req.user.id)) {
		// send error
		res.status(401).json({ error: "User is not a member of channel" });
		return;
	}

	// fetch channel from database
	return res.status(200).json(getChannelById(id));
});

// create channel endpoint
router.post("/channels", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { name, description } = req.body;

	// check that name is a valid string
	if (typeof name !== "string") {
		// send error
		res.status(500).json({ error: "Invalid channel name" });
		return;
	}

	// check if channel exists
	if (getChannelByName(name) != null) {
		// send error
		// res.status(409).json({ error: "Channel already exists" });
		return;
	}

	// add channel to database
	createChannel({ name: name, description: description }, req.user.id).catch((err) => {
		console.log(err);
	});

	let channel = getChannelByName(name);

	// log channel creation
	console.log(`Channel ${channel.name} created by ${req.user.username}`);

	if (channel == null) {
		res.status(409).json({ error: "Channel could not be created" });
		return;
	}

	// send channel over network
	res.status(200).json(channel);
});

// delete channel endpoint
router.delete("/channels/:id", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
		return;
	}

	// check if user is owner of channel
	if (getChannelById(id).owner != req.user.id) {
		// send error
		res.status(401).json({ error: "User is not owner of channel" });
		return;
	}

	let { id } = req.params;

	// delete channel
	deleteChannel(id);

	// send success
	res.status(200).json({ success: true });
	return;
});

// get channel members endpoint
router.get("/channels/:id/members/", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
	}

	// send channel over network
	res.status(200).json(getChannelById(id).members);
	return;
});

// kick user endpoint
router.delete("/channels/:id/members/:uid", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id, uid } = req.params;

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
		return;
	}

	// check if user is owner OR a server admin
	if (getChannelById(id).owner != req.user.id && !req.user.permissions.ADMINISTRATOR) {
		// send error
		res.status(401).json({ error: "Refused." });
		return;
	}

	// check if user is in channel
	if (!getChannelById(id).members.has(uid)) {
		// send error
		res.status(500).json({ error: "User is not in channel" });
		return;
	}

	try {
		// kick user
		kickUserFromChannel(id, uid);
	} catch (err) {
		// send error
		res.status(500).json({ error: "User could not be kicked" });
		return;
	}

	// send success
	res.status(200).json({ success: true });
	return;
});

// leave channel endpoint
router.delete("/channels/:id/members/@me", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
		return;
	}

	// check if user is in channel and that the user is not the owner
	if (!getChannelById(id).members.has(req.user.id) || getChannelById(id).owner.id == req.user.id) {
		// send error
		res.status(500).json({ error: "User is not in channel" });
		return;
	}

	// remove user from channel
	try {
		getChannelById(id).members.delete(req.user.id);
	} catch (err) {
		// send error
		res.status(500).json({ error: "User could not be removed" });
		return;
	}

	// emit event for WS gateway
	communicator.emit("channelLeave", { channel: id, user: req.user.id });

	// remove channel id from user's channel list
	getUserById(req.user.id).channels.delete(id);

	// send success
	res.status(200).json({ success: true });
	return;
});

// put user into channel endpoint
router.put("/channels/:id/members", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}
	let { id } = req.params;

	let user = getUserById(req.user.id);
	let uid = req.user.id;

	console.log(`${user.username} is requesting to join channel ${getChannelById(id).name}`);

	// check if user is already in channel
	if (getChannelById(id).members.has(uid)) {
		// send error
		res.status(409).json({ error: "User is already in channel" });
		return;
	}

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
	}

	// add user to channel
	try {
		addUserToChannel(id, uid).catch(err => {
			console.log(err);
		});
	}
	catch (err) {
		console.log(err);
	}

	// check if user is in channel
	if (!getChannelById(id).members.has(uid)) {
		// send error
		console.log(`${user.username} could not be added to channel`);
		return;
	} else if (getChannelById(id).members.has(uid)) {
		console.log(`${user.username} was added to channel`);
	}

	// emit event for WS gateway
	communicator.emit("channelJoin", { channel: id, user: uid });

	// send channel over network
	res.status(200).json(getChannelById(id));
	return;
});

// get user info endpoint
router.get("/user/:id", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if user exists
	if (getUserById(id) == null) {
		// send error
		res.status(500).json({ error: "User does not exist" });
		return;
	}

	// send user over network
	res.status(200).json(getUserById(id).Member);
	return;
});

// set user avatar endpoint
router.put("/user/:id/avatar", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if user exists and if the user making the request is the user
	if (getUserById(id) == null || id != req.user.id) {
		// send error
		res.status(500).json({ error: "User does not exist" });
		return;
	}

	// check if avatar is set
	if (req.body.avatar == null) {
		// send error
		res.status(500).json({ error: "Avatar is not set" });
		return;
	}

	// set avatar
	getUserById(id).setAvatarURL(req.body.avatar);

	// send success
	res.status(200).json({ success: true });
	return;
});

// get user avatar endpoint
router.get("/user/:id/avatar", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if user exists
	if (getUserById(id) == null) {
		// send error
		res.status(500).json({ error: "User does not exist" });
		return;
	}

	// send avatar over network
	res.status(200).json({ avatar: getUserById(id).avatarURL });
	return;
});

// set username endpoint
router.put("/user/:id/username", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check if user exists and if the user making the request is the user
	if (getUserById(id) == null || id != req.user.id) {
		// send error
		res.status(500).json({ error: "User does not exist" });
		return;
	}

	// check if username is set
	if (req.body.username == null) {
		// send error
		res.status(500).json({ error: "Username is not set" });
		return;
	}

	// set username
	getUserById(id).setUsername(req.body.username);

	// fire updateUser event for WS gateway
	communicator.emit("updateUser", { user: id });
});

// get all channels a user is in endpoint
router.get("/user/:id/channels", (req, res) => {
	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	let { id } = req.params;

	// check that user is the user making the request
	if (id != req.user.id) {
		// send error
		res.status(401).json({ error: "You are not authorized to do this" });
		return;
	}

	// check if user exists
	if (getUserById(id) == null) {
		// send error
		res.status(500).json({ error: "User does not exist" });
		return;
	}

	let channels = getUserById(id).channels;
	let cArray = [];

	// loop through channels
	for (let channel of channels) {
		// push channel to array
		cArray.push(channel);
	}
	
	// send channels over network
	res.status(200).json(cArray);
	return;
});

// export router
module.exports = { router, communicator };