/**
 * Cleanup script for Bunny Stream videos and Bunny Storage files.
 * Default mode is DRY-RUN. To execute deletion, pass --execute.
 *
 * Usage:
 *   npx tsx scripts/cleanup-bunny-storage.ts
 *   npx tsx scripts/cleanup-bunny-storage.ts --execute
 */

const isExecute = process.argv.includes("--execute");

async function cleanupBunnyStream() {
  console.log("\n==================================================");
  console.log("1. BUNNY STREAM VIDEO CLEANUP");
  console.log("==================================================");

  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const streamApiKey = process.env.BUNNY_STREAM_API_KEY;

  if (!libraryId || !streamApiKey) {
    console.log("[Bunny Stream] BUNNY_STREAM_LIBRARY_ID or BUNNY_STREAM_API_KEY not configured. Skipping.");
    return;
  }

  try {
    const listRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=100`,
      {
        headers: {
          AccessKey: streamApiKey,
          Accept: "application/json",
        },
      }
    );

    if (!listRes.ok) {
      console.error(`[Bunny Stream] Failed to list videos (HTTP ${listRes.status}):`, await listRes.text());
      return;
    }

    const data = (await listRes.json()) as { items?: Array<{ guid: string; title: string; length: number }> };
    const videos = data.items || [];

    console.log(`Found ${videos.length} video(s) in Bunny Stream Library (${libraryId}).`);

    for (const vid of videos) {
      if (isExecute) {
        console.log(`[DELETING] Video: ${vid.guid} (${vid.title})...`);
        const delRes = await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${vid.guid}`,
          {
            method: "DELETE",
            headers: { AccessKey: streamApiKey },
          }
        );
        if (delRes.ok) {
          console.log(`  ✓ Successfully deleted video ${vid.guid}`);
        } else {
          console.error(`  ✗ Failed to delete video ${vid.guid} (HTTP ${delRes.status})`);
        }
      } else {
        console.log(`[DRY-RUN] Would delete video: ${vid.guid} - "${vid.title}" (${vid.length}s)`);
      }
    }
  } catch (err: any) {
    console.error("[Bunny Stream] Network error:", err.message);
  }
}

async function cleanupBunnyStorage() {
  console.log("\n==================================================");
  console.log("2. BUNNY STORAGE FILE CLEANUP");
  console.log("==================================================");

  const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || "faro-storage";
  const storageApiKey = process.env.BUNNY_STORAGE_API_KEY;

  if (!storageApiKey) {
    console.log("[Bunny Storage] BUNNY_STORAGE_API_KEY not configured. Skipping.");
    return;
  }

  try {
    const listRes = await fetch(
      `https://storage.bunnycdn.com/${storageZone}/`,
      {
        headers: {
          AccessKey: storageApiKey,
          Accept: "application/json",
        },
      }
    );

    if (!listRes.ok) {
      console.error(`[Bunny Storage] Failed to list files (HTTP ${listRes.status}):`, await listRes.text());
      return;
    }

    const files = (await listRes.json()) as Array<{
      ObjectName: string;
      IsDirectory: boolean;
      Length: number;
    }>;

    console.log(`Found ${files.length} item(s) in Bunny Storage Zone (${storageZone}).`);

    for (const file of files) {
      if (file.IsDirectory) continue;

      if (isExecute) {
        console.log(`[DELETING] File: ${file.ObjectName}...`);
        const delRes = await fetch(
          `https://storage.bunnycdn.com/${storageZone}/${encodeURIComponent(file.ObjectName)}`,
          {
            method: "DELETE",
            headers: { AccessKey: storageApiKey },
          }
        );
        if (delRes.ok) {
          console.log(`  ✓ Deleted ${file.ObjectName}`);
        } else {
          console.error(`  ✗ Failed to delete ${file.ObjectName} (HTTP ${delRes.status})`);
        }
      } else {
        console.log(`[DRY-RUN] Would delete file: ${file.ObjectName} (${file.Length} bytes)`);
      }
    }
  } catch (err: any) {
    console.error("[Bunny Storage] Network error:", err.message);
  }
}

async function main() {
  console.log("==================================================");
  console.log(`BUNNY MEDIA CLEANUP SCRIPT (Mode: ${isExecute ? "EXECUTE LIVE" : "DRY-RUN"})`);
  console.log("==================================================");
  if (!isExecute) {
    console.log("Notice: Running in DRY-RUN mode. No media will be deleted.");
    console.log("Pass --execute to perform actual deletion.");
  }

  await cleanupBunnyStream();
  await cleanupBunnyStorage();

  console.log("\n==================================================");
  console.log("CLEANUP SCAN COMPLETED.");
  console.log("==================================================\n");
}

main().catch(console.error);
