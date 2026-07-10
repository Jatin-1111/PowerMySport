const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const domainMapping = {
  client: {
    routes: ['bookingRoutes.ts', 'venueRoutes.ts', 'venueOnboardingRoutes.ts', 'venueInquiryRoutes.ts', 'coachRoutes.ts', 'reviewRoutes.ts', 'notificationRoutes.ts', 'reminderRoutes.ts', 'refundMethodRoutes.ts', 'friendRoutes.ts', 'supportTicketRoutes.ts'],
    controllers: ['friendController.ts', 'reminderController.ts', 'promoCodeController.ts'],
    models: ['Booking.ts', 'BookingInvitation.ts', 'BookingPayment.ts', 'BookingSlotLock.ts', 'BookingWaitlist.ts', 'Venue.ts', 'VenueInquiry.ts', 'Coach.ts', 'CoachPlan.ts', 'CoachSubscription.ts', 'CoachSubscriptionOverrideRequest.ts', 'CoachSubscriptionPackage.ts', 'CoachSubscriptionPayment.ts', 'Notification.ts', 'ScheduledNotification.ts', 'Review.ts', 'SessionPackage.ts', 'SubscriptionPlan.ts', 'SupportTicket.ts', 'User.ts', 'FriendConnection.ts'],
    services: ['BookingService.ts', 'VenueService.ts', 'VenueOnboardingService.ts', 'VenueInquiryService.ts', 'CoachService.ts', 'CoachSubscriptionPackageService.ts', 'CoachSubscriptionPaymentService.ts', 'CoachSubscriptionService.ts', 'NotificationService.ts', 'ScheduledNotificationService.ts', 'pushNotificationService.ts', 'ReviewService.ts', 'FriendService.ts', 'ReminderMonitoringService.ts', 'PromoCodeService.ts', 'RefundService.ts', 'DisputeService.ts'],
    sockets: ['friendSocket.ts', 'notificationSocket.ts']
  },
  community: {
    routes: ['communityRoutes.ts'],
    controllers: ['communityController.ts'],
    models: ['CommunityAnswer.ts', 'CommunityConversation.ts', 'CommunityGroup.ts', 'CommunityMessage.ts', 'CommunityPost.ts', 'CommunityProfile.ts', 'CommunityReport.ts', 'CommunityReputation.ts', 'CommunityVote.ts'],
    services: ['CommunityService.ts', 'CommunityRealtimeService.ts', 'communityPolicy.ts', 'communityQnaUtils.ts'],
    sockets: ['communitySocket.ts']
  },
  admin: {
    routes: ['adminRoutes.ts', 'statsRoutes.ts', 'payoutRoutes.ts', 'payoutMethodsRoutes.ts', 'academyOnboardingRoutes.ts'],
    controllers: ['adminController.ts', 'adminPayoutController.ts', 'payoutController.ts', 'payoutMethodsController.ts', 'statsController.ts'],
    models: ['Admin.ts', 'Academy.ts', 'AnalyticsEvent.ts'],
    services: ['AdminService.ts', 'AcademyOnboardingService.ts', 'AnalyticsService.ts']
  },
  shop: {
    routes: ['ecommerceRoutes.ts'],
    controllers: ['EcommerceController.ts'],
    models: ['Ecommerce.ts'],
    services: ['EcommerceService.ts']
  },
  shared: {
    routes: ['phonepeWebhook.ts'], 
    controllers: ['WebhookController.ts', 'emailVerificationController.ts'],
    models: ['OutboxMessage.ts', 'PaymentWebhookEvent.ts', 'RateLimit.ts', 'Sport.ts', 'EmailVerification.ts'],
    services: ['OutboxService.ts', 'PaymentService.ts', 'PhonePeService.ts', 'S3Service.ts', 'UserPresenceService.ts', 'EmailVerificationService.ts']
  }
};

// Phase 1: Determine new paths without moving them yet
// This allows us to calculate imports based on where the file *will* be and where target files *will* be.
const fileDestinations = {}; // oldAbsolutePath -> newAbsolutePath

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const allFiles = [];
walkDir(srcDir, (filePath) => {
  if (filePath.endsWith('.ts')) {
    allFiles.push(filePath);
    fileDestinations[filePath] = filePath; // Default: no move
  }
});

for (const [domain, folders] of Object.entries(domainMapping)) {
  for (const [folder, files] of Object.entries(folders)) {
    for (const file of files) {
      const oldPath = path.join(srcDir, folder, file);
      const newPath = path.join(srcDir, domain, folder, file);
      if (fs.existsSync(oldPath)) {
        fileDestinations[oldPath] = newPath;
      }
    }
  }
}

