const { v4: uuidv4 } = require("uuid");

module.exports = {
	generateSnowflake() {
		return uuidv4();
	}
};
