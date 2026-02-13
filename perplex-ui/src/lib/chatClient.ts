// chatClient.ts
// Connects the React frontend to the FastAPI backend

export async function askLLM(query: string) {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const res = await fetch(`${apiUrl}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.answer || data?.error || `HTTP ${res.status}`);
  }
  return data.answer as string;
}

export async function downloadReport(type: "investor" | "regulator") {
  const apiUrl = import.meta.env.VITE_API_URL as string;
  const url = `${apiUrl}/report/${type}`;

  const res = await fetch(url, {
    method: "GET",
    // credentials not needed; CORS already allows "*"
  });

  // If server returned JSON error, surface it
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    if (contentType.includes("application/json")) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  // Expect a PDF blob
  if (!contentType.includes("application/pdf")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Expected PDF, got ${contentType}. ${text.slice(0, 200)}`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${type}_report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
