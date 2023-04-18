/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

import {v4 as uuidv4} from 'uuid';

// The return type of this function is a string
function generateSnowflake(): string {
	return uuidv4();
}

export default generateSnowflake;
