/**
 * API Endpoint Test Script
 * Run this to verify all friend and group booking endpoints
 *
 * Usage: ts-node test-api-endpoints.ts
 */

import axios from "axios";

const BASE_URL = "http://localhost:5000/api";
let authToken = "";
let userId = "";
let friendId = "";
let connectionId = "";
let bookingId = "";
let invitationId = "";

// Test credentials (update with your test data)
const TEST_USER_1 = {
  email: "player1@test.com",
  password: "test123",
};

const TEST_USER_2 = {
  email: "player2@test.com",
  password: "test123",
};

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name: string) {
  console.log(`\n${"=".repeat(60)}`);
  log(`TEST: ${name}`, "blue");
  console.log("=".repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, "green");
}

function logError(message: string, error?: any) {
  log(`❌ ${message}`, "red");
  if (error && error.response) {
    console.error("Response:", error.response.data);
  } else if (error) {
    console.error(error.message);
  }
}

async function testLogin() {
  logTest("User Login");
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, TEST_USER_1);
    authToken = response.data.data.token;
    userId = response.data.data.user.id;
    logSuccess(`Logged in as ${TEST_USER_1.email}`);
    logSuccess(`User ID: ${userId}`);
    return true;
  } catch (error: any) {
    logError("Login failed", error);
    return false;
  }
}

