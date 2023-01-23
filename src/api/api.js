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

router.use(express.json());
router.use(auth);

// API status endpoint
router.get("/", (req, res) => {
	let status = {
		"name": "Hammer Test Server",
		"health": "OK",
		"version": npm_package_version,
		"uptime": process.uptime(),
		"mem": process.memoryUsage(),
		"authenticated": false,
		"protocol": 1
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
	res.status(200).json(getChannelById(id));
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

	console.log(req.body);

	// check that name is a valid string
	if (typeof name !== "string") {
		// send error
		res.status(500).json({ error: "Invalid channel name" });
		return;
	}

	// check if channel exists
	if (getChannelByName(name) != null) {
		// send error
		res.status(409).json({ error: "Channel already exists" });
		return;
	}

	// add channel to database
	createChannel({ name: name, description: "A channel created by the API" }).catch((err) => {
		console.log(err);
	});

	let channel = getChannelByName(name);

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
	let { user } = req.body;

	// check if user is authenticated
	if (!req.authenticated) {
		// send error
		res.status(401).json({ error: "User is not authenticated" });
		return;
	}

	// check if user is valid
	if (typeof user !== "string") {
		// send error
		res.status(500).json({ error: "Invalid user" });
	}

	// check if channel exists
	if (getChannelById(id) == null) {
		// send error
		res.status(500).json({ error: "Channel does not exist" });
	}

	// add user to channel
	getChannelById(id).members.push(user);

	// send channel over network
	res.status(200).json(getChannelById(id));
});

// export router
module.exports = router;