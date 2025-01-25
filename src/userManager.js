const fs = require('fs');
const path = require('path');

class UserManager {
    constructor() {
        this.dataPath = path.join(__dirname, '../data');
        this.usersFile = path.join(this.dataPath, 'users.json');
        this.initializeDataDirectory();
    }

    initializeDataDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath);
        }
        if (!fs.existsSync(this.usersFile)) {
            fs.writeFileSync(this.usersFile, JSON.stringify([], null, 2));
        }
    }

    saveUser(userData) {
        try {
            const users = this.getAllUsers();
            const existingUserIndex = users.findIndex(u => u.id === userData.id);
            
            if (existingUserIndex >= 0) {
                users[existingUserIndex] = { ...users[existingUserIndex], ...userData };
            } else {
                users.push(userData);
            }
            
            fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    getAllUsers() {
        try {
            const data = fs.readFileSync(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading users data:', error);
            return [];
        }
    }

    async broadcastMessage(bot, message) {
        const users = this.getAllUsers();
        const results = {
            success: 0,
            failed: 0
        };

        for (const user of users) {
            try {
                await bot.telegram.sendMessage(user.id, message);
                results.success++;
            } catch (error) {
                console.error(`Failed to send message to user ${user.id}:`, error);
                results.failed++;
            }
            // Add a small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return results;
    }
}

module.exports = new UserManager(); 