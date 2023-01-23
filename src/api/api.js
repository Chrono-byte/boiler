const express = require("express");
require("dotenv").config();

// import authentication middleware
const { auth } = require("../auth/auth");

// import external deps
const jwt = require("jsonwebtoken");

// import internal deps
const { generateSnowflake } = require("../util/snowflake");
// import database functions
const { getUserByEmail, getUserById, getChannelById, getChannelByName, addUser, addChannel } = require("../db/dbAPI");

// create router
const router = express.Router();

// get channel endpoint
router.get("channels/:id", auth, (req, res) => {
	let { id } = req.query;

	// fetch channel from database

});

// create channel endpoint
router.post("channels", auth, (req, res) => {
	let { name } = req.query;

	// log name
	console.log(name);

	// check if channel exists
	if (getChannelByName(name)) {
		// send error
		res.status(500).json({ error: "Channel already exists" });
	}

	// create channel
	let channel = { id: generateSnowflake(), name: name, messages: [], members: [] };

	// add channel to database
	channels.set(channel.id, channel);

	// send success
	res.json({ success: true });
});

// export router
module.exports = router;