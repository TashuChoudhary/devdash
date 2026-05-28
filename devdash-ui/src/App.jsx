import { useState, useEffect, useCallback } from "react";

const PROM = "http://localhost:9090";
const DEVDASH_API = "http://localhost:8080";
const INTERVAL = 15000;

async function prom(q) {
  try {
    const res = await fetch(`${PROM}/api/v1/query?query=${encodeURIComponent(q)}`);
    const json = await res.json();
    return json?.data?.result ?? [];
  } catch { return []; }
}

const PROJECTS = [
  {
    id: "cron-manager",
    name: "Cron Job Manager",
    url: "https://cron-job-manager.onrender.com",
    description: "Scheduled job runner · Go · Render",
  },
  {
    id: "pastelite",
    name: "PasteLite",
    url: "https://pastelite.onrender.com",
    description: "Divine paste sharing · Node · Render",
  },
];

const C = {
  bg:        "#111111",
  surface:   "#1a1a1a",
  border:    "#2a2a2a",
  borderHov: "#404040",
  textHi:    "#f0f0f0",   /* headings, values */
  textMid:   "#a0a0a0",   /* labels, descriptions */
  textLow:   "#606060",   /* timestamps, secondary meta */
  green:     "#00e599",
  blue:      "#38bdf8",
  amber:     "#fbbf24",
  red:       "#f87171",
};

/* ── live dot ── */
function LiveDot({ on }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 10, height: 10 }}>
      {on && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: C.green, opacity: 0.45,
          animation: "ripple 1.8s ease-out infinite",
        }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? C.green : C.red, position: "relative" }} />
    </span>
  );
}

/*  status tag  */
function Tag({ ok, label }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontFamily: "monospace",
      fontWeight: 500,
      color: ok ? C.green : C.red,
      background: ok ? "rgba(0,229,153,0.1)" : "rgba(248,113,113,0.1)",
      border: `1px solid ${ok ? "rgba(0,229,153,0.25)" : "rgba(248,113,113,0.25)"}`,
      borderRadius: 5, padding: "4px 10px",
    }}>
      <LiveDot on={ok} />
      {label}
    </span>
  );
}

/* mini bar  */
function Bar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  return (
    <div style={{ height: 3, background: "#2a2a2a", borderRadius: 3, marginTop: 7, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
    </div>
  );
}

/*  overview stat card */
function Stat({ label, value, note, color }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "24px 26px",
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 10,
        background: C.surface,
        transition: "border-color 0.15s",
        cursor: "default",
      }}
    >
      <div style={{
        fontSize: 11, fontFamily: "monospace", letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.textMid, marginBottom: 14,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 32, fontWeight: 600, color: color || C.textHi,
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>
        {value ?? <span style={{ color: C.textLow }}>—</span>}
      </div>
      {note && (
        <div style={{ fontSize: 12, color: C.textMid, marginTop: 10, fontFamily: "monospace" }}>
          {note}
        </div>
      )}
    </div>
  );
}

/*  section divider  */
function Section({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "48px 0 20px" }}>
      <span style={{
        fontSize: 11, fontFamily: "monospace", letterSpacing: "0.15em",
        textTransform: "uppercase", color: C.textMid, whiteSpace: "nowrap", fontWeight: 600,
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: C.border }} />
    </div>
  );
}

/* pod card */
function PodCard({ pod }) {
  const cpuPct   = Math.min(99, Math.round(parseFloat(pod.cpu || 0) * 100));
  const memMi    = Math.round(parseFloat(pod.mem || 0) / (1024 * 1024));
  const isRunning = pod.phase === "Running";
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "18px 20px",
        border: `1px solid ${hov ? C.borderHov : C.border}`,
        borderRadius: 10,
        background: C.surface,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{ minWidth: 0, paddingRight: 12 }}>
          <div style={{
            fontSize: 13, color: C.textHi, fontWeight: 500,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {pod.name}
          </div>
          <div style={{ fontSize: 11, color: C.textLow, fontFamily: "monospace", marginTop: 4 }}>
            namespace / {pod.ns}
          </div>
        </div>
        <Tag ok={isRunning} label={isRunning ? "running" : "pending"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: C.textLow, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>CPU</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.green, marginTop: 5 }}>{cpuPct}%</div>
          <Bar value={cpuPct} max={100} color={C.green} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textLow, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>Memory</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.blue, marginTop: 5 }}>{memMi} Mi</div>
          <Bar value={memMi} max={256} color={C.blue} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.textLow, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "monospace" }}>Restarts</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: pod.restarts > 0 ? C.amber : C.textLow, marginTop: 5 }}>
            {pod.restarts ?? 0}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ghost button  */
