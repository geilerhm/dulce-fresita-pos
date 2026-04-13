import { NextResponse } from "next/server";

/**
 * This endpoint is called by the Settings page to check for updates.
 * In Electron, the auto-updater runs in the main process. This endpoint
 * checks GitHub releases directly as a lightweight alternative.
 */
export async function POST() {
  try {
    const currentVersion = process.env.npm_package_version || "0.0.0";

    const res = await fetch(
      "https://api.github.com/repos/geilerhm/dulce-fresita-pos/releases/latest",
      { headers: { "Accept": "application/vnd.github.v3+json" }, next: { revalidate: 0 } }
    );

    if (!res.ok) {
      return NextResponse.json({ updateAvailable: false, current: currentVersion, error: "Could not check" });
    }

    const release = await res.json();
    const latestVersion = (release.tag_name || "").replace(/^v/, "");

    return NextResponse.json({
      updateAvailable: latestVersion !== currentVersion && latestVersion > currentVersion,
      current: currentVersion,
      version: latestVersion,
      releaseUrl: release.html_url,
    });
  } catch {
    return NextResponse.json({ updateAvailable: false, error: "Network error" });
  }
}
