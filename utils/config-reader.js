const fs = require('fs');
const path = require('path');

class ConfigReader {
	constructor(configPath) {
		this.configPath = path.resolve(configPath);
		this.config = this.parse(this.configPath);
	}

	parse(filePath) {
		if (!fs.existsSync(filePath)) {
			return {};
		}
		const content = fs.readFileSync(filePath, 'utf-8');
		const config = {};
		let currentSection = null;

		content.split(/\r?\n/).forEach((rawLine) => {
			let line = rawLine.trim();
			if (!line || line.startsWith('#') || line.startsWith(';')) {
				return;
			}
			if (line.startsWith('[') && line.endsWith(']')) {
				currentSection = line.slice(1, -1).trim();
				if (!config[currentSection]) {
					config[currentSection] = {};
				}
				return;
			}
			if (currentSection) {
				const eqIndex = line.indexOf('=');
				if (eqIndex === -1) return;
				const key = line.slice(0, eqIndex).trim();
				const value = line.slice(eqIndex + 1).trim();
				config[currentSection][key] = value;
			}
		});

		return config;
	}

	get(section, key) {
		return this.config[section] && this.config[section][key] ? this.config[section][key] : null;
	}

	getSection(section) {
		return this.config[section] || {};
	}

	getAllConfig() {
		return this.config;
	}
}

module.exports = ConfigReader;