function GhostBtn({ children, onClick, accent }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontSize: 12, fontFamily: "monospace", fontWeight: 500,
        color: accent ? (hov ? "#111" : accent) : (hov ? C.textHi : C.textMid),
        background: accent
          ? (hov ? accent : `${accent}18`)
          : (hov ? "#2a2a2a" : "transparent"),
        border: `1px solid ${accent ? `${accent}40` : C.border}`,
        borderRadius: 6, padding: "6px 14px", cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* project card  */
function ProjectCard({ project, status, latency }) {
  const [open, setOpen] = useState(false);
  const ok = status === "healthy";
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => !open && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${(hov || open) ? C.borderHov : C.border}`,
        borderRadius: 10,
        overflow: "hidden",
        background: C.surface,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px",
      }}>
        <div>
          <div style={{ fontSize: 15, color: C.textHi, fontWeight: 600 }}>
            {project.name}
          </div>
          <div style={{ fontSize: 12, color: C.textMid, fontFamily: "monospace", marginTop: 5 }}>
            {project.description}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {latency && (
            <span style={{ fontSize: 12, color: C.textLow, fontFamily: "monospace" }}>
              {latency}ms
            </span>
          )}
          <Tag ok={ok} label={ok ? "online" : "offline"} />
          <GhostBtn onClick={() => setOpen(o => !o)}>
            {open ? "collapse ↑" : "preview ↓"}
          </GhostBtn>
          <a
            href={project.url} target="_blank" rel="noreferrer"
            style={{
              fontSize: 12, fontFamily: "monospace", fontWeight: 500,
              color: C.green, background: "rgba(0,229,153,0.1)",
              border: "1px solid rgba(0,229,153,0.25)",
              borderRadius: 6, padding: "6px 14px", textDecoration: "none",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,229,153,0.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(0,229,153,0.1)"}
          >
            open ↗
          </a>
        </div>
      </div>

      {open && (
        <div style={{ height: 460, borderTop: `1px solid ${C.border}`, background: "#000", position: "relative" }}>
          {ok
            ? <iframe src={project.url} style={{ width: "100%", height: "100%", border: "none", display: "block" }} title={project.name} />
            : (
              <div style={{
                height: "100%", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
                color: C.textLow, fontFamily: "monospace", fontSize: 13,
              }}>
                <span style={{ fontSize: 28 }}>⚠</span>
                service unreachable
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

/*  main  */
export default function App() {
  const [connected,       setConnected]       = useState(false);
  const [pods,            setPods]            = useState([]);
  const [services,        setServices]        = useState([]);
  const [projectStatuses, setProjectStatuses] = useState({});
  const [latency,         setLatency]         = useState(null);
  const [lastSync,        setLastSync]        = useState(null);

  const fetchPods = useCallback(async () => {
    const SKIP = ["coredns","etcd","kube-apiserver","kube-controller","kube-proxy","kube-scheduler","kindnet","local-path"];
    const [infoRes, cpuRes, memRes, restartRes, phaseRes] = await Promise.all([
      prom("kube_pod_info"),
      prom("sum by(pod) (rate(container_cpu_usage_seconds_total[2m]))"),
      prom("sum by(pod) (container_memory_usage_bytes)"),
      prom("sum by(pod) (kube_pod_container_status_restarts_total)"),
      prom('kube_pod_status_phase{phase="Running"}'),
    ]);
    const cpuMap     = Object.fromEntries(cpuRes.map(r => [r.metric.pod, r.value[1]]));
    const memMap     = Object.fromEntries(memRes.map(r => [r.metric.pod, r.value[1]]));
    const restartMap = Object.fromEntries(restartRes.map(r => [r.metric.pod, r.value[1]]));
    const runningSet = new Set(phaseRes.map(r => r.metric.pod));
    setPods(
      infoRes
        .filter(r => !SKIP.some(s => r.metric.pod.includes(s)))
        .map(r => ({
          name:     r.metric.pod,
          ns:       r.metric.namespace,
          cpu:      cpuMap[r.metric.pod] ?? 0,
          mem:      memMap[r.metric.pod] ?? 0,
          restarts: Math.round(parseFloat(restartMap[r.metric.pod] ?? 0)),
          phase:    runningSet.has(r.metric.pod) ? "Running" : "Pending",
        }))
    );
  }, []);

  const fetchServices = useCallback(async () => {
    const targets = [
      { name: "devdash-app", label: "K8s · Go · default", url: `${DEVDASH_API}/health` },
    ];
    const results = await Promise.all(
      targets.map(async t => {
        const t0 = Date.now();
        try {
          const res = await fetch(t.url, { signal: AbortSignal.timeout(4000) });
          return { ...t, status: res.ok ? "healthy" : "degraded", latency: Date.now() - t0 };
        } catch {
          return { ...t, status: "degraded", latency: null };
        }
      })
    );
    setServices(results);
  }, []);

  const fetchProjectStatuses = useCallback(async () => {
    const results = await Promise.all(
      PROJECTS.map(async p => {
        const t0 = Date.now();
        try {
          await fetch(p.url, { signal: AbortSignal.timeout(6000), mode: "no-cors" });
          return { id: p.id, status: "healthy", latency: Date.now() - t0 };
        } catch {
          return { id: p.id, status: "degraded", latency: null };
        }
      })
    );
    const map = {};
    results.forEach(r => { map[r.id] = r; });
    setProjectStatuses(map);
  }, []);

  const fetchLatency = useCallback(async () => {
    const res = await prom("histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))");
    if (res?.[0]) setLatency((parseFloat(res[0].value[1]) * 1000).toFixed(1));
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchPods(), fetchServices(), fetchProjectStatuses(), fetchLatency()]);
      setConnected(true);
      setLastSync(new Date().toTimeString().slice(0, 8));
    } catch { setConnected(false); }
  }, [fetchPods, fetchServices, fetchProjectStatuses, fetchLatency]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  const healthySvcs     = services.filter(s => s.status === "healthy").length;
  const runningPods     = pods.filter(p => p.phase === "Running").length;
  const healthyProjects = Object.values(projectStatuses).filter(p => p.status === "healthy").length;

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111111; min-height: 100%; overflow-y: auto; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        @keyframes ripple {
          0%   { transform: scale(1);   opacity: 0.45; }
          100% { transform: scale(2.8); opacity: 0;    }
        }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", color: C.textHi }}>

        {/* topbar  */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 48px", height: 56,
          background: "rgba(17,17,17,0.92)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, background: C.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#000", letterSpacing: ".04em",
            }}>DD</div>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.textHi }}>DevDash</span>
            <span style={{ fontSize: 13, color: C.textLow, marginLeft: 2 }}>/ personal ops</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "monospace" }}>
            <LiveDot on={connected} />
            <span style={{ fontSize: 13, color: connected ? C.green : C.red, fontWeight: 500 }}>
              {connected ? "live" : "offline"}
            </span>
            {lastSync && (
              <span style={{
                fontSize: 12, color: C.textLow,
                borderLeft: `1px solid ${C.border}`, paddingLeft: 12, marginLeft: 2,
              }}>
                synced {lastSync}
              </span>
            )}
          </div>
        </div>

        {/*  page body  */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 48px 100px" }}>

          {/* overview */}
          <Section>Overview</Section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <Stat
              label="K8s Services"
              value={services.length ? `${healthySvcs} / ${services.length}` : "—"}
              note={services.length && healthySvcs < services.length ? `${services.length - healthySvcs} degraded` : "all healthy"}
              color={C.green}
            />
            <Stat
              label="Pods Running"
              value={pods.length ? `${runningPods} / ${pods.length}` : "—"}
              note="across namespaces"
              color={C.blue}
            />
            <Stat
              label="Projects Live"
              value={`${healthyProjects} / ${PROJECTS.length}`}
              note={healthyProjects === PROJECTS.length ? "all online" : `${PROJECTS.length - healthyProjects} offline`}
              color={C.green}
            />
            <Stat
              label="p50 Latency"
              value={latency ? `${latency}ms` : "—"}
              note="5 min window"
              color={C.amber}
            />
          </div>

          {/* services */}
          <Section>Kubernetes Services</Section>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
            {services.length === 0
              ? <div style={{ padding: "20px 24px", fontSize: 13, color: C.textMid, fontFamily: "monospace" }}>pinging…</div>
              : services.map((svc, i) => (
                <div key={svc.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "18px 24px",
                  borderBottom: i < services.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: C.textHi, fontWeight: 500 }}>{svc.name}</div>
                    <div style={{ fontSize: 12, color: C.textMid, fontFamily: "monospace", marginTop: 4 }}>{svc.label}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <Tag ok={svc.status === "healthy"} label={svc.status} />
                    {svc.latency && <span style={{ fontSize: 11, color: C.textLow, fontFamily: "monospace" }}>{svc.latency}ms response</span>}
                  </div>
                </div>
              ))
            }
          </div>

          {/* pods */}
          <Section>Kubernetes Pods</Section>
          {pods.length === 0
            ? <div style={{ fontSize: 13, color: C.textMid, fontFamily: "monospace", padding: "8px 0" }}>querying prometheus…</div>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {pods.map(p => <PodCard key={p.name} pod={p} />)}
              </div>
          }

          {/* projects */}
          <Section>Deployed Projects</Section>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PROJECTS.map(proj => (
              <ProjectCard
                key={proj.id}
                project={proj}
                status={projectStatuses[proj.id]?.status}
                latency={projectStatuses[proj.id]?.latency}
              />
            ))}
          </div>

        </div>
      </div>
    </>
  );
}