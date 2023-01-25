"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

const { v4: uuidv4 } = require("uuid");

module.exports = {
	generateSnowflake() {
		return uuidv4();
	}
};
