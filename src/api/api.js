"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Michael G. <chrono@disilla.org>
 */

// net-related imports
const express = require("express");
require("dotenv").config();

const npm_package_version = require("../../package.json").version;

// import authentication middleware
const { auth } = require("../auth/auth");

// import external deps
const jwt = require("jsonwebtoken");

// import internal deps
const { generateSnowflake } = require("../util/snowflake");
// import database functions
const { getUserByEmail, getUserById, getChannelById, getChannelByName, addUser, createChannel, getUserByToken } = require("../db/dbAPI");

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
				"tehZevo"
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

	// fetch channel from database
	// res.status(200).json(getChannelById(id));
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
		getChannelById(id).members.set(uid, getUserById(uid).Member);
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

// export router
module.exports = { router, communicator };