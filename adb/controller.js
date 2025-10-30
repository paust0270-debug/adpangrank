const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class ADBController {
	constructor(adbPath) {
		this.adbPath = adbPath;
	}

	async enableAirplaneMode() {
		try {
			await execPromise(`${this.adbPath} shell cmd connectivity airplane-mode enable`);
			console.log('✈️ 비행기모드 켜기 완료');
			return true;
		} catch (error) {
			console.error('❌ 비행기모드 켜기 실패:', error.message);
			return false;
		}
	}

	async disableAirplaneMode() {
		try {
			await execPromise(`${this.adbPath} shell cmd connectivity airplane-mode disable`);
			console.log('📶 비행기모드 끄기 완료');
			return true;
		} catch (error) {
			console.error('❌ 비행기모드 끄기 실패:', error.message);
			return false;
		}
	}

	async changeIp() {
		console.log('🔄 IP 변경 시작...');
		await this.enableAirplaneMode();
		await this.sleep(5000);
		await this.disableAirplaneMode();
		await this.sleep(10000);
		const newIp = await this.getCurrentIp();
		console.log(`✅ IP 변경 완료: ${newIp}`);
		return newIp;
	}

	async getCurrentIp() {
		try {
			const res = await fetch('https://api.ipify.org?format=json');
			const data = await res.json();
			return data.ip;
		} catch (error) {
			console.error('❌ IP 조회 실패:', error.message);
			return null;
		}
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

module.exports = ADBController;