// Map of old absolute directory paths to new absolute directory paths for the import resolution
// Wait, an import points to an *old* file path. We can resolve the *old* absolute file path,
// look up where it's moving (or if it's moving), and then calculate the new relative path from the *new* location.

console.log("Analyzing and updating files...");

function resolveImport(currentFileOldPath, currentFileNewPath, importPath) {
  if (!importPath.startsWith('.')) return importPath; // Not a relative import

  const oldTargetAbsDir = path.dirname(currentFileOldPath);
  let targetOldPathBase = path.resolve(oldTargetAbsDir, importPath);
  
  // The import might not have an extension. Let's find the matching file.
  let targetFileOldPath = targetOldPathBase;
  if (fs.existsSync(targetOldPathBase + '.ts')) {
    targetFileOldPath = targetOldPathBase + '.ts';
  } else if (fs.existsSync(path.join(targetOldPathBase, 'index.ts'))) {
    targetFileOldPath = path.join(targetOldPathBase, 'index.ts');
  } else {
    // maybe it's a directory or a missing file, just try to map it using the base
    // If we can't find it exactly, we assume it moved based on its prefix? No, it's safer to just check if the .ts exists.
    // What if it's a type import like `../types/User`? 
    // We can just iterate fileDestinations keys and see if they match the base without extension.
  }

  // Find the exact old path key in our mapping
  const possibleKeys = [
    targetOldPathBase + '.ts',
    targetOldPathBase + '.d.ts',
    path.join(targetOldPathBase, 'index.ts'),
    targetOldPathBase // maybe it's a directory import that wasn't moved, or we'll just handle it as a prefix
  ];

  let targetNewPath = null;
  for (let key of possibleKeys) {
    if (fileDestinations[key]) {
      targetNewPath = fileDestinations[key];
      break;
    }
  }

  // If we couldn't find an exact file, maybe it's a directory that didn't move
  if (!targetNewPath) {
    targetNewPath = targetOldPathBase; 
  } else {
    // targetNewPath is the new absolute path of the file.
    // We need to strip the extension if the original didn't have one
    targetNewPath = targetNewPath.replace(/\.d\.ts$/, '').replace(/\.ts$/, '');
    if (importPath.endsWith('/index')) {
      targetNewPath = targetNewPath.replace(/[\\/]index$/, '');
    }
  }

  // Calculate new relative path
  const newCurrentDir = path.dirname(currentFileNewPath);
  let newRelativePath = path.relative(newCurrentDir, targetNewPath).replace(/\\/g, '/');
  
  if (!newRelativePath.startsWith('.')) {
    newRelativePath = './' + newRelativePath;
  }
  
  return newRelativePath;
}

const fileContents = {};

// Phase 2: Read and replace in memory
for (const [oldPath, newPath] of Object.entries(fileDestinations)) {
  let content = fs.readFileSync(oldPath, 'utf-8');
  
  // Replace imports: import { X } from '../y';
  content = content.replace(/(from\s+['"])(.*?)(['"])/g, (match, p1, p2, p3) => {
    return p1 + resolveImport(oldPath, newPath, p2) + p3;
  });
  
  // Replace imports: import '../y';
  content = content.replace(/(import\s+['"])(.*?)(['"])/g, (match, p1, p2, p3) => {
    return p1 + resolveImport(oldPath, newPath, p2) + p3;
  });

  // Replace dynamic imports
  content = content.replace(/(import\(['"])(.*?)(['"]\))/g, (match, p1, p2, p3) => {
    return p1 + resolveImport(oldPath, newPath, p2) + p3;
  });

  // Replace requires
  content = content.replace(/(require\(['"])(.*?)(['"]\))/g, (match, p1, p2, p3) => {
    return p1 + resolveImport(oldPath, newPath, p2) + p3;
  });

  fileContents[newPath] = content;
}

// Phase 3: Create directories and write files
console.log("Writing new structure...");

for (const [domain, folders] of Object.entries(domainMapping)) {
  const domainDir = path.join(srcDir, domain);
  if (!fs.existsSync(domainDir)) fs.mkdirSync(domainDir, { recursive: true });
  for (const [folder, files] of Object.entries(folders)) {
    const domainFolderDir = path.join(domainDir, folder);
    if (!fs.existsSync(domainFolderDir)) fs.mkdirSync(domainFolderDir, { recursive: true });
  }
}

// Write the files to their new locations
for (const [oldPath, newPath] of Object.entries(fileDestinations)) {
  // ensure directory exists
  const dir = path.dirname(newPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(newPath, fileContents[newPath]);
  
  // delete old file if it was moved
  if (oldPath !== newPath && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }
}

console.log("Done refactoring files!");
