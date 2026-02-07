#!/usr/bin/env node
/**
 * VENUE ONBOARDING - IMPLEMENTATION VERIFICATION
 * This file serves as a checklist to verify all components are in place
 */

const fs = require("fs");
const path = require("path");

const checks = {
    backend: {
        services: [
            "server/src/services/S3Service.ts",
            "server/src/services/VenueOnboardingService.ts",
        ],
        controllers: ["server/src/controllers/venueOnboardingController.ts"],
        routes: ["server/src/routes/venueOnboardingRoutes.ts"],
        modified: [
            "server/src/models/Venue.ts",
            "server/src/middleware/schemas.ts",
            "server/src/types/index.ts",
            "server/src/server.ts",
        ],
        docs: [
            "server/VENUE_ONBOARDING_README.md",
            "server/IMPLEMENTATION_SUMMARY.md",
            "server/CLIENT_INTEGRATION_GUIDE.md",
            "server/QUICK_REFERENCE.md",
            "server/FILE_MANIFEST.md",
            "server/VERIFICATION_CHECKLIST.md",
        ],
    },
    frontend: {
        components: [
            "client/src/components/onboarding/OnboardingContainer.tsx",
            "client/src/components/onboarding/Step1VenueDetails.tsx",
            "client/src/components/onboarding/Step2ImageUpload.tsx",
            "client/src/components/onboarding/Step3DocumentUpload.tsx",
            "client/src/components/onboarding/AdminVenueApprovalPanel.tsx",
            "client/src/components/onboarding/index.ts",
        ],
        services: ["client/src/lib/onboarding.ts"],
        types: ["client/src/types/onboarding.ts"],
        routes: [
            "client/src/app/venue-lister/onboarding/page.tsx",
            "client/src/app/admin/venue-approval/page.tsx",
        ],
        docs: [
            "client/VENUE_ONBOARDING_FRONTEND_GUIDE.md",
            "client/COMPONENT_ARCHITECTURE.md",
        ],
    },
    root: {
        docs: [
            "DELIVERY_SUMMARY.md",
            "IMPLEMENTATION_COMPLETE.md",
            "COMPLETE_TESTING_GUIDE.md",
            "DOCUMENTATION_INDEX.md",
        ],
    },
};

function checkFile(filePath) {
    try {
        const fullPath = path.join(__dirname, filePath);
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            return { exists: true, size: stats.size };
        }
        return { exists: false };
    } catch (err) {
        return { exists: false, error: err.message };
    }
}

function runVerification() {
    console.log("🔍 VENUE ONBOARDING IMPLEMENTATION VERIFICATION\n");
    console.log("=".repeat(60) + "\n");

    let allPassed = true;
    let totalFiles = 0;
    let foundFiles = 0;

    // Check Backend
    console.log("📦 Backend Files:\n");

    const backendCategories = [
        { name: "Services", files: checks.backend.services },
        { name: "Controllers", files: checks.backend.controllers },
        { name: "Routes", files: checks.backend.routes },
        { name: "Modified Files", files: checks.backend.modified },
        { name: "Documentation", files: checks.backend.docs },
    ];

    for (const category of backendCategories) {
        console.log(`  ${category.name}:`);
        for (const file of category.files) {
            totalFiles++;
            const result = checkFile(file);
            if (result.exists) {
                foundFiles++;
                console.log(`    ✅ ${file} (${result.size} bytes)`);
            } else {
                console.log(`    ❌ ${file} NOT FOUND`);
                allPassed = false;
            }
        }
        console.log("");
    }

    // Check Frontend
    console.log("⚛️  Frontend Files:\n");

    const frontendCategories = [
        { name: "Components", files: checks.frontend.components },
        { name: "Services", files: checks.frontend.services },
        { name: "Types", files: checks.frontend.types },
        { name: "Routes", files: checks.frontend.routes },
        { name: "Documentation", files: checks.frontend.docs },
    ];

    for (const category of frontendCategories) {
        console.log(`  ${category.name}:`);
        for (const file of category.files) {
            totalFiles++;
            const result = checkFile(file);
            if (result.exists) {
                foundFiles++;
                console.log(`    ✅ ${file} (${result.size} bytes)`);
            } else {
                console.log(`    ❌ ${file} NOT FOUND`);
                allPassed = false;
            }
        }
        console.log("");
    }

    // Check Root Documentation
    console.log("📚 Root Documentation:\n");
    for (const file of checks.root.docs) {
        totalFiles++;
        const result = checkFile(file);
        if (result.exists) {
            foundFiles++;
            console.log(`  ✅ ${file} (${result.size} bytes)`);
        } else {
            console.log(`  ❌ ${file} NOT FOUND`);
            allPassed = false;
        }
    }
    console.log("");

    // Summary
    console.log("=".repeat(60) + "\n");
    console.log(`SUMMARY: ${foundFiles}/${totalFiles} files found\n`);

    if (allPassed) {
        console.log("🎉 ✅ ALL FILES VERIFIED - IMPLEMENTATION COMPLETE!\n");
        console.log("Next steps:");
        console.log("  1. Read: DOCUMENTATION_INDEX.md");
        console.log("  2. Start: DELIVERY_SUMMARY.md");
        console.log("  3. Configure: Server environment variables");
        console.log("  4. Test: Follow COMPLETE_TESTING_GUIDE.md");
        console.log("  5. Deploy: Follow VERIFICATION_CHECKLIST.md\n");
    } else {
        console.log("⚠️  ⚠️  SOME FILES MISSING - CHECK ABOVE FOR DETAILS\n");
    }

    console.log("=".repeat(60) + "\n");

    return allPassed ? 0 : 1;
}

// Run verification
const exitCode = runVerification();
process.exit(exitCode);
