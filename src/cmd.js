"use strict";

/*
 * Hammer - A simple WebSocket-based chat server & client written in JavaScript.
 *
 * Copyright (C) 2023 Hammer Authors <chrono@disilla.org>
 */

const prompts = require('prompts');

function Banner() {
    // print the banner
    // print boiler server branding
    console.log(`Boiler - Version ${require("../package.json").version}`);
    // print hammer branding
    console.log("Hammer - A simple WebSocket-based chat server & client.");
    // log version from package.json
    console.log("Copyright (C) 2023 Hammer Authors <chrono@disilla.org>");
    console.log("");
    // print notice that this program is licensed under the terms of the zlib with aknowledgement license
    // print notice of no warranty
    console.log("This program is licensed under the terms of the zlib with aknowledgement license.");
    console.log("THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.");
    console.log("");
}

// prompt for control commands
const commandPrompt = async () => {
    const response = await prompts({
        type: 'text',
        name: 'command',
        message: 'hammer> '
    });

    // shows warranty
    if (response.command == "show w") {
        console.log("THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.");
    }

    // shows license
    if (response.command == "show c") {
        console.log("This is closed-source software.");
        console.log("You may not redistribute it.");
        console.log("You may not modify it.");
        console.log("There is NO WARRANTY, to the extent permitted by law.");
    }

    // exit the program
    if (response.command == "exit") {
        process.exit(0);
    }

    // restart the prompt
    commandPrompt();
}

module.exports = { commandPrompt, Banner };