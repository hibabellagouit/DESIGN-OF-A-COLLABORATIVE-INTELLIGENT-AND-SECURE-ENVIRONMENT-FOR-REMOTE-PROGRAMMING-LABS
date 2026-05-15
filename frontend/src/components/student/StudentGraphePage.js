import React from "react";
import StudentLevelDiagram from "./StudentLevelDiagram";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";

export default function StudentGraphePage() {
  const { loading, error, assignments, currentLevel } = useStudentWorkspace();

  return (
    <div className="layout-content layout-content--wide">
      <section className="card card--diagram card--elevated">
        <div className="diagram-card-head">
          <div>
            <h2 className="diagram-card-head__title">Graphe</h2>
          </div>
        </div>
        {loading && (
          <div className="state-block state-block--muted" style={{ padding: "1.5rem" }}>
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--short" />
          </div>
        )}
        {error && <div className="feedback feedback--err">{error}</div>}
        {!loading && !error && (
          <StudentLevelDiagram assignments={assignments} currentLevel={currentLevel} />
        )}
      </section>
    </div>
  );
}
