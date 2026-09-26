import fs from "fs";

const userRawPath = "C:/Users/lenovo/.gemini/antigravity/brain/36ff13e1-0c2f-4b99-9d0f-b30e679373a6/scratch/user_raw.txt";
const userRaw = fs.readFileSync(userRawPath, "latin1");
const refreshMatch = userRaw.match(/refreshToken"[^A-Za-z0-9_-]*([A-Za-z0-9_-]{50,})/);
const refreshToken = refreshMatch[1];
const apiKey = "AIzaSyAO6OQaycah90bDDBHoR2ACCnGXHS2s6qE";
const projectId = "gaurav-marbles";

async function getAuthToken() {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });
  const data = await res.json();
  return data.id_token;
}

async function listCollection(token, colName) {
  let docs = [];
  let pageToken = null;
  do {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${colName}?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.documents) {
      docs = docs.concat(data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

function parseDoc(doc) {
  const id = doc.name.split("/").pop();
  const fields = doc.fields || {};
  const obj = { id };
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[k] = v.doubleValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
    else if (v.nullValue !== undefined) obj[k] = null;
    else if (v.arrayValue !== undefined) obj[k] = (v.arrayValue.values || []).map(val => parseDoc({ name: "", fields: val.mapValue?.fields || {} }));
    else if (v.mapValue !== undefined) obj[k] = parseDoc({ name: "", fields: v.mapValue.fields || {} });
  }
  return obj;
}

async function run() {
  const token = await getAuthToken();
  console.log("Authenticated successfully.");

  const rawDocs = await listCollection(token, "purchases");
  console.log(`\n================== Collection: purchases (${rawDocs.length} documents) ==================`);
  rawDocs.forEach(d => {
    const p = parseDoc(d);
    console.log(JSON.stringify(p, null, 2));
  });
}

run().catch(console.error);
