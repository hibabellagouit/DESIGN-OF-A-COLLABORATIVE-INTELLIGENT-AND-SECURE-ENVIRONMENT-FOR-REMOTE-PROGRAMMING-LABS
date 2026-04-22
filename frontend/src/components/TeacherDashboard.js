import React, { useState } from "react";
import Diagram from "./Diagram";
import TeacherForms from "./TeacherForms";

const TeacherDashboard = () => {
  const [graphRev, setGraphRev] = useState(0);

  return (
    <div className="layout-content layout-content--wide">
      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Administration</h2>
          <p className="section-intro__text">
            Étudiants, création de projets et affectations — les champs sont regroupés par
            thème.
          </p>
        </div>
        <TeacherForms onAssignmentsChanged={() => setGraphRev((r) => r + 1)} />
      </section>

      <section className="card card--diagram card--elevated">
        <div className="diagram-card-head">
          <div>
            <h2 className="diagram-card-head__title">Vue graphe des affectations</h2>
            <p className="diagram-card-head__hint">
              Cercles roses : projets · points verts : étudiants · anneaux : niveaux 1 à 5.
              Cliquez sur « Valider » pour marquer une affectation comme terminée.
            </p>
          </div>
        </div>
        <Diagram refreshKey={graphRev} />
      </section>
    </div>
  );
};

export default TeacherDashboard;
