// Google Sheets Sync Cron Job
// Run this with node-cron or as a Vercel cron endpoint

import { fetchSheetData } from './sheets';
import prisma from './prisma';

export async function runSheetsSyncForAllCompanies() {
  console.log('[CRON] Starting Google Sheets sync for all companies...');
  
  try {
    const companies = await prisma.company.findMany({
      where: { subscriptionStatus: 'active' },
      select: { id: true, name: true },
    });

    console.log(`[CRON] Found ${companies.length} active companies`);

    const results = [];
    for (const company of companies) {
      try {
        // Get company's Google Sheets config
        const config = await prisma.adminConfiguration.findUnique({
          where: { companyId: company.id },
        });

        if (config && (config as any).googleSheetId) {
          const result = await fetchSheetData((config as any).googleSheetId, "Sheet1!A1:F10000" as string);
          if (result.length > 0) {
          results.push({
            companyId: company.id,
              companyName: company.name,
              success: true,
              propertiesAdded: result.length,
              propertiesUpdated: result.length,
              errors: 0,
            });
            console.log(`[CRON] ✓ Synced ${company.name}: +${result.length} properties, ~${result.length} updated`);
          }
        }
      } catch (error: any) {
        console.error(`[CRON] ✗ Error syncing ${company.name}:`, error.message);
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: false,
          error: error.message,
        });
      }
    }

    console.log('[CRON] Sheets sync completed');
    return results;
  } catch (error) {
    console.error('[CRON] Fatal error in sheets sync:', error);
    throw error;
  }
}

// For Vercel Cron or API route
export async function handleSheetsSyncCron() {
  const results = await runSheetsSyncForAllCompanies();
  return {
    success: true,
    timestamp: new Date().toISOString(),
    results,
  };
}
