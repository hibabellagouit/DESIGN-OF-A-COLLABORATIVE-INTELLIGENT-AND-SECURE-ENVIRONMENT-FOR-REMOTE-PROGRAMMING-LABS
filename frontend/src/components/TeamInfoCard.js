import React from "react";

/** Affichage lisible d'une équipe et de son responsable. */
export default function TeamInfoCard({ team, compact = false }) {
  if (!team?.name) return null;
  const leaderName = team.leader?.name || team.leader?.email || null;

  if (compact) {
    return (
      <div className="team-info team-info--compact">
        <span className="team-info__name">{team.name}</span>
        {leaderName ? (
          <span className="team-info__leader">
            Responsable · <strong>{leaderName}</strong>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="team-info">
      <div className="team-info__badge" aria-hidden="true">
        {(team.name || "E").trim().charAt(0).toUpperCase()}
      </div>
      <div className="team-info__body">
        <p className="team-info__name">{team.name}</p>
        {leaderName ? (
          <p className="team-info__leader">
            Responsable d&apos;équipe · <strong>{leaderName}</strong>
          </p>
        ) : (
          <p className="team-info__leader team-info__leader--muted">Responsable non renseigné</p>
        )}
      </div>
    </div>
  );
}
