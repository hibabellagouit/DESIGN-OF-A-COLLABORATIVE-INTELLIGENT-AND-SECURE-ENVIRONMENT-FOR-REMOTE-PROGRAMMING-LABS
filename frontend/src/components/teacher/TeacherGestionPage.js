import React from "react";
import TeacherForms from "../TeacherForms";
import { useTeacherRefresh } from "../../context/TeacherRefreshContext";

export default function TeacherGestionPage() {
  const { bump } = useTeacherRefresh();
  return (
    <div className="layout-content layout-content--wide">
      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Gestion</h2>
        </div>
        <TeacherForms onAssignmentsChanged={bump} />
      </section>
    </div>
  );
}
