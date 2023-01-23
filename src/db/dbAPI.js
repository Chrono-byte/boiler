// import internal deps
const { generateSnowflake } = require("../util/snowflake");

// import external deps
const bcrypt = require("bcrypt");

// generate user id
function generateUserId() {
	return generateSnowflake() + 1024;
}

// data structure to store users
const users = new Map();

// data structure to store channels
const channels = new Map();

// get user by username function
function getUserByEmail(username) {
	const promise1 = new Promise((resolve, reject) => {
		for (let user of users.values()) {
			if (user.email == username) {
				return resolve(user);
			}
		}

		reject("User does not exist");
	});

	return promise1;
}

// get user by id function
function getUserById(id) {
	for (let user of users.values()) {
		if (user.id == id) {
			return user;
		}
	}
	return null;
}

// get channel by id function
function getChannelById(id) {
	for (let channel of channels.values()) {
		if (channel.id == id) {
			return channel;
		}
	}
	return null;
}

// get channel by name function
function getChannelByName(name) {
	for (let channel of channels.values()) {
		if (channel.name == name) {
			return channel;
		}
	}
	return null;
}

// add user to database
function addUser(email, username, password) {
	const promise1 = new Promise((resolve, reject) => {
		// hash password
		bcrypt.hash(password, 10).then((hash) => {
			let id = generateUserId();

			// add user to database
			users.set(id, { email: email, username: username, passwordHash: hash, id: id });

			// send success
			resolve("User added to database");
		}).catch((err) => {
			// send error
			// res.status(500).json({ error: "Error adding user to database" });
			console.log(err);
			reject("User does not exist");
		});
	});

	return promise1;
}

// check password hash to input password
function checkPassword(password, hash) {
	return bcrypt.compare(password, hash);
}

// function to check user auth
function checkTokenAuth(token) {
	let auth = false;

	// check that token was provided
	if (!token) {
		return false;
	}

	// check that the connection is an authorized user
	users.forEach((user) => {
		if (user.token == token) {
			auth = true;
		}
	});

	if (auth == false) {
		return false;
	} else {
		// send authorized handshake
		return true;
	}
}

module.exports = { getUserByEmail, getUserById, getChannelById, getChannelByName, addUser, checkTokenAuth, checkPassword };