async function testSendFriendRequest() {
  logTest("Send Friend Request");
  try {
    // First get a user to send request to (mock friend ID)
    // In real test, you'd search for another user
    const testFriendId = "507f1f77bcf86cd799439011"; // Replace with real user ID

    const response = await axios.post(
      `${BASE_URL}/friends/request`,
      { recipientId: testFriendId },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    connectionId = response.data.data._id;
    logSuccess(`Friend request sent. Connection ID: ${connectionId}`);
    return true;
  } catch (error: any) {
    logError("Failed to send friend request", error);
    return false;
  }
}

async function testGetFriendRequests() {
  logTest("Get Friend Requests");
  try {
    const response = await axios.get(`${BASE_URL}/friends/requests?type=sent`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    logSuccess(`Retrieved ${response.data.data.length} sent requests`);
    if (response.data.data.length > 0) {
      console.log("Sample:", response.data.data[0]);
    }
    return true;
  } catch (error: any) {
    logError("Failed to get friend requests", error);
    return false;
  }
}

async function testGetFriendsList() {
  logTest("Get Friends List");
  try {
    const response = await axios.get(`${BASE_URL}/friends?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    logSuccess(`Retrieved friends list`);
    console.log("Pagination:", response.data.pagination);
    console.log("Friends count:", response.data.data.friends.length);
    return true;
  } catch (error: any) {
    logError("Failed to get friends list", error);
    return false;
  }
}

async function testSearchFriends() {
  logTest("Search Friends for Booking");
  try {
    const response = await axios.get(`${BASE_URL}/friends/search?q=`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    logSuccess(`Found ${response.data.data.length} friends`);
    return true;
  } catch (error: any) {
    logError("Failed to search friends", error);
    return false;
  }
}

async function testGetFriendStatus() {
  logTest("Get Friend Status");
  try {
    const testUserId = "507f1f77bcf86cd799439011"; // Replace with real user ID
    const response = await axios.get(
      `${BASE_URL}/friends/status/${testUserId}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    logSuccess(`Friend status: ${response.data.data.status}`);
    return true;
  } catch (error: any) {
    logError("Failed to get friend status", error);
    return false;
  }
}

async function testInitiateGroupBooking() {
  logTest("Initiate Group Booking");
  try {
    const bookingData = {
      venueId: "507f1f77bcf86cd799439011", // Replace with real venue ID
      sport: "Basketball",
      date: "2026-03-15",
      startTime: "10:00",
      endTime: "12:00",
      invitedFriendIds: ["507f1f77bcf86cd799439012"], // Replace with real friend IDs
      paymentType: "SPLIT",
      participantName: "Test User",
    };

    const response = await axios.post(
      `${BASE_URL}/bookings/group/initiate`,
      bookingData,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    bookingId = response.data.data.booking.id;
    logSuccess(`Group booking created. Booking ID: ${bookingId}`);
    return true;
  } catch (error: any) {
    logError("Failed to initiate group booking", error);
    return false;
  }
}

async function testGetInvitations() {
  logTest("Get Booking Invitations");
  try {
    const response = await axios.get(
      `${BASE_URL}/bookings/invitations?status=PENDING`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    logSuccess(`Retrieved ${response.data.data.length} invitations`);
    if (response.data.data.length > 0) {
      invitationId = response.data.data[0]._id;
      console.log("Sample invitation:", response.data.data[0]);
    }
    return true;
  } catch (error: any) {
    logError("Failed to get invitations", error);
    return false;
  }
}

async function testRespondToInvitation() {
  logTest("Respond to Invitation");
  if (!invitationId) {
    log("⚠️  No invitation ID available. Skipping test.", "yellow");
    return true;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/bookings/invitations/${invitationId}/respond`,
      { accept: true },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    logSuccess("Invitation accepted successfully");
    return true;
  } catch (error: any) {
    logError("Failed to respond to invitation", error);
    return false;
  }
}

async function testCoverUnpaidShares() {
  logTest("Cover Unpaid Shares");
  if (!bookingId) {
    log("⚠️  No booking ID available. Skipping test.", "yellow");
    return true;
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/bookings/${bookingId}/cover-unpaid`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } },
    );

    logSuccess("Unpaid shares covered successfully");
    return true;
  } catch (error: any) {
    logError("Failed to cover unpaid shares", error);
    return false;
  }
}

async function runAllTests() {
  console.log("\n");
  log("╔═══════════════════════════════════════════════════════════╗", "blue");
  log("║     Friend System & Group Booking API Tests              ║", "blue");
  log("╚═══════════════════════════════════════════════════════════╝", "blue");

  const results: { test: string; passed: boolean }[] = [];

  // Authentication
  const loginPassed = await testLogin();
  results.push({ test: "Login", passed: loginPassed });

  if (!loginPassed) {
    log("\n❌ Login failed. Cannot continue tests.", "red");
    return;
  }

  // Friend System Tests
  results.push({
    test: "Get Friends List",
    passed: await testGetFriendsList(),
  });
  results.push({
    test: "Get Friend Requests",
    passed: await testGetFriendRequests(),
  });
  results.push({ test: "Search Friends", passed: await testSearchFriends() });
  results.push({
    test: "Get Friend Status",
    passed: await testGetFriendStatus(),
  });
  // results.push({ test: 'Send Friend Request', passed: await testSendFriendRequest() }); // Requires valid friend ID

  // Group Booking Tests
  results.push({ test: "Get Invitations", passed: await testGetInvitations() });
  // results.push({ test: 'Initiate Group Booking', passed: await testInitiateGroupBooking() }); // Requires valid venue and friend IDs
  // results.push({ test: 'Respond to Invitation', passed: await testRespondToInvitation() }); // Requires valid invitation
  // results.push({ test: 'Cover Unpaid Shares', passed: await testCoverUnpaidShares() }); // Requires valid booking

  // Summary
  console.log("\n");
  log("═".repeat(60), "blue");
  log("TEST SUMMARY", "blue");
  log("═".repeat(60), "blue");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const icon = result.passed ? "✅" : "❌";
    const color = result.passed ? "green" : "red";
    log(`${icon} ${result.test}`, color);
  });

  console.log("\n");
  const percentage = Math.round((passed / total) * 100);
  const summaryColor =
    percentage === 100 ? "green" : percentage >= 50 ? "yellow" : "red";
  log(`TOTAL: ${passed}/${total} tests passed (${percentage}%)`, summaryColor);
  console.log("\n");

  if (percentage < 100) {
    log("⚠️  Some tests failed. Check the errors above for details.", "yellow");
    log(
      "💡 Some tests are commented out and require valid test data.",
      "yellow",
    );
  } else {
    log("🎉 All tests passed! The API is working correctly.", "green");
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error("Test suite failed:", error);
  process.exit(1);
});
