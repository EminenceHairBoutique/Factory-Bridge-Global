// Public home page (B-31). Copy lives in src/site/content.ts and is limited by PRD §7 / master spec §2.1:
// no "U.S.-based" claim before OQ-02, no counters, testimonials, logos, savings, SLAs or guarantees.
import { inquiryMode } from "@/server/inquiry/config";
import { SiteHome } from "@/site/components/SiteHome";

export default function HomePage() {
  // Only the delivery *mode* reaches the page; keys and addresses stay in the server action.
  return <SiteHome inquiryMode={inquiryMode(process.env)} />;
}
