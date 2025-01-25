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

    getStatistics() {
        const users = this.getAllUsers();
        const now = new Date();
        
        const stats = {
            totalUsers: users.length,
            activeLastDay: 0,
            activeLastWeek: 0,
            activeLastMonth: 0,
            languageDistribution: {},
            usersByMonth: {},
            usersWithUsername: 0
        };

        users.forEach(user => {
            // Count users by language
            if (user.language_code) {
                stats.languageDistribution[user.language_code] = 
                    (stats.languageDistribution[user.language_code] || 0) + 1;
            }

            // Count users with username
            if (user.username) {
                stats.usersWithUsername++;
            }

            // Parse join date and count monthly registrations
            const joinDate = new Date(user.joined_at);
            const monthKey = `${joinDate.getFullYear()}-${(joinDate.getMonth() + 1).toString().padStart(2, '0')}`;
            stats.usersByMonth[monthKey] = (stats.usersByMonth[monthKey] || 0) + 1;

            // Count active users
            if (user.last_activity) {
                const lastActivity = new Date(user.last_activity);
                const diffHours = (now - lastActivity) / (1000 * 60 * 60);
                
                if (diffHours <= 24) stats.activeLastDay++;
                if (diffHours <= 168) stats.activeLastWeek++;  // 7 days
                if (diffHours <= 720) stats.activeLastMonth++; // 30 days
            }
        });

        return stats;
    }

    updateUserActivity(userId) {
        try {
            const users = this.getAllUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex >= 0) {
                users[userIndex].last_activity = new Date().toISOString();
                fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2));
            }
        } catch (error) {
            console.error('Error updating user activity:', error);
        }
    }

    getUserAnswerStats() {
        const users = this.getAllUsers();
        const stats = {
            totalInteractions: 0,
            genrePreferences: {},
            lengthPreferences: {},
            moodPreferences: {}
        };

        users.forEach(user => {
            if (user.answers) {
                stats.totalInteractions++;
                
                // Count genre preferences
                if (user.answers.genre) {
                    stats.genrePreferences[user.answers.genre] = 
                        (stats.genrePreferences[user.answers.genre] || 0) + 1;
                }
                
                // Count length preferences
                if (user.answers.length) {
                    stats.lengthPreferences[user.answers.length] = 
                        (stats.lengthPreferences[user.answers.length] || 0) + 1;
                }
                
                // Count mood preferences
                if (user.answers.mood) {
                    stats.moodPreferences[user.answers.mood] = 
                        (stats.moodPreferences[user.answers.mood] || 0) + 1;
                }
            }
        });

        return stats;
    }
}

module.exports = new UserManager(); 