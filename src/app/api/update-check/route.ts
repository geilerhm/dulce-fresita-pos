import { NextResponse } from "next/server";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

export async function POST() {
  try {
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

    const res = await fetch(
      "https://api.github.com/repos/geilerhm/dulce-fresita-pos/releases/latest",
      { headers: { "Accept": "application/vnd.github.v3+json" }, next: { revalidate: 0 } }
    );

    if (!res.ok) {
      return NextResponse.json({ updateAvailable: false, current: currentVersion });
    }

    const release = await res.json();
    const latestVersion = (release.tag_name || "").replace(/^v/, "");
    const updateAvailable = compareVersions(latestVersion, currentVersion) > 0;

    return NextResponse.json({
      updateAvailable,
      current: currentVersion,
      version: latestVersion,
    });
  } catch {
    return NextResponse.json({ updateAvailable: false, error: "Network error" });
  }
}
