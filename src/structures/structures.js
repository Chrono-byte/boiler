// import eventemitter 
const EventEmitter = require('events');

class Message {
    constructor(content, author, channel) {
        this.content = content;
        this.author = author;
        this.channel = channel;

        this.createdAt = new Date();

        this.reply = false;
    }
} 

class BaseChannel extends EventEmitter {
    constructor() {
        super();
    }

    send(message) {
        throw new Error("Not implemented");
    }
}

class Member extends BaseChannel {
    constructor(id, username) {
        super();
        this.id = id;
        this.username = username;

        this.joinedAt = new Date();
        this.avatarURL = null;

        this.permissions = {
            ADMINISTRATOR: false,
            MANAGE_CHANNELS: false,
            MANAGE_MESSAGES: false
        }
    }

    send(message) {
        throw new Error("Not implemented");
    }
}

class User extends Member {
    constructor(id, username) {
        super(id, username);
    }

    send(message) {
        throw new Error("Not implemented");
    }
}

class Channel extends BaseChannel {
    constructor(name, description) {
        super();
        this.name = name;
        this.description = description;

        this.members = new Map();

        this.owner = null;
    }

    addMember(member) {
        this.members.set(member.id, member);
    }

    removeMember(member) {
        this.members.delete(member.id);
    }

    setOwner(member) {
        this.owner = member;
    }

    sendAll(message) {
        this.members.forEach(member => {
            member.send(message);
        });
    }

    broadcast(message) {
        this.members.forEach(member => {
            if (member.id !== this.owner.id) {
                member.send(message);
            }
        });
    }
}

module.exports = { Message, BaseChannel, Member, User, Channel };