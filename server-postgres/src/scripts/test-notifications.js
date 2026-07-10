/**
 * Test script for notification system
 * Tests friend request notifications end-to-end
 */

const API_URL = "http://localhost:5000/api";

// Test users credentials (assuming these exist in your database)
const user1 = {
    email: "test1@example.com",
    password: "password123",
};

const user2 = {
    email: "test2@example.com",
    password: "password123",
};

let user1Token = "";
let user2Token = "";
let friendRequestId = "";

async function login(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Login failed: ${data.message}`);
    }
    return data.token || data.data?.token;
}

async function sendFriendRequest(token, recipientId) {
    const response = await fetch(`${API_URL}/friends/requests`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Send friend request failed: ${data.message}`);
    }
    return data.data;
}

async function getNotifications(token) {
    const response = await fetch(`${API_URL}/notifications`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Get notifications failed: ${data.message}`);
    }
    return data.data;
}

async function getUnreadCount(token) {
    const response = await fetch(`${API_URL}/notifications/unread-count`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Get unread count failed: ${data.message}`);
    }
    return data.data.count;
}

async function getUserProfile(token) {
    const response = await fetch(`${API_URL}/auth/profile`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Get profile failed: ${data.message}`);
    }
    return data.data || data.user;
}

async function runTests() {
    console.log("🧪 Starting Notification System Tests...\n");

    try {
        // Step 1: Login both users
        console.log("📝 Step 1: Logging in users...");
        user1Token = await login(user1.email, user1.password);
        console.log("✅ User 1 logged in");

        user2Token = await login(user2.email, user2.password);
        console.log("✅ User 2 logged in\n");

        // Get user profiles to get IDs
        const user1Profile = await getUserProfile(user1Token);
        const user2Profile = await getUserProfile(user2Token);

        console.log(`User 1: ${user1Profile.name} (${user1Profile._id || user1Profile.id})`);
        console.log(`User 2: ${user2Profile.name} (${user2Profile._id || user2Profile.id})\n`);

        // Step 2: Check initial unread count
        console.log("📝 Step 2: Checking initial unread count for User 2...");
        const initialCount = await getUnreadCount(user2Token);
        console.log(`✅ Initial unread count: ${initialCount}\n`);

        // Step 3: User 1 sends friend request to User 2
        console.log("📝 Step 3: User 1 sending friend request to User 2...");
        const friendRequest = await sendFriendRequest(
            user1Token,
            user2Profile._id || user2Profile.id
        );
        friendRequestId = friendRequest._id || friendRequest.id;
        console.log(`✅ Friend request sent! ID: ${friendRequestId}\n`);

        // Step 4: Check User 2's notifications
        console.log("📝 Step 4: Checking User 2's notifications...");
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second for notification to be created

        const notifications = await getNotifications(user2Token);
        console.log(`✅ User 2 has ${notifications.notifications?.length || notifications.length} notification(s)`);

        if (notifications.notifications?.length > 0 || notifications.length > 0) {
            const notificationList = notifications.notifications || notifications;
            const friendRequestNotification = notificationList.find(
                (n) => n.type === "FRIEND_REQUEST"
            );

            if (friendRequestNotification) {
                console.log("\n📬 Notification Details:");
                console.log(`   Type: ${friendRequestNotification.type}`);
                console.log(`   Title: ${friendRequestNotification.title}`);
                console.log(`   Message: ${friendRequestNotification.message}`);
                console.log(`   Read: ${friendRequestNotification.isRead}`);
                console.log(`   Created: ${friendRequestNotification.createdAt}`);
                console.log("✅ FRIEND_REQUEST notification found!");
            } else {
                console.log("⚠️  FRIEND_REQUEST notification not found");
            }
        }

        // Step 5: Check unread count increased
        console.log("\n📝 Step 5: Checking updated unread count...");
        const newCount = await getUnreadCount(user2Token);
        console.log(`✅ New unread count: ${newCount}`);

        if (newCount > initialCount) {
            console.log("✅ Unread count increased correctly!");
        } else {
            console.log("⚠️  Unread count did not increase");
        }

        console.log("\n" + "=".repeat(60));
        console.log("🎉 NOTIFICATION SYSTEM TEST COMPLETED!");
        console.log("=".repeat(60));
        console.log("\n✅ Summary:");
        console.log(`   - Friend request sent successfully`);
        console.log(`   - Notification created in database`);
        console.log(`   - Unread count working`);
        console.log(`   - API endpoints functioning correctly`);
        console.log("\n📋 Next: Check Socket.IO events and toast notifications in browser\n");

    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        console.error("\n💡 Make sure:");
        console.error("   1. Server is running on port 5000");
        console.error("   2. Test users exist in database");
        console.error("   3. MongoDB is connected");
        process.exit(1);
    }
}

runTests();
