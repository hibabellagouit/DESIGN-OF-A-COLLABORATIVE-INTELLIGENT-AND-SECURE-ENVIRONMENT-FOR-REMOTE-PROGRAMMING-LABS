import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const VIEW_W = 1040;
const VIEW_H = 640;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2 - 4;
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

function layoutAssignmentsOnRings(assignments) {
  const byN = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  (assignments || []).forEach((a) => {
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

function nodeRadiusForTitle(title) {
  const lines = splitTitleTwoLines(title, 11);
  const maxLen = Math.max(lines[0].length, lines[1]?.length || 0);
  const fromText = 14 + Math.min(10, maxLen * 1.05);
  return Math.min(30, Math.max(18, fromText));
}

function shortTitle(title) {
  if (!title) return "Projet";
  return title.length > 42 ? `${title.slice(0, 40)}…` : title;
}

/**
 * Graphe circulaire par niveau (même principe que la vue enseignant) : positionne vos affectations
 * sur l’anneau du niveau du projet et indique jusqu’à quel niveau vous pouvez choisir de nouveaux projets.
 */
export default function StudentLevelDiagram({ assignments, currentLevel }) {
  const navigate = useNavigate();
  const positioned = useMemo(() => layoutAssignmentsOnRings(assignments), [assignments]);
  const cap = Math.min(5, Math.max(1, Number(currentLevel) || 1));

  const goMesProjets = () => navigate("/student-dashboard/mes-projets");

  return (
    <div className="diagram-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Parcours : vos projets par niveau et niveau maximal débloqué"
      >
        <defs>
          <radialGradient id="studentDiagramBg" cx="50%" cy="45%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="75%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#ffffff" />
          </radialGradient>
          <filter id="studentNodeShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#studentDiagramBg)" />

        {RY_EDGES.map((ry) => (
          <ellipse
            key={`ring-${ry}`}
            cx={CX}
            cy={CY}
            rx={ry * RX_SCALE}
            ry={ry}
            fill="none"
            stroke="rgba(15, 23, 42, 0.12)"
            strokeWidth={1}
          />
        ))}

        {[1, 2, 3, 4, 5].map((n) => {
          const { ryMid, rxMid } = niveauBand(n);
          const unlocked = n <= cap;
          return (
            <g key={`label-${n}`}>
              <ellipse
                cx={CX}
                cy={CY}
                rx={rxMid}
                ry={ryMid}
                fill="none"
                stroke={LEVEL_COLORS[n]}
                strokeOpacity={unlocked ? 0.42 : 0.14}
                strokeWidth={unlocked ? 2.2 : 1.1}
              />
              <text
                x={CX - rxMid - 6}
                y={CY}
                textAnchor="end"
                dominantBaseline="middle"
                fill={LEVEL_COLORS[n]}
                fontSize={12}
                fontWeight={700}
                opacity={unlocked ? 1 : 0.55}
              >
                N{n}
                {unlocked ? " ●" : ""}
              </text>
            </g>
          );
        })}

        <g>
          <circle cx={CX} cy={CY} r={22} fill="#0f172a" />
          <text
            x={CX}
            y={CY - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f8fafc"
            fontSize={9}
            fontWeight={600}
          >
            Max
          </text>
          <text
            x={CX}
            y={CY + 10}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#f8fafc"
            fontSize={15}
            fontWeight={800}
          >
            {cap}
          </text>
          <title>
            Niveau maximal débloqué pour choisir un nouveau projet : {cap} (sur 5). Les anneaux colorés
            indiquent le niveau de chaque affectation.
          </title>
        </g>

        {positioned.map(({ assignment, x, y, n }) => {
          const done = assignment.status === "validé";
          const title = assignment.project?.title || "Projet";
          const r = nodeRadiusForTitle(title);
          const stroke = done ? "#15803d" : LEVEL_COLORS[n];
          const fill = done ? "#dcfce7" : "#fff1f2";
          const lines = splitTitleTwoLines(title, 11);
          const fontSize = lines.length > 1 ? 7 : 8;

          return (
            <g
              key={String(assignment._id)}
              transform={`translate(${x},${y})`}
              role="button"
              tabIndex={0}
              onClick={goMesProjets}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goMesProjets();
                }
              }}
              style={{ cursor: "pointer" }}
              aria-label={`${title}, niveau projet ${n}, statut ${assignment.status}`}
            >
              <title>
                {title}
                {"\n"}Niveau du projet : {n}
                {"\n"}Statut : {assignment.status}
                {"\n"}Cliquez pour ouvrir « Mes projets ».
              </title>
              <circle r={r + 2} fill="none" stroke={stroke} strokeOpacity={0.25} strokeWidth={2} />
              <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.7} filter="url(#studentNodeShadow)" />
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
        <article className="diagram-item diagram-item--legend">
          <div className="diagram-item__head">
            <div className="diagram-item__title-wrap">
              <h4 className="diagram-item__title">Lecture du graphe</h4>
              <p className="diagram-item__meta">
                Anneaux <strong>N1 à N5</strong> : niveau du projet d&apos;une affectation. Le disque central
                affiche le <strong>niveau max. débloqué</strong> pour en choisir de nouveaux (voir aussi
                Progression). Un point <strong>●</strong> à côté du numéro d&apos;anneau indique un niveau
                déjà accessible.
              </p>
            </div>
          </div>
        </article>
        {assignments?.length ? (
          positioned.map(({ assignment, n }) => {
            const done = assignment.status === "validé";
            return (
              <article key={`card-${assignment._id}`} className="diagram-item">
                <div className="diagram-item__head">
                  <span className="diagram-item__index diagram-item__index--letter" aria-hidden="true">
                    {n}
                  </span>
                  <div className="diagram-item__title-wrap">
                    <h4 className="diagram-item__title">{shortTitle(assignment.project?.title)}</h4>
                    <p className="diagram-item__meta">Niveau projet {n}</p>
                  </div>
                  <span className={done ? "status-pill status-pill--ok" : "status-pill status-pill--pending"}>
                    {assignment.status}
                  </span>
                </div>
              </article>
            );
          })
        ) : (
          <article className="diagram-item">
            <p className="diagram-card-head__hint" style={{ margin: 0 }}>
              Aucune affectation.
            </p>
          </article>
        )}
      </div>
    </div>
  );
}
