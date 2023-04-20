/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

import { LIB_VERSION } from "./version.ts";

function banner() {
	// Print the banner
	// print boiler server branding
	console.log(`Boiler - Version ${LIB_VERSION}`);
	// Log version from package.json
	console.log("Copyright (C) 2023 Hammer Authors <chrono@disilla.org>");
	console.log("");
	console.log(
		"This software is provided 'as-is', without any express or implied warranty. In no event will"
	);
	console.log(
		"the authors be held liable for any damages arising from the use of this software."
	);
	console.log("");
	console.log(
		"Permission is granted to anyone to use this software for any purpose, including commercial"
	);
	console.log(
		"applications, and to alter it and redistribute it freely, subject to the following restrictions of the zLib with Acknowledgement license."
	);
	console.log(
		"If a copy of the zLib with Acknowledgement license was not distributed with this file, you can obtain one at https://spdx.org/licenses/zlib-acknowledgement.html."
	);
	console.log(
		"If you do not agree to these terms, do not use this software."
	);
	console.log("");
}

export default banner;
