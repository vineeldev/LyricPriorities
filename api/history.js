// GET /api/history?task=TASK_GID — returns date-related change history for one task,
// built from Asana's activity stories. Requires env var ASANA_PAT.

module.exports = async (req, res) => {
  const token = process.env.ASANA_PAT;
  if (!token) {
    res.status(500).json({ error: "ASANA_PAT environment variable is not set in Vercel" });
    return;
  }

  const gid = (req.query && req.query.task) || "";
  if (!/^\d+$/.test(gid)) {
    res.status(400).json({ error: "Missing or invalid ?task= parameter" });
    return;
  }

  const fields = "created_at,text,created_by.name,resource_subtype";
  let url =
    "https://app.asana.com/api/1.0/tasks/" + gid +
    "/stories?limit=100&opt_fields=" + encodeURIComponent(fields);

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

    // Keep stories about our date fields (or the native due date), newest first.
    const events = all
      .filter((st) => st.text && /due date/i.test(st.text))
      .map((st) => ({
        when: st.created_at,
        who: st.created_by ? st.created_by.name : "Someone",
        text: st.text,
      }))
      .reverse();

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ task: gid, events });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
