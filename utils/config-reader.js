const fs = require('fs');
const path = require('path');

class ConfigReader {
	constructor(configPath) {
		const candidates = [];
		try {
			// exe 옆 (패키징된 환경)
			candidates.push(path.join(path.dirname(process.execPath), 'config.ini'));
			// resources 경로 (설치 패키지 구성 시)
			if (process.resourcesPath) {
				candidates.push(path.join(process.resourcesPath, 'config.ini'));
			}
		} catch (_) { /* no-op */ }
		// 개발 환경 기본 경로
		candidates.push(path.resolve(configPath || './config.ini'));

		let found = null;
		for (const p of candidates) {
			try { if (fs.existsSync(p)) { found = p; break; } } catch (_) { /* ignore */ }
		}

		this.configPath = found || path.resolve(configPath || './config.ini');
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


