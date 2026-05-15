import React from "react";
import Diagram from "../Diagram";
import { useTeacherRefresh } from "../../context/TeacherRefreshContext";

export default function TeacherGraphePage() {
  const { refreshKey } = useTeacherRefresh();
  return (
    <div className="layout-content layout-content--wide">
      <section className="card card--diagram card--elevated">
        <div className="diagram-card-head">
          <div>
            <h2 className="diagram-card-head__title">Graphe</h2>
          </div>
        </div>
        <Diagram refreshKey={refreshKey} />
      </section>
    </div>
  );
}
