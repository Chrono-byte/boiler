// net-related modules
const express = require("express");
const axios = require("axios");

// import environment
require("dotenv").config();

// import internal deps
const { getUserByEmail, addUser, checkPassword, checkTokenAuth } = require("../db/dbAPI");

// create router
const router = express.Router();

router.get("/gh", (req, res) => {
	// Store parameters in an object
	const params = {
		scope: ["read:user", "user:email"],
		client_id: process.env.CLIENT_ID,
	};

	// Convert parameters to a URL-encoded string
	const urlEncodedParams = new URLSearchParams(params).toString();
	res.redirect(`https://github.com/login/oauth/authorize?${urlEncodedParams}`);
});

const jwt = require("jsonwebtoken");

// login endpoint
router.post("/login/email", (req, res) => {
	let { username, password } = req.query;

	let user = getUserByEmail(username);

	user.then((user) => {
		// check if user exists
		if (user) {
			// check if password is correct
			if (checkPassword(password, user.passwordHash)) {
				// generate token
				const token = jwt.sign({ username: user.username, id: user.id }, process.env.JWT_SECRET, {
					expiresIn
						: "12h"
				});

				// assign token to user
				user.token = token;

				// send token
				res.status(200).json({ token: token, username: user.username, id: user.id });
			} else {
				res.status(401).json({ error: "Incorrect password" });
			}
		} else {
			res.status(401).json({ error: "User does not exist" });
		}
	}).catch((err) => {
		console.log(err);

		// send error
		res.status(500).json({ error: err });
	});
});

// register endpoint
router.post("register", (req, res) => {
	let { email, username, password } = req.query;

	// log email, username, and password
	console.log({ email: email, username: username, password: password });

	// check if user exists in database
	getUserByEmail(username).then((user) => {
		// check if user exists
		if (user) {
			// send error
			res.status(500).json({ error: "User already exists" });
		} else {
			// add user to database
			addUser(email, username, password).then(() => {
				// send success
				res.json({ success: true });
			}).catch((err) => {
				// send error
				res.status(500).json({ error: err });
			});
		}
	}).catch((err) => {
		// send error
		res.status(500).json({ error: err });
	});
});

router.get("/github-callback", (req, res) => {
	const { code } = req.query;

	const body = {
		client_id: process.env.CLIENT_ID,
		client_secret: process.env.CLIENT_SECRET,
		code,
	};

	let accessToken;
	const options = { headers: { accept: "application/json" } };

	axios
		.post("https://github.com/login/oauth/access_token", body, options)
		.then((response) => response.data.access_token)
		.then((token) => {
			accessToken = token;

			// log that a github user has logged in
			console.log(`Github user logged in with token ${accessToken}`);

			// get the user's username and primary email from github
			return axios.get("https://api.github.com/user", {
				headers: { Authorization: `token ${accessToken}` },
			});
		})
		.then((response) => {
			const { login, email } = response.data;

			// log that we've gotten the user's username and email from github
			console.log(`Github user ${login} has email ${email}`);

			// check if user exists in database
			return getUserByEmail(email).then((user) => {
				// check if user exists
				if (user) {
					// generate token
					const token = jwt.sign({ username: user.username, id: user.id }, process.env.JWT_SECRET, {
						expiresIn: "12h"
					});

					// assign token to user
					user.token = token;

					// send
					res.redirect(`/app/?token=${accessToken}`);
				}
			}).catch((err) => () => {
				// log error
				console.log(err);

				// / add user to database
				addUser(email, login, accessToken).then(() => {
					// log success
					console.log("User added to database");

					// send success
					res.redirect(`/app/?token=${accessToken}`);
				}).catch((err) => {
					// send error
					res.status(500).json({ error: err });
				});
			});
		})
		.catch((err) => {
			// send error
			res.status(500).json({ error: err });
		});
});


// authentication middleware, checks if user is logged in & redirects to login page if not, otherwise continues to next middleware
const auth = (req, res, next) => {
	// get token from request
	// const url = new URL(req.url, `http://${req.headers.host}`);
	// const token = url.searchParams.get("token");
	const token = req.headers.authorization;

	// console.log(req.headers.authorization);

	// check if token is valid
	const auth = checkTokenAuth(token);

	if (auth) {
		// set req.authenticated to true
		req.authenticated = true;

		next();
	} else {
		res.status(500).json({ error: "Not authenticated." });
	}
};

module.exports = { router, auth };