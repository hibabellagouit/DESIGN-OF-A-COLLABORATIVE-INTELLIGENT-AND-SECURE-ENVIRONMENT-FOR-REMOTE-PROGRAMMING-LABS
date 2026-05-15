import React from "react";
import TeacherSubmissions from "../TeacherSubmissions";
import { useTeacherRefresh } from "../../context/TeacherRefreshContext";

export default function TeacherSoumissionsPage() {
  const { refreshKey } = useTeacherRefresh();
  return (
    <div className="layout-content layout-content--wide">
      <TeacherSubmissions refreshKey={refreshKey} />
    </div>
  );
}
