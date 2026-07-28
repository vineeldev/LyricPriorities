// POST /api/priority  { "task": "TASK_GID", "firm": true|false }
// Sets the "Priority" custom field on a task to "Firm Priority" or "Regular".
// If the field doesn't exist on the project yet, it is created automatically.
// Requires env var ASANA_PAT.

const PROJECT_GID = "1216645063190106";
const FIELD_NAME = "Priority";
const FIRM_OPTION = "Firm Priority";
const REGULAR_OPTION = "Regular Work";

async function asana(path, opts, token) {
  const r = await fetch("https://app.asana.com/api/1.0" + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(opts && opts.headers),
    },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg =
      (body.errors && body.errors[0] && body.errors[0].message) ||
      "Asana API error " + r.status;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return body.data;
}

async function ensurePriorityField(token) {
  // Look for an existing "Priority" enum field on the project
  const settings = await asana(
    "/projects/" + PROJECT_GID +
      "/custom_field_settings?opt_fields=custom_field.gid,custom_field.name,custom_field.resource_subtype,custom_field.enum_options.gid,custom_field.enum_options.name",
    { method: "GET" },
    token
  );
  let field = null;
  for (const st of settings) {
    const cf = st.custom_field;
    if (cf && cf.name === FIELD_NAME && cf.resource_subtype === "enum") {
      field = cf;
      break;
    }
  }

  // Create it if missing, then attach to the project
  if (!field) {
    const proj = await asana(
      "/projects/" + PROJECT_GID + "?opt_fields=workspace.gid",
      { method: "GET" },
      token
    );
    field = await asana(
      "/custom_fields",
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            workspace: proj.workspace.gid,
            name: FIELD_NAME,
            resource_subtype: "enum",
            enum_options: [{ name: FIRM_OPTION }, { name: REGULAR_OPTION }],
          },
        }),
      },
      token
    );
    await asana(
      "/projects/" + PROJECT_GID + "/addCustomFieldSetting",
      {
        method: "POST",
        body: JSON.stringify({ data: { custom_field: field.gid } }),
      },
      token
    );
  }

  const firmOpt = (field.enum_options || []).find((o) => o.name === FIRM_OPTION);
  const regOpt = (field.enum_options || []).find((o) => o.name === REGULAR_OPTION);
  if (!firmOpt) throw new Error('Field "' + FIELD_NAME + '" exists but has no "' + FIRM_OPTION + '" option');
  return { fieldGid: field.gid, firmGid: firmOpt.gid, regularGid: regOpt ? regOpt.gid : null };
}

module.exports = async (req, res) => {
  const token = process.env.ASANA_PAT;
  if (!token) {
    res.status(500).json({ error: "ASANA_PAT environment variable is not set in Vercel" });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const body = req.body || {};
  const task = String(body.task || "");
  const firm = !!body.firm;
  if (!/^\d+$/.test(task)) {
    res.status(400).json({ error: "Missing or invalid task id" });
    return;
  }

  try {
    const f = await ensurePriorityField(token);
    const value = firm ? f.firmGid : f.regularGid;
    const custom_fields = {};
    custom_fields[f.fieldGid] = value; // null clears if Regular option somehow missing
    await asana(
      "/tasks/" + task,
      { method: "PUT", body: JSON.stringify({ data: { custom_fields } }) },
      token
    );
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, task, firm });
  } catch (e) {
    res.status(e.status || 500).json({ error: String((e && e.message) || e) });
  }
};
