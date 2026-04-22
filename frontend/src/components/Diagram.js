import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";

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

function layoutAssignments(assignments) {
  const byN = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  assignments.forEach((a) => {
    const n = Math.min(5, Math.max(1, Number(a.niveau) || 1));
    byN[n].push(a);
  });
  const items = [];
  for (let n = 1; n <= 5; n++) {
    const list = byN[n];
    const { ryMid, rxMid } = niveauBand(n);
    list.forEach((assignment, i) => {
      const angle = (i / Math.max(list.length, 1)) * 2 * Math.PI - Math.PI / 2;
      items.push({
        assignment,
        x: CX + rxMid * Math.cos(angle),
        y: CY + ryMid * Math.sin(angle),
        n,
      });
    });
  }
  return items;
}

function nodeRadius(assignment) {
  const count = assignment.students?.length || 0;
  return 17 + Math.min(10, count * 2);
}

function shortTitle(title) {
  if (!title) return "Projet";
  return title.length > 34 ? `${title.slice(0, 32)}...` : title;
}

export default function Diagram({ refreshKey = 0 }) {
  const [assignments, setAssignments] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [validatingId, setValidatingId] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/assignments`)
      .then((res) => res.json())
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .catch(() => setAssignments([]));
  }, [reloadKey, refreshKey]);

  const positioned = useMemo(() => layoutAssignments(assignments), [assignments]);
  const indexed = useMemo(
    () =>
      positioned.map((item, idx) => ({
        ...item,
        index: idx + 1,
      })),
    [positioned]
  );

  const validate = async (assignmentId) => {
    if (!assignmentId || validatingId === assignmentId) return;
    setValidatingId(assignmentId);
    try {
      await fetch(`${API_BASE}/api/assignments/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      setReloadKey((k) => k + 1);
    } finally {
      setValidatingId("");
    }
  };

  return (
    <div className="diagram-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Vue graphe des affectations par niveau"
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

        {indexed.map(({ assignment, x, y, n, index }) => {
          const done = assignment.status === "validé";
          const r = nodeRadius(assignment);
          const stroke = done ? "#15803d" : LEVEL_COLORS[n];
          const fill = done ? "#dcfce7" : "#fff1f2";
          return (
            <g
              key={assignment._id}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!done) validate(assignment._id);
              }}
              onKeyDown={(e) => {
                if (done) return;
                if (e.key === "Enter" || e.key === " ") validate(assignment._id);
              }}
              style={{ cursor: done ? "default" : "pointer" }}
            >
              <title>
                {assignment.project?.title || "Projet"}
                {"\n"}Niveau {n}
                {"\n"}Statut: {done ? "Validé" : "En cours"}
              </title>
              <circle r={r + 2} fill="none" stroke={stroke} strokeOpacity={0.25} strokeWidth={2} />
              <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.7} filter="url(#nodeShadow)" />
              <text textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill={stroke}>
                {index}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="diagram-list">
        {indexed.map(({ assignment, n, index }) => {
          const done = assignment.status === "validé";
          const students = assignment.students || [];
          const isBusy = validatingId === assignment._id;
          return (
            <article key={`card-${assignment._id}`} className="diagram-item">
              <div className="diagram-item__head">
                <span className="diagram-item__index">{index}</span>
                <div className="diagram-item__title-wrap">
                  <h4 className="diagram-item__title">{shortTitle(assignment.project?.title)}</h4>
                  <p className="diagram-item__meta">
                    Niveau {n} · {students.length} étudiant{students.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span className={done ? "status-pill status-pill--ok" : "status-pill status-pill--pending"}>
                  {done ? "Validé" : "En cours"}
                </span>
              </div>
              {!done && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isBusy}
                  onClick={() => validate(assignment._id)}
                >
                  {isBusy ? "Validation..." : "Valider"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}