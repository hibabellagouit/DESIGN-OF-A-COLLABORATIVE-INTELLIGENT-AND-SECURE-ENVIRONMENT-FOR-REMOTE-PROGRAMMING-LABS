import { render, screen } from "@testing-library/react";
import App from "./App";

test("affiche l’écran de connexion sur la page d’accueil", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /TP Projets/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Se connecter/i })).toBeInTheDocument();
});
