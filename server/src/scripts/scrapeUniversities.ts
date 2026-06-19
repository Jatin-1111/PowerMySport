import axios from "axios";
import mongoose from "mongoose";
import "dotenv/config";
import { SportPathway } from "../shared/models/SportPathway";

// For the Department of Education College Scorecard API
// https://collegescorecard.ed.gov/data/api/
const ED_GOV_API_KEY = process.env.ED_GOV_API_KEY || "DEMO_KEY";
const ED_GOV_BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools.json";

/**
 * Interface for the expected College Scorecard API response
 */
interface EdGovSchoolData {
  id: number;
  school: {
    name: string;
    city: string;
    state: string;
    zip: string;
  };
  latest: {
    admissions: {
      admission_rate: {
        overall: number;
      };
      sat_scores: {
        midpoint: {
          math: number;
          critical_reading: number;
        };
      };
    };
    cost: {
      tuition: {
        in_state: number;
        out_of_state: number;
      };
    };
  };
}

/**
 * Fetch academic data for a specific university from the US Dept of Education API
 */
async function fetchAcademicData(universityName: string): Promise<EdGovSchoolData | null> {
  try {
    const response = await axios.get(ED_GOV_BASE_URL, {
      params: {
        api_key: ED_GOV_API_KEY,
        "school.name": universityName,
        fields: "id,school.name,school.city,school.state,latest.admissions.admission_rate.overall,latest.admissions.sat_scores.midpoint,latest.cost.tuition",
        per_page: 1,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0] as EdGovSchoolData;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching data for ${universityName} from Ed.gov API:`, error);
    return null;
  }
}

/**
 * Mocking a web scraper that would fetch athletic directories (e.g., from NCAA directories or similar)
 */
async function scrapeAthleticDirectory(sportSlug: string) {
  console.log(`🔍 Scraping University Athletic Directory for sport: ${sportSlug}...`);
  
  // Simulated scraped data for MVP purposes
  // In a real scenario, this would use Cheerio to parse a site like ncaa.org/directory
  return [
    {
      name: "Stanford University",
      sportsQuotaDetails: "NCAA Division I. Offers up to 4.5 full scholarships for men's tennis.",
    },
    {
      name: "University of Southern California",
      sportsQuotaDetails: "NCAA Division I. Highly competitive Pac-12 programs.",
    },
    {
      name: "University of Texas at Austin",
      sportsQuotaDetails: "NCAA Division I. Top-tier facilities and coaching.",
    }
  ];
}

/**
 * Main execution function
 */
async function runUniversityScraper() {
  console.log("🚀 Starting University Athletic & Academic Data Pipeline...");

  // Connect to database
  const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/powermysport";
  try {
    await mongoose.connect(dbUri);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }

  const pathways = await SportPathway.find({}).select('sportSlug sportName').lean();
  
  if (!pathways || pathways.length === 0) {
    console.warn("No sports pathways found in database. Skipping university scraper.");
    return;
  }

  const SPORTS = pathways.map((p: any) => p.sportSlug);

  for (const sportSlug of SPORTS) {
    console.log(`\n============== Processing Sport: ${sportSlug.toUpperCase()} ==============`);
    
    // Step 1: Scrape Athletic Directory
    const athleticData = await scrapeAthleticDirectory(sportSlug);

    // Step 2: Enrich with US Dept of Education Academic Data
    console.log(`\n📡 Enriching ${sportSlug} with Academic Data from US Dept of Education API...`);
    
    const enrichedUniversities = [];

    for (const uni of athleticData) {
      console.log(`Fetching academic stats for ${uni.name}...`);
      
      const academicStats = await fetchAcademicData(uni.name);
      
      let admissionCriteria = "Academic criteria varies.";
      let location = "United States";
      
      if (academicStats) {
        location = `${academicStats.school.city}, ${academicStats.school.state}`;
        
        const adminRate = academicStats.latest.admissions?.admission_rate?.overall;
        const mathSat = academicStats.latest.admissions?.sat_scores?.midpoint?.math;
        const readingSat = academicStats.latest.admissions?.sat_scores?.midpoint?.critical_reading;
        
        const adminRateStr = adminRate ? `${(adminRate * 100).toFixed(1)}%` : "Unknown";
        const satStr = (mathSat && readingSat) ? `${mathSat + readingSat}` : "Varies";
        
        admissionCriteria = `Highly competitive. Acceptance Rate: ${adminRateStr}. Average SAT: ${satStr}. Minimum GPA requirements apply for NCAA eligibility.`;
      } else {
        // Fallback mock data if API key is invalid
        console.log(`⚠️ Using fallback academic data for ${uni.name}`);
        if (uni.name.includes("Stanford")) {
          location = "Stanford, CA";
          admissionCriteria = "Highly competitive. Acceptance Rate: 4%. Average SAT: 1500+. Minimum 3.9 GPA.";
        } else if (uni.name.includes("Southern California")) {
          location = "Los Angeles, CA";
          admissionCriteria = "Highly competitive. Acceptance Rate: 12%. Average SAT: 1440+. Minimum 3.7 GPA.";
        } else {
          location = "Austin, TX";
          admissionCriteria = "Competitive. Acceptance Rate: 32%. Average SAT: 1350+. Minimum 3.5 GPA.";
        }
      }

      enrichedUniversities.push({
        name: uni.name,
        location,
        admissionCriteria,
        sportsQuotaDetails: uni.sportsQuotaDetails,
      });
    }

    // Step 3: Save to Database
    console.log(`\n💾 Saving ${sportSlug} to database...`);
    if (mongoose.connection.readyState === 1) {
      try {
        const pathway = await SportPathway.findOne({ sportSlug });
        if (pathway) {
          pathway.universities = enrichedUniversities;
          await pathway.save();
          console.log(`✅ Successfully updated universities for ${sportSlug} pathway!`);
        } else {
          console.warn(`⚠️ Pathway for ${sportSlug} not found in database. Data not saved.`);
        }
      } catch (error) {
        console.error(`❌ Database save error for ${sportSlug}:`, error);
      }
    } else {
      console.log(`DRY RUN RESULTS FOR ${sportSlug.toUpperCase()}:`);
      console.dir(enrichedUniversities, { depth: null });
    }
  }

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  console.log("🏁 Pipeline Complete.");
}

// Allow running directly
if (require.main === module) {
  runUniversityScraper();
}

export { runUniversityScraper };
