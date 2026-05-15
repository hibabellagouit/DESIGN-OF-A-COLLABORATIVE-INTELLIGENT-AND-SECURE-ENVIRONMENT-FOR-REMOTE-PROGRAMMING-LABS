import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";
import { mongoIdString } from "../mongoIdString";

const VIEW_W = 1040;
const VIEW_H = 680;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2 - 8;
const RX_SCALE = 1.52;
const RY_EDGES = [24, 60, 102, 146, 192, 242];
const LEVEL_COLORS = {
  1: "#e11d48",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

function niveauBand(n) {
  const i = Math.min(5, Math.max(1, n)) - 1;
  const inner = RY_EDGES[i];
  const outer = RY_EDGES[i + 1];
  const ryMid = (inner + outer) / 2;
  return { ryMid, rxMid: ryMid * RX_SCALE };
}

/** Regroupe les affectations par projet (un nœud = un projet). */
function clusterByProject(assignments) {
  const map = new Map();
  for (const a of assignments) {
    const pid = mongoIdString(a.project?._id ?? a.project);
    if (!pid) continue;
    if (!map.has(pid)) {
      const proj = typeof a.project === "object" && a.project ? a.project : { _id: pid, title: "Projet" };
      map.set(pid, { projectId: pid, project: proj, assignments: [] });
    }
    map.get(pid).assignments.push(a);
  }
  return [...map.values()];
}

function clusterNiveau(cluster) {
  const levels = cluster.assignments.map((x) => Math.min(5, Math.max(1, Number(x.niveau) || 1)));
  return Math.min(5, Math.max(1, Math.max(...levels)));
}

function clusterAllValidated(cluster) {
  return cluster.assignments.length > 0 && cluster.assignments.every((x) => x.status === "validé");
}

function layoutProjectClusters(clusters) {
  const byN = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  clusters.forEach((c) => {
    const n = clusterNiveau(c);
    byN[n].push(c);
  });
  const items = [];
  for (let n = 1; n <= 5; n++) {
    const list = byN[n];
    const { ryMid, rxMid } = niveauBand(n);
    list.forEach((cluster, i) => {
      const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2;
      items.push({
        cluster,
        x: CX + rxMid * Math.cos(angle),
        y: CY + ryMid * Math.sin(angle),
        n,
      });
    });
  }
  return items;
}

function splitTitleTwoLines(raw, maxPerLine = 11) {
  const t = (raw || "Projet").trim() || "Projet";
  if (t.length <= maxPerLine) return [t];
  let a = t.slice(0, maxPerLine);
  const breakAt = a.lastIndexOf(" ");
  if (breakAt > 4) a = t.slice(0, breakAt).trimEnd();
  const rest = t.slice(a.length).trim();
  if (!rest) return [a];
  if (rest.length <= maxPerLine) return [a, rest];
  return [a, `${rest.slice(0, maxPerLine - 1)}…`];
}

function nodeRadiusForCluster(cluster) {
  const title = cluster.project?.title || "Projet";
  const lines = splitTitleTwoLines(title, 11);
  const maxLen = Math.max(lines[0].length, lines[1]?.length || 0);
  const fromText = 14 + Math.min(12, maxLen * 1.15);
  const students = cluster.assignments.reduce((s, a) => s + (a.students?.length || 0), 0);
  const fromHeadcount = 12 + Math.min(5, students * 0.55);
  return Math.min(32, Math.max(18, Math.max(fromText, fromHeadcount)));
}

function shortTitle(title) {
  if (!title) return "Projet";
  return title.length > 40 ? `${title.slice(0, 38)}…` : title;
}

export default function Diagram({ refreshKey = 0 }) {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);

  const goToProjectId = (projectIdStr) => {
    const id = mongoIdString(projectIdStr);
    if (!id) return;
    navigate(`/teacher-dashboard/project/${id}`);
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/assignments`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .catch(() => setAssignments([]));
  }, [refreshKey]);

  const clusters = useMemo(() => clusterByProject(assignments), [assignments]);
  const positioned = useMemo(() => layoutProjectClusters(clusters), [clusters]);

  return (
    <div className="diagram-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Vue graphe des projets par niveau"
      >
        <defs>
          <radialGradient id="diagramBg" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="75%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#ffffff" />
          </radialGradient>
          <filter id="nodeShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#diagramBg)" />

        {RY_EDGES.map((ry) => (
          <ellipse
            key={`ring-${ry}`}
            cx={CX}
            cy={CY}
            rx={ry * RX_SCALE}
            ry={ry}
            fill="none"
            stroke="rgba(15, 23, 42, 0.14)"
            strokeWidth={1}
          />
        ))}

        {[1, 2, 3, 4, 5].map((n) => {
          const { ryMid, rxMid } = niveauBand(n);
          return (
            <g key={`label-${n}`}>
              <ellipse
                cx={CX}
                cy={CY}
                rx={rxMid}
                ry={ryMid}
                fill="none"
                stroke={LEVEL_COLORS[n]}
                strokeOpacity={0.2}
                strokeWidth={1.2}
              />
              <text
                x={CX - rxMid - 6}
                y={CY}
                textAnchor="end"
                dominantBaseline="middle"
                fill={LEVEL_COLORS[n]}
                fontSize={12}
                fontWeight={700}
              >
                N{n}
              </text>
            </g>
          );
        })}
        <circle cx={CX} cy={CY} r={20} fill="#0f172a" />

        {positioned.map(({ cluster, x, y, n }) => {
          const done = clusterAllValidated(cluster);
          const r = nodeRadiusForCluster(cluster);
          const stroke = done ? "#15803d" : LEVEL_COLORS[n];
          const fill = done ? "#dcfce7" : "#fff1f2";
          const title = cluster.project?.title || "Projet";
          const lines = splitTitleTwoLines(title, 11);
          const fontSize = lines.length > 1 ? 7 : 8;
          const pid = cluster.projectId;
          const groupCount = cluster.assignments.length;

          return (
            <g
              key={pid}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              onClick={() => goToProjectId(pid)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToProjectId(pid);
                }
              }}
              style={{ cursor: pid ? "pointer" : "default" }}
              aria-label={`Projet ${title}, niveau ${n}`}
            >
              <title>
                {title}
                {"\n"}Niveau {n}
                {"\n"}
                {groupCount} groupe{groupCount > 1 ? "s" : ""} (affectations)
                {"\n"}
                {done ? "Toutes les équipes sont validées" : "Au moins une équipe en cours"}
                {"\n"}Cliquez pour voir le détail et les groupes.
              </title>
              <circle r={r + 2} fill="none" stroke={stroke} strokeOpacity={0.25} strokeWidth={2} />
              <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.7} filter="url(#nodeShadow)" />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fontSize}
                fontWeight={700}
                fill={stroke}
                className="diagram-node__label"
              >
                {lines.length === 1 ? (
                  <tspan x={0} dy="0.35em">
                    {lines[0]}
                  </tspan>
                ) : (
                  [
                    <tspan key="a" x={0} dy="-0.5em">
                      {lines[0]}
                    </tspan>,
                    <tspan key="b" x={0} dy="1.05em">
                      {lines[1]}
                    </tspan>,
                  ]
                )}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="diagram-list">
        {clusters.map((cluster) => {
          const n = clusterNiveau(cluster);
          const done = clusterAllValidated(cluster);
          const groupCount = cluster.assignments.length;
          const studentsTotal = cluster.assignments.reduce((s, a) => s + (a.students?.length || 0), 0);
          const title = shortTitle(cluster.project?.title);
          const initial = (cluster.project?.title || "P").trim().charAt(0).toUpperCase();

          return (
            <article key={`card-${cluster.projectId}`} className="diagram-item">
              <div className="diagram-item__head">
                <span className="diagram-item__index diagram-item__index--letter" aria-hidden="true">
                  {initial}
                </span>
                <div className="diagram-item__title-wrap">
                  <h4 className="diagram-item__title">{title}</h4>
                  <p className="diagram-item__meta">
                    Niveau {n} · {groupCount} groupe{groupCount > 1 ? "s" : ""} · {studentsTotal} étudiant
                    {studentsTotal > 1 ? "s" : ""}
                  </p>
                </div>
                <span className={done ? "status-pill status-pill--ok" : "status-pill status-pill--pending"}>
                  {done ? "Tout validé" : "En cours"}
                </span>
              </div>
              <div className="diagram-item__actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => goToProjectId(cluster.projectId)}
                >
                  Voir les groupes
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
