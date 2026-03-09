/**
 * MANUAL TEST FOR NOTIFICATION SYSTEM
 * 
 * This guide will walk you through testing the notification system manually using Postman or curl.
 * 
 * Available Test Users:
 * - User A: Jatin (off.jatin1111@gmail.com)
 * - User B: Rahul (rahul.khandelwal@jujuscafes.com)
 */

const API_BASE_URL = "http://localhost:5000/api";

console.log("==================================================");
console.log("🧪  NOTIFICATION SYSTEM MANUAL TEST GUIDE");
console.log("==================================================\n");

console.log("📋 Test Scenario: Friend Request Notifications\n");

console.log("STEP 1: Login as User A (Jatin)");
console.log("----------------------------------------");
console.log("POST", API_BASE_URL + "/auth/login");
console.log("Body:");
console.log(JSON.stringify({
    email: "off.jatin1111@gmail.com",
    password: "[ASK USER FOR PASSWORD]"
}, null, 2));
console.log("\n📝 Copy the 'token' from the response\n");

console.log("STEP 2: Login as User B (Rahul)");
console.log("----------------------------------------");
console.log("POST", API_BASE_URL + "/auth/login");
console.log("Body:");
console.log(JSON.stringify({
    email: "rahul.khandelwal@jujuscafes.com",
    password: "[ASK USER FOR PASSWORD]"
}, null, 2));
console.log("\n📝 Copy the 'token' from the response\n");

console.log("STEP 3: Check User B's initial notifications");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n📝 Note the count of notifications\n");

console.log("STEP 4: Check User B's unread count");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications/unread-count");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n📝 Note the initial unread count\n");

console.log("STEP 5: User A sends friend request to User B");
console.log("----------------------------------------");
console.log("POST", API_BASE_URL + "/friends/requests");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_A_TOKEN]");
console.log("  Content-Type: application/json");
console.log("Body:");
console.log(JSON.stringify({
    recipientId: "69a2bfa953d8fd15beddbce9" // Rahul's ID
}, null, 2));
console.log("\n✅ Friend request should be sent\n");

console.log("STEP 6: Check User B's notifications again");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n✅ You should see a new FRIEND_REQUEST notification\n");

console.log("STEP 7: Check User B's unread count again");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications/unread-count");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n✅ Unread count should have increased by 1\n");

console.log("STEP 8: Get friend request details");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/friends/requests/pending");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n📝 Copy the friend request ID\n");

console.log("STEP 9: Accept the friend request");
console.log("----------------------------------------");
console.log("POST", API_BASE_URL + "/friends/requests/[FRIEND_REQUEST_ID]/accept");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_B_TOKEN]");
console.log("\n✅ Friend request should be accepted\n");

console.log("STEP 10: Check User A's notifications");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_A_TOKEN]");
console.log("\n✅ User A should now have a FRIEND_REQUEST_ACCEPTED notification\n");

console.log("STEP 11: Check User A's unread count");
console.log("----------------------------------------");
console.log("GET", API_BASE_URL + "/notifications/unread-count");
console.log("Headers:");
console.log("  Authorization: Bearer [USER_A_TOKEN]");
console.log("\n✅ User A should have an unread notification\n");

console.log("\n==================================================");
console.log("🎯 EXPECTED RESULTS:");
console.log("==================================================");
console.log("✅ Notification created in MongoDB");
console.log("✅ Unread counts updated correctly");
console.log("✅ Both users can see their notifications via API");
console.log("✅ Notification data includes correct user information");
console.log("\n==================================================");
console.log("🔧 To test Socket.IO events:");
console.log("==================================================");
console.log("1. Start the client app: cd client && npm run dev");
console.log("2. Open browser console and watch for socket events");
console.log("3. Send a friend request");
console.log("4. You should see a toast notification appear");
console.log("5. Check console for 'notification:new' event");
console.log("==================================================\n");
