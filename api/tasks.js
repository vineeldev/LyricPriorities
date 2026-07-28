// GET /api/tasks — pulls all tasks in the Lyric Q3 Priorities project from Asana
// Requires env var ASANA_PAT (Asana Personal Access Token). Never expose the token client-side.

const PROJECT_GID = "1216645063190106";

module.exports = async (req, res) => {
  const token = process.env.ASANA_PAT;
  if (!token) {
    res.status(500).json({ error: "ASANA_PAT environment variable is not set in Vercel" });
    return;
  }

  const fields = [
    "name",
    "completed",
    "parent.name",
    "assignee.name",
    "custom_fields.name",
    "custom_fields.display_value",
    "memberships.project.gid",
    "memberships.section.name",
  ].join(",");

  let url =
    "https://app.asana.com/api/1.0/projects/" + PROJECT_GID +
    "/tasks?limit=100&opt_fields=" + encodeURIComponent(fields);

  const all = [];
  try {
    while (url) {
      const r = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) {
        const detail = (await r.text()).slice(0, 300);
        res.status(r.status).json({ error: "Asana API error " + r.status, detail });
        return;
      }
      const j = await r.json();
      all.push(...j.data);
      url = j.next_page ? j.next_page.uri : null;
    }

    const rows = all.map((t) => {
      const mem = (t.memberships || []).find(
        (m) => m.project && m.project.gid === PROJECT_GID
      );
      const section = mem && mem.section ? mem.section.name : null;

      let type = null;
      let date = null;
      for (const cf of t.custom_fields || []) {
        if (!cf.display_value) continue;
        if (cf.name === "Target Due Date") { type = "target"; date = cf.display_value.slice(0, 10); }
        else if (cf.name === "Hard Due Date") { type = "hard"; date = cf.display_value.slice(0, 10); }
        else if (cf.name === "Contractual Due Date") { type = "contractual"; date = cf.display_value.slice(0, 10); }
      }

      return [
        t.name,
        section,
        t.parent ? t.parent.name : null,
        t.assignee ? t.assignee.name.split(" ")[0] : null,
        type,
        date,
        t.completed ? 1 : 0,
      ];
    });

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ asOf: new Date().toISOString(), rows });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
