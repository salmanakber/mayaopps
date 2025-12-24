// Google Sheets Sync Cron Job
// Run this with node-cron or as a Vercel cron endpoint

import { syncGoogleSheet } from './sheets';
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
          const result = await syncGoogleSheet((config as any).googleSheetId, company.id);
          results.push({
            companyId: company.id,
            companyName: company.name,
            success: true,
            propertiesAdded: result.added,
            propertiesUpdated: result.updated,
            errors: result.errors.length,
          });
          console.log(`[CRON] ✓ Synced ${company.name}: +${result.added} properties, ~${result.updated} updated`);
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